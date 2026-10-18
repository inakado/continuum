import { BadRequestException, ConflictException, Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { solutionPhotoPolicy, type SolutionPhotoMutation } from '@continuum/shared';
import type { Readable } from 'node:stream';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { WorkSnapshotSchema } from '../assessment-works/assessment-works-read.service';
import { SolutionReadService } from './solution-read.service';
import { readSolutionPhoto } from './solution-photo';

@Injectable()
export class SolutionWriteService {
  private readonly logger = new Logger(SolutionWriteService.name);
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(ObjectStorageService) private readonly storage: ObjectStorageService,
    @Inject(SolutionReadService) private readonly reads: SolutionReadService) {}

  private async lock(tx: Prisma.TransactionClient, studentId: string, id: string, taskId: string) {
    await tx.$queryRaw`SELECT id FROM assessment_recipients WHERE id = ${id}::uuid AND student_id = ${studentId}::uuid FOR UPDATE`;
    const row = await this.reads.owned({ id: studentId, role: 'student' }, id, tx);
    const item = WorkSnapshotSchema.parse(row.version.data).items.find((entry) => entry.taskId === taskId);
    if (item?.data.task.type !== 'extended') throw new BadRequestException('Эта задача не принимает фотографии.');
    if (!row.startedAt) throw new ConflictException('Сначала начните работу.');
    return tx.assessmentSolutionAnswer.upsert({ where: { recipientId_taskId: { recipientId: id, taskId } }, update: {}, create: { recipientId: id, taskId } });
  }
  private assertWritable(answer: { revision: number; lockedAt: Date | null }, revision: number) {
    if (answer.lockedAt) throw new ConflictException('Решение уже проверено. Фотографии нельзя менять.');
    if (answer.revision !== revision) throw new ConflictException('Фотографии изменились в другой вкладке. Обновите список перед изменением.');
  }

  private async cleanInactive(studentId: string, id: string) {
    const rows = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM assessment_recipients WHERE id = ${id}::uuid AND student_id = ${studentId}::uuid FOR UPDATE`;
      await this.reads.owned({ id: studentId, role: 'student' }, id, tx);
      const rows = await tx.assessmentSolutionPhoto.findMany({ where: { answer: { recipientId: id }, purgedAt: null,
        OR: [{ removedAt: { not: null } }, { confirmedAt: null, createdAt: { lt: new Date(Date.now() - solutionPhotoPolicy.pendingTtlMs) } }] }, take: 20 });
      await tx.assessmentSolutionPhoto.updateMany({ where: { id: { in: rows.filter((row) => !row.removedAt).map((row) => row.id) } }, data: { removedAt: new Date() } });
      return rows;
    });
    for (const row of rows) {
      try {
        await this.storage.deleteObject(row.objectKey);
        await this.db.assessmentSolutionPhoto.update({ where: { id: row.id }, data: { purgedAt: new Date() } });
      } catch { this.logger.warn(`Не удалось очистить фото ${row.id}; запись оставлена для повторной очистки.`); }
    }
  }

  async upload(studentId: string, id: string, taskId: string, photoId: string, input: SolutionPhotoMutation, stream: Readable, type: string, length?: string) {
    const owned = await this.reads.owned({ id: studentId, role: 'student' }, id);
    if (!owned.startedAt || !WorkSnapshotSchema.parse(owned.version.data).items.some((item) => item.taskId === taskId && item.data.task.type === 'extended')) throw new BadRequestException('Начните работу и выберите развёрнутую задачу.');
    const photo = await readSolutionPhoto(stream, type, length);
    await this.cleanInactive(studentId, id);
    // Ownership of the object is persisted before S3 writes; interrupted uploads never become answers.
    const reserved = await this.db.$transaction(async (tx) => {
      const answer = await this.lock(tx, studentId, id, taskId);
      const previous = await tx.assessmentSolutionPhoto.findUnique({ where: { id: photoId } });
      if (previous) {
        if (previous.answerId !== answer.id || previous.contentHash !== photo.contentHash || previous.removedAt) throw new ConflictException('Идентификатор фотографии уже использован.');
        if (previous.confirmedAt) return previous;
      }
      this.assertWritable(answer, input.revision);
      if (previous) return previous;
      if (input.replaceId && !await tx.assessmentSolutionPhoto.findFirst({ where: { id: input.replaceId, answerId: answer.id, confirmedAt: { not: null }, removedAt: null } })) throw new ConflictException('Заменяемая фотография недоступна.');
      const count = await tx.assessmentSolutionPhoto.count({ where: { answerId: answer.id, removedAt: null } });
      if (count >= solutionPhotoPolicy.maxPhotos + (input.replaceId ? 1 : 0)) throw new BadRequestException('Можно добавить не более 10 фотографий к задаче. Завершите или удалите незагруженные файлы.');
      return tx.assessmentSolutionPhoto.create({ data: { id: photoId, answerId: answer.id, objectKey: `assessment-solutions/${id}/${taskId}/${photoId}`, contentHash: photo.contentHash, contentType: photo.contentType, sizeBytes: photo.sizeBytes } });
    });
    if (!reserved.confirmedAt) {
      await this.db.$transaction(async (tx) => {
        const answer = await this.lock(tx, studentId, id, taskId);
        const current = await tx.assessmentSolutionPhoto.findUniqueOrThrow({ where: { id: photoId } });
        if (current.confirmedAt && !current.removedAt) return;
        this.assertWritable(answer, input.revision);
        if (current.removedAt) throw new ConflictException('Фотография удалена.');
        if (input.replaceId) {
          const old = await tx.assessmentSolutionPhoto.findFirst({ where: { id: input.replaceId, answerId: answer.id, confirmedAt: { not: null }, removedAt: null } });
          if (!old) throw new ConflictException('Заменяемая фотография больше недоступна.');
          await tx.assessmentSolutionPhoto.update({ where: { id: old.id }, data: { removedAt: new Date() } });
        }
        const count = await tx.assessmentSolutionPhoto.count({ where: { answerId: answer.id, confirmedAt: { not: null }, removedAt: null } });
        if (count >= solutionPhotoPolicy.maxPhotos) throw new BadRequestException('Можно добавить не более 10 фотографий к задаче.');
        await this.storage.putObject({ key: reserved.objectKey, body: photo.bytes, contentType: photo.contentType, cacheControl: 'private, no-store' });
        await tx.assessmentSolutionPhoto.update({ where: { id: photoId }, data: { confirmedAt: new Date() } });
        await tx.assessmentSolutionAnswer.update({ where: { id: answer.id }, data: { revision: { increment: 1 } } });
      }, { timeout: 30000 });
    }
    await this.cleanInactive(studentId, id);
    return this.reads.list({ id: studentId, role: 'student' }, id);
  }

  async remove(studentId: string, id: string, taskId: string, photoId: string, revision: number) {
    await this.db.$transaction(async (tx) => {
      const answer = await this.lock(tx, studentId, id, taskId);
      const photo = await tx.assessmentSolutionPhoto.findFirst({ where: { id: photoId, answerId: answer.id } });
      if (!photo) throw new BadRequestException('Фотография недоступна.');
      if (photo.removedAt) return;
      this.assertWritable(answer, revision);
      await tx.assessmentSolutionPhoto.update({ where: { id: photoId }, data: { removedAt: new Date() } });
      await tx.assessmentSolutionAnswer.update({ where: { id: answer.id }, data: { revision: { increment: 1 } } });
    });
    await this.cleanInactive(studentId, id);
    return this.reads.list({ id: studentId, role: 'student' }, id);
  }
}
