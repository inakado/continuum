import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AccessGrant,
  CreateLessonInput,
  CreateSectionInput,
  LessonArtifact,
  LessonSummary,
  LibrarySection,
  LessonArtifactFileInput,
  PublicationResult,
  SetAccessGrantInput,
  SetAccessGrantResult,
  UpdateLessonInput,
  UpdateSectionInput,
} from '@continuum/shared';
import { LessonArtifactType as DbLessonArtifactType, PublicationStatus, Role } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertLessonArtifactFile, safeArtifactFilename } from './lesson-artifact.policy';
import { assertInteractiveSize, interactiveHash, interactivePackageError, parseInteractiveArchive, readInteractiveBytes } from './interactive-archive';
import { lockSectionOrder } from './library-order.service';

@Injectable()
export class LibraryWriteService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ObjectStorageService) private readonly storage: ObjectStorageService,
  ) {}

  async createSection(teacherId: string, input: CreateSectionInput): Promise<LibrarySection> {
    const section = await this.prisma.$transaction(async (tx) => {
      await lockSectionOrder(tx, input.gradeBand);
      const order = await tx.section.aggregate({ where: { gradeBand: input.gradeBand }, _max: { sortOrder: true } });
      return tx.section.create({
        data: {
          gradeBand: input.gradeBand,
          title: input.title,
          description: input.description ?? null,
          sortOrder: (order._max.sortOrder ?? -1) + 1,
          createdById: teacherId,
        },
      });
    });

    return { ...section, lessons: [] };
  }

  async createLesson(teacherId: string, input: CreateLessonInput): Promise<LessonSummary> {
    const section = await this.prisma.section.findFirst({
      where: { id: input.sectionId },
      select: { id: true },
    });
    if (!section) throw this.sectionNotFound();

    const lesson = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM sections WHERE id = ${section.id}::uuid FOR UPDATE`;
      if (!await tx.section.findFirst({ where: { id: section.id } })) throw this.sectionNotFound();
      const order = await tx.lesson.aggregate({
        where: { sectionId: section.id },
        _max: { sortOrder: true },
      });
      return tx.lesson.create({
        data: {
          sectionId: section.id,
          title: input.title,
          description: input.description ?? null,
          sortOrder: (order._max.sortOrder ?? -1) + 1,
          createdById: teacherId,
        },
      });
    });

    return {
      ...lesson,
      formats: { pdf: false, interactive: false, tasks: false },
    };
  }

  async publishSection(_teacherId: string, sectionId: string): Promise<PublicationResult> {
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId },
      select: { id: true },
    });
    if (!section) throw this.sectionNotFound();

    return this.prisma.section.update({
      where: { id: section.id },
      data: { status: PublicationStatus.published },
      select: { id: true, status: true },
    });
  }

  async publishLesson(_teacherId: string, lessonId: string): Promise<PublicationResult> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId },
      select: { id: true, section: { select: { status: true } } },
    });
    if (!lesson) throw this.lessonNotFound();
    if (lesson.section.status !== PublicationStatus.published) {
      throw new ForbiddenException({
        code: 'SECTION_NOT_PUBLISHED',
        message: 'Сначала опубликуйте раздел.',
      });
    }

    const artifacts = await this.prisma.lessonArtifact.findMany({
      where: { lessonId: lesson.id },
      orderBy: [{ type: 'asc' }, { version: 'desc' }],
      select: { id: true, type: true, asset: { select: { objectKey: true, sizeBytes: true, contentHash: true } } },
    });
    const latestByType = new Map<DbLessonArtifactType, string>();
    for (const artifact of artifacts) {
      if (latestByType.has(artifact.type)) continue;
      if (artifact.type === DbLessonArtifactType.interactive) {
        // Revalidate older drafts too: a ZIP header alone never permits publication.
        assertInteractiveSize(Number(artifact.asset.sizeBytes));
        const object = await this.storage.getObjectStream(artifact.asset.objectKey);
        const bytes = await readInteractiveBytes(object.stream, Number(artifact.asset.sizeBytes));
        if (interactiveHash(bytes) !== artifact.asset.contentHash) interactivePackageError('Содержимое ZIP изменилось после загрузки.');
        await parseInteractiveArchive(bytes);
      }
      latestByType.set(artifact.type, artifact.id);
    }

    // Same lock as upload/delete: concurrent publishers cannot leave two active versions.
    // Slow object validation stays outside the transaction; its exact snapshot is checked under lock.
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM lessons WHERE id = ${lessonId}::uuid FOR UPDATE`;
      const currentLesson = await tx.lesson.findFirst({ where: { id: lessonId }, select: { section: { select: { status: true } } } });
      if (!currentLesson) throw this.lessonNotFound();
      if (currentLesson.section.status !== PublicationStatus.published) {
        throw new ForbiddenException({ code: 'SECTION_NOT_PUBLISHED', message: 'Сначала опубликуйте раздел.' });
      }
      const currentArtifacts = await tx.lessonArtifact.findMany({
        where: { lessonId }, orderBy: [{ type: 'asc' }, { version: 'desc' }], select: { id: true, type: true },
      });
      const currentByType = new Map<DbLessonArtifactType, string>();
      for (const artifact of currentArtifacts) if (!currentByType.has(artifact.type)) currentByType.set(artifact.type, artifact.id);
      if (currentByType.size !== latestByType.size || [...latestByType].some(([type, id]) => currentByType.get(type) !== id)) {
        throw new ConflictException({ code: 'LIBRARY_CONTENT_CHANGED', message: 'Материалы занятия изменились. Обновите занятие и повторите публикацию.' });
      }
      const publishedAt = new Date();
      for (const [type, artifactId] of latestByType) {
        await tx.lessonArtifact.updateMany({ where: { lessonId, type, isActive: true }, data: { isActive: false } });
        await tx.lessonArtifact.update({ where: { id: artifactId }, data: { status: PublicationStatus.published, isActive: true, publishedAt } });
      }
      return tx.lesson.update({
        where: { id: lesson.id },
        data: { status: PublicationStatus.published, publishedAt },
        select: { id: true, status: true },
      });
    });
  }

  async updateSection(
    _teacherId: string,
    sectionId: string,
    input: UpdateSectionInput,
  ): Promise<LibrarySection> {
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId },
      select: { id: true },
    });
    if (!section) throw this.sectionNotFound();

    const updated = await this.prisma.section.update({
      where: { id: section.id },
      data: { title: input.title },
    });
    return { ...updated, lessons: [] };
  }

  async updateLesson(
    _teacherId: string,
    lessonId: string,
    input: UpdateLessonInput,
  ): Promise<LessonSummary> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId },
      select: { id: true },
    });
    if (!lesson) throw this.lessonNotFound();

    const updated = await this.prisma.lesson.update({
      where: { id: lesson.id },
      data: { title: input.title },
    });
    return {
      ...updated,
      formats: { pdf: false, interactive: false, tasks: false },
    };
  }

  async uploadArtifact(
    teacherId: string,
    lessonId: string,
    input: LessonArtifactFileInput,
    contentLength: string | undefined,
    body: NodeJS.ReadableStream,
  ): Promise<LessonArtifact> {
    assertLessonArtifactFile(input);
    if (contentLength !== String(input.sizeBytes)) {
      throw new BadRequestException({
        code: 'ARTIFACT_SIZE_INVALID',
        message: 'Размер файла не совпадает с запросом.',
      });
    }
    await this.assertLesson(lessonId);

    // Executable packages are bounded and fully validated before writing any object.
    const uploadBody = input.type === 'interactive'
      ? await readInteractiveBytes(body, input.sizeBytes)
      : body;
    if (Buffer.isBuffer(uploadBody)) await parseInteractiveArchive(uploadBody);

    const filename = safeArtifactFilename(input.filename);
    const objectKey = `${this.artifactPrefix(teacherId, lessonId, input.type)}/${randomUUID()}-${filename}`;
    try {
      await this.storage.putObject({ key: objectKey, contentType: input.contentType, body: uploadBody });
      return await this.completeArtifactUpload(teacherId, lessonId, { ...input, objectKey });
    } catch (error) {
      await this.storage.deleteObject(objectKey).catch(() => undefined);
      throw error;
    }
  }

  private async completeArtifactUpload(
    teacherId: string,
    lessonId: string,
    input: LessonArtifactFileInput & { objectKey: string },
  ): Promise<LessonArtifact> {
    assertLessonArtifactFile(input);
    await this.assertLesson(lessonId);
    const expectedPrefix = `${this.artifactPrefix(teacherId, lessonId, input.type)}/`;
    if (!input.objectKey.startsWith(expectedPrefix)) {
      throw new BadRequestException({
        code: 'ARTIFACT_OBJECT_KEY_INVALID',
        message: 'Файл не относится к выбранному занятию.',
      });
    }

    const meta = await this.storage.getObjectMeta(input.objectKey);
    if (
      !meta.exists ||
      meta.contentLength !== input.sizeBytes ||
      meta.contentType !== input.contentType
    ) {
      throw new BadRequestException({
        code: 'ARTIFACT_UPLOAD_INCOMPLETE',
        message: 'Загрузка файла не завершена или файл изменён.',
      });
    }

    const uploaded = await this.storage.getObjectStream(input.objectKey);
    const hash = createHash('sha256');
    let actualSize = 0;
    let signature = Buffer.alloc(0);
    const interactiveChunks: Buffer[] = [];
    for await (const chunk of uploaded.stream as AsyncIterable<Buffer | Uint8Array | string>) {
      const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk);
      actualSize += bytes.length;
      if (actualSize > input.sizeBytes) {
        throw new BadRequestException({ code: 'ARTIFACT_SIZE_INVALID', message: 'Размер файла изменился.' });
      }
      if (signature.length < 5) signature = Buffer.concat([signature, bytes]).subarray(0, 5);
      hash.update(bytes);
      if (input.type === 'interactive') interactiveChunks.push(bytes);
    }
    const expectedSignature = input.type === 'interactive' ? 'PK' : '%PDF-';
    if (actualSize !== input.sizeBytes || !signature.toString().startsWith(expectedSignature)) {
      throw new BadRequestException({ code: 'ARTIFACT_CONTENT_INVALID', message: 'Содержимое файла не соответствует формату.' });
    }
    if (input.type === 'interactive') await parseInteractiveArchive(Buffer.concat(interactiveChunks));

    const result = await this.prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM lessons WHERE id = ${lessonId}::uuid FOR UPDATE`;
      await this.assertLesson(lessonId, transaction);
      const current = await transaction.lessonArtifact.aggregate({
        where: { lessonId, type: input.type as DbLessonArtifactType },
        _max: { version: true },
      });
      const asset = await transaction.asset.create({
        data: {
          objectKey: input.objectKey,
          filename: safeArtifactFilename(input.filename),
          contentType: input.contentType,
          sizeBytes: BigInt(input.sizeBytes),
          contentHash: hash.digest('hex'),
          uploadedById: teacherId,
        },
      });
      return transaction.lessonArtifact.create({
        data: {
          lessonId,
          assetId: asset.id,
          type: input.type as DbLessonArtifactType,
          version: (current._max.version ?? 0) + 1,
        },
        include: { asset: true },
      });
    });

    return {
      id: result.id,
      type: result.type,
      version: result.version,
      filename: result.asset.filename,
      contentType: result.asset.contentType,
      sizeBytes: Number(result.asset.sizeBytes),
      status: result.status,
      isActive: result.isActive,
      publishedAt: result.publishedAt?.toISOString() ?? null,
    };
  }

  async setAccessGrant(
    teacherId: string,
    input: SetAccessGrantInput,
  ): Promise<SetAccessGrantResult> {
    const student = await this.prisma.user.findFirst({
      where: {
        id: input.studentId,
        role: Role.student,
        studentProfile: { is: { deletedAt: null } },
      },
      select: { id: true },
    });
    if (!student) {
      throw new ForbiddenException({
        code: 'STUDENT_NOT_MANAGED',
        message: 'Ученик не найден.',
      });
    }

    if (!input.enabled) {
      await this.prisma.accessGrant.deleteMany({
        where: { studentId: student.id, gradeBand: input.gradeBand },
      });
      return { grant: null };
    }

    const grant = await this.prisma.accessGrant.upsert({
      where: {
        studentId_gradeBand: { studentId: student.id, gradeBand: input.gradeBand },
      },
      create: {
        studentId: student.id,
        gradeBand: input.gradeBand,
        grantedById: teacherId,
      },
      update: {},
    });

    return { grant: this.mapGrant(grant) };
  }

  private mapGrant(grant: {
    studentId: string;
    gradeBand: AccessGrant['gradeBand'];
    grantedAt: Date;
  }): AccessGrant {
    return {
      studentId: grant.studentId,
      gradeBand: grant.gradeBand,
      grantedAt: grant.grantedAt.toISOString(),
    };
  }

  private async assertLesson(lessonId: string, tx: Prisma.TransactionClient = this.prisma) {
    const lesson = await tx.lesson.findFirst({
      where: { id: lessonId },
      select: { id: true },
    });
    if (!lesson) throw this.lessonNotFound();
  }

  private artifactPrefix(teacherId: string, lessonId: string, type: string) {
    return `teachers/${teacherId}/lessons/${lessonId}/${type}`;
  }

  private sectionNotFound() {
    return new NotFoundException({
      code: 'SECTION_NOT_FOUND',
      message: 'Раздел не найден.',
    });
  }

  private lessonNotFound() {
    return new NotFoundException({
      code: 'LESSON_NOT_FOUND',
      message: 'Занятие не найдено.',
    });
  }
}
