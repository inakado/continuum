import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AccessGrant,
  CompleteLessonArtifactUploadInput,
  CreateLessonInput,
  CreateSectionInput,
  LessonArtifact,
  LessonSummary,
  LibrarySection,
  PrepareLessonArtifactUploadInput,
  PrepareLessonArtifactUploadResult,
  PublicationResult,
  SetAccessGrantInput,
  SetAccessGrantResult,
  UpdateLessonInput,
  UpdateSectionInput,
} from '@continuum/shared';
import { LessonArtifactType as DbLessonArtifactType, PublicationStatus, Role } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { assertLessonArtifactFile, safeArtifactFilename } from './lesson-artifact.policy';

@Injectable()
export class LibraryWriteService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ObjectStorageService) private readonly storage: ObjectStorageService,
  ) {}

  async createSection(teacherId: string, input: CreateSectionInput): Promise<LibrarySection> {
    const order = await this.prisma.section.aggregate({
      where: { createdById: teacherId, gradeBand: input.gradeBand },
      _max: { sortOrder: true },
    });
    const section = await this.prisma.section.create({
      data: {
        gradeBand: input.gradeBand,
        title: input.title,
        description: input.description ?? null,
        sortOrder: (order._max.sortOrder ?? -1) + 1,
        createdById: teacherId,
      },
    });

    return { ...section, lessons: [] };
  }

  async createLesson(teacherId: string, input: CreateLessonInput): Promise<LessonSummary> {
    const section = await this.prisma.section.findFirst({
      where: { id: input.sectionId, createdById: teacherId },
      select: { id: true },
    });
    if (!section) throw this.sectionNotFound();

    const order = await this.prisma.lesson.aggregate({
      where: { sectionId: section.id },
      _max: { sortOrder: true },
    });
    const lesson = await this.prisma.lesson.create({
      data: {
        sectionId: section.id,
        title: input.title,
        description: input.description ?? null,
        sortOrder: (order._max.sortOrder ?? -1) + 1,
        createdById: teacherId,
      },
    });

    return {
      ...lesson,
      formats: { pdf: false, interactive: false, tasks: false },
    };
  }

  async publishSection(teacherId: string, sectionId: string): Promise<PublicationResult> {
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, createdById: teacherId },
      select: { id: true },
    });
    if (!section) throw this.sectionNotFound();

    return this.prisma.section.update({
      where: { id: section.id },
      data: { status: PublicationStatus.published },
      select: { id: true, status: true },
    });
  }

  async publishLesson(teacherId: string, lessonId: string): Promise<PublicationResult> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, createdById: teacherId },
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
      select: { id: true, type: true },
    });
    const latestByType = new Map<DbLessonArtifactType, string>();
    for (const artifact of artifacts) {
      // ZIP packages must not be published before manifest validation and an isolated player exist.
      if (artifact.type === DbLessonArtifactType.interactive) continue;
      if (!latestByType.has(artifact.type)) latestByType.set(artifact.type, artifact.id);
    }

    const publishedAt = new Date();
    const operations = [...latestByType.entries()].flatMap(([type, artifactId]) => [
      this.prisma.lessonArtifact.updateMany({
        where: { lessonId: lesson.id, type, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.lessonArtifact.update({
        where: { id: artifactId },
        data: { status: PublicationStatus.published, isActive: true, publishedAt },
      }),
    ]);

    const results = await this.prisma.$transaction([
      ...operations,
      this.prisma.lesson.update({
        where: { id: lesson.id },
        data: { status: PublicationStatus.published, publishedAt },
        select: { id: true, status: true },
      }),
    ]);

    return results[results.length - 1] as PublicationResult;
  }

  async updateSection(
    teacherId: string,
    sectionId: string,
    input: UpdateSectionInput,
  ): Promise<LibrarySection> {
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, createdById: teacherId },
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
    teacherId: string,
    lessonId: string,
    input: UpdateLessonInput,
  ): Promise<LessonSummary> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, createdById: teacherId },
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

  async prepareArtifactUpload(
    teacherId: string,
    lessonId: string,
    input: PrepareLessonArtifactUploadInput,
  ): Promise<PrepareLessonArtifactUploadResult> {
    assertLessonArtifactFile(input);
    await this.assertOwnedLesson(teacherId, lessonId);

    const filename = safeArtifactFilename(input.filename);
    const objectKey = `${this.artifactPrefix(teacherId, lessonId, input.type)}/${randomUUID()}-${filename}`;
    const upload = await this.storage.presignPutObject(objectKey, input.contentType);
    return { objectKey, uploadUrl: upload.url, headers: upload.headers };
  }

  async completeArtifactUpload(
    teacherId: string,
    lessonId: string,
    input: CompleteLessonArtifactUploadInput,
  ): Promise<LessonArtifact> {
    assertLessonArtifactFile(input);
    await this.assertOwnedLesson(teacherId, lessonId);
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
    for await (const chunk of uploaded.stream as AsyncIterable<Buffer | Uint8Array | string>) {
      const bytes = typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk);
      actualSize += bytes.length;
      if (actualSize > input.sizeBytes) {
        throw new BadRequestException({ code: 'ARTIFACT_SIZE_INVALID', message: 'Размер файла изменился.' });
      }
      if (signature.length < 5) signature = Buffer.concat([signature, bytes]).subarray(0, 5);
      hash.update(bytes);
    }
    const expectedSignature = input.type === 'interactive' ? 'PK' : '%PDF-';
    if (actualSize !== input.sizeBytes || !signature.toString().startsWith(expectedSignature)) {
      throw new BadRequestException({ code: 'ARTIFACT_CONTENT_INVALID', message: 'Содержимое файла не соответствует формату.' });
    }

    const result = await this.prisma.$transaction(async (transaction) => {
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
        studentProfile: { is: { leadTeacherId: teacherId } },
      },
      select: { id: true },
    });
    if (!student) {
      throw new ForbiddenException({
        code: 'STUDENT_NOT_MANAGED',
        message: 'Ученик не привязан к этому преподавателю.',
      });
    }

    if (!input.enabled) {
      await this.prisma.accessGrant.deleteMany({
        where: { studentId: student.id, gradeBand: input.gradeBand, grantedById: teacherId },
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
      update: { grantedById: teacherId },
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

  private async assertOwnedLesson(teacherId: string, lessonId: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, createdById: teacherId },
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
