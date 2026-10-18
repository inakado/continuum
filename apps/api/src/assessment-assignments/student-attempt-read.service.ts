import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Readable } from 'node:stream';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { WorkSnapshotSchema } from '../assessment-works/assessment-works-read.service';
import { answersSchema, attemptState, publicItem } from './assignment-data';

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
      id: true, revision: true, createdAt: true, startedAt: true, completedAt: true, answeredCount: true, correctCount: true, incorrectCount: true,
      version: { select: { number: true, data: true } },
    } });
    return rows.map((row) => {
      const snapshot = WorkSnapshotSchema.parse(row.version.data);
      return { id: row.id, title: snapshot.title, versionNumber: row.version.number, taskCount: snapshot.items.length, automaticTaskCount: snapshot.items.filter((item) => item.data.task.type !== 'extended').length, extendedTaskCount: snapshot.items.filter((item) => item.data.task.type === 'extended').length, assignedAt: row.createdAt.toISOString(), ...attemptState(row) };
    });
  }
  async detail(studentId: string, id: string) {
    const row = await this.owned(studentId, id);
    const snapshot = WorkSnapshotSchema.parse(row.version.data);
    return { id: row.id, title: snapshot.title, versionNumber: row.version.number, taskCount: snapshot.items.length, automaticTaskCount: snapshot.items.filter((item) => item.data.task.type !== 'extended').length, extendedTaskCount: snapshot.items.filter((item) => item.data.task.type === 'extended').length, assignedAt: row.createdAt.toISOString(), ...attemptState(row),
      instructions: snapshot.instructions, answers: answersSchema.parse(row.answers), items: snapshot.items.map((item) => publicItem(row.id, item)) };
  }
  async image(studentId: string, id: string, taskId: string, name: string) {
    const row = await this.owned(studentId, id);
    const snapshot = WorkSnapshotSchema.parse(row.version.data);
    const image = snapshot.items.find((item) => item.taskId === taskId)?.data.images.find((item) => item.path === `images/${name}`);
    if (!image) throw new NotFoundException('Рисунок недоступен.');
    const object = await this.storage.getObjectStream(image.key);
    if (!(object.stream instanceof Readable)) throw new Error('Хранилище вернуло неподдерживаемый поток.');
    return { ...object, stream: object.stream, contentType: image.contentType };
  }
}
