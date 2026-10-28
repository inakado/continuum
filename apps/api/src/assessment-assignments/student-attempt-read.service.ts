import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Readable } from 'node:stream';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { WorkSnapshotSchema } from '../assessment-works/assessment-works-read.service';
import { answersSchema, attemptState, publicItem } from './assignment-data';
import { progressScope, readWorkProgress } from './work-progress';
import { applyAssessmentPresentations, assessmentPresentationRevision } from '../common/assessment-presentation';

@Injectable()
export class StudentAttemptReadService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(ObjectStorageService) private readonly storage: ObjectStorageService) {}
  async owned(studentId: string, id: string, tx: Prisma.TransactionClient = this.db) {
    const row = await tx.assessmentRecipient.findFirst({ where: { id, studentId }, include: { version: true } });
    if (!row) throw new NotFoundException('Работа недоступна.');
    return row;
  }
  async list(studentId: string) {
    const rows = await this.db.assessmentRecipient.findMany({ where: { studentId }, orderBy: { createdAt: 'desc' }, select: {
      id: true, revision: true, createdAt: true, startedAt: true, completedAt: true, answeredCount: true, correctCount: true, incorrectCount: true, points: true,
      version: { select: { number: true, data: true } },
    } });
    const prepared = rows.map((row) => ({ row, snapshot: WorkSnapshotSchema.parse(row.version.data) }));
    const progress = await readWorkProgress(this.db, prepared.map(({ row, snapshot }) => progressScope(row, snapshot)));
    return prepared.map(({ row, snapshot }) => {
      return { id: row.id, title: snapshot.title, versionNumber: row.version.number, taskCount: snapshot.items.length, automaticTaskCount: snapshot.items.filter((item) => item.data.task.type !== 'extended').length, extendedTaskCount: snapshot.items.filter((item) => item.data.task.type === 'extended').length, assignedAt: row.createdAt.toISOString(), ...attemptState(row, snapshot), progress: progress.get(row.id)! };
    });
  }
  async availability(studentId: string, id: string) {
    const row = await this.db.assessmentRecipient.findFirst({ where: { id, studentId }, select: { id: true, version: { select: { data: true } } } });
    if (!row) throw new NotFoundException('Работа больше недоступна.');
    return { id: row.id, presentationRevision: await assessmentPresentationRevision(this.db, WorkSnapshotSchema.parse(row.version.data).items.map((item) => item.taskId)) };
  }
  async detail(studentId: string, id: string) {
    const row = await this.owned(studentId, id);
    const snapshot = WorkSnapshotSchema.parse(row.version.data);
    return { id: row.id, presentationRevision: await assessmentPresentationRevision(this.db, snapshot.items.map((item) => item.taskId)), title: snapshot.title, versionNumber: row.version.number, taskCount: snapshot.items.length, automaticTaskCount: snapshot.items.filter((item) => item.data.task.type !== 'extended').length, extendedTaskCount: snapshot.items.filter((item) => item.data.task.type === 'extended').length, assignedAt: row.createdAt.toISOString(), ...attemptState(row, snapshot),
      instructions: snapshot.instructions, answers: answersSchema.parse(row.answers), items: (await applyAssessmentPresentations(this.db, snapshot.items)).map((item) => publicItem(row.id, item)) };
  }
  async image(studentId: string, id: string, taskId: string, name: string) {
    const row = await this.owned(studentId, id);
    const snapshot = WorkSnapshotSchema.parse(row.version.data);
    const original = snapshot.items.find((item) => item.taskId === taskId);
    const [item] = await applyAssessmentPresentations(this.db, original ? [original] : []);
    const image = item?.data.images.find((item) => item.path === `images/${name}`);
    if (!image) throw new NotFoundException('Рисунок недоступен.');
    const object = await this.storage.getObjectStream(image.key);
    if (!(object.stream instanceof Readable)) throw new Error('Хранилище вернуло неподдерживаемый поток.');
    return { ...object, stream: object.stream, contentType: image.contentType };
  }
}
