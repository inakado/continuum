import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { SolutionAnswer } from '@continuum/shared';
import type { AuthUser } from '../auth/auth.types';
import { Readable } from 'node:stream';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { WorkSnapshotSchema } from '../assessment-works/assessment-works-read.service';

@Injectable()
export class SolutionReadService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(ObjectStorageService) private readonly storage: ObjectStorageService) {}

  async owned(user: Pick<AuthUser, 'id' | 'role'>, id: string, tx: Prisma.TransactionClient = this.db) {
    const where = user.role === 'student' ? { id, studentId: user.id } : { id, version: { work: { teacherId: user.id } } };
    const row = await tx.assessmentRecipient.findFirst({ where, include: { version: true } });
    if (!row) throw new NotFoundException('Решение недоступно.');
    return row;
  }

  async list(user: Pick<AuthUser, 'id' | 'role'>, id: string, tx: Prisma.TransactionClient = this.db): Promise<SolutionAnswer[]> {
    const row = await this.owned(user, id, tx);
    const items = WorkSnapshotSchema.parse(row.version.data).items.filter((item) => item.data.task.type === 'extended');
    const answers = await tx.assessmentSolutionAnswer.findMany({ where: { recipientId: id }, include: {
      review: { include: { versions: true } },
      photos: { where: { confirmedAt: { not: null }, removedAt: null }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] },
    } });
    return items.map((item) => {
      const answer = answers.find((entry) => entry.taskId === item.taskId);
      const published = answer?.review?.versions.find((version) => version.revision === answer.review?.publishedRevision);
      return { taskId: item.taskId, title: item.data.task.title, maxPoints: item.data.task.maxPoints, revision: answer?.revision ?? 0, locked: Boolean(answer?.lockedAt),
        publishedReview: published && published.points !== null && published.reportId ? { points: published.points, revision: published.revision, reportUrl: `/assessment-solutions/${id}/items/${item.taskId}/review` } : null,
        photos: (answer?.photos ?? []).map((photo) => ({ id: photo.id, sizeBytes: photo.sizeBytes,
          contentType: photo.contentType as SolutionAnswer['photos'][number]['contentType'], createdAt: photo.createdAt.toISOString(),
          url: `/assessment-solutions/${id}/items/${item.taskId}/photos/${photo.id}`,
        })) };
    });
  }

  async photo(user: Pick<AuthUser, 'id' | 'role'>, id: string, taskId: string, photoId: string) {
    await this.owned(user, id);
    const photo = await this.db.assessmentSolutionPhoto.findFirst({ where: { id: photoId, confirmedAt: { not: null }, removedAt: null, answer: { recipientId: id, taskId } } });
    if (!photo) throw new NotFoundException('Фотография недоступна.');
    const object = await this.storage.getObjectStream(photo.objectKey);
    if (!(object.stream instanceof Readable)) throw new Error('Хранилище вернуло неподдерживаемый поток.');
    return { ...object, stream: object.stream, contentType: photo.contentType };
  }
  async publishedReport(user: Pick<AuthUser, 'id' | 'role'>, id: string, taskId: string) {
    await this.owned(user, id);
    const answer = await this.db.assessmentSolutionAnswer.findUnique({ where: { recipientId_taskId: { recipientId: id, taskId } }, include: { review: { include: { versions: { include: { report: true } } } } } });
    const version = answer?.review?.versions.find((row) => row.revision === answer.review?.publishedRevision);
    if (!version?.report?.confirmedAt || version.report.solutionId !== answer?.id || version.report.sourceRevision !== answer.revision) throw new NotFoundException('Разбор пока не опубликован.');
    const object = await this.storage.getObjectStream(version.report.objectKey);
    if (!(object.stream instanceof Readable)) throw new Error('Хранилище вернуло неподдерживаемый поток.');
    return object.stream;
  }
}
