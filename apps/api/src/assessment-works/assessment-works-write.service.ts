import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { AssessmentWorkCreate, AssessmentWorkUpdate } from '@continuum/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AssessmentWorksReadService, workDetail, workVersion, WorkReferencesSchema } from './assessment-works-read.service';

const json = (value: object): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
@Injectable()
export class AssessmentWorksWriteService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(AssessmentWorksReadService) private readonly reads: AssessmentWorksReadService) {}
  private async lock(tx: Prisma.TransactionClient, teacherId: string, id: string) {
    await tx.$queryRaw`SELECT id FROM assessment_works WHERE id = ${id}::uuid AND teacher_id = ${teacherId}::uuid FOR UPDATE`;
    return this.reads.owned(teacherId, id, tx);
  }
  async create(teacherId: string, input: AssessmentWorkCreate) {
    return this.db.$transaction(async (tx) => {
      await tx.assessmentWork.createMany({ data: [{ ...input, teacherId, items: [] }], skipDuplicates: true });
      const row = await tx.assessmentWork.findFirst({ where: { id: input.id, teacherId } });
      if (!row) throw new NotFoundException('Работа не найдена.');
      return workDetail(row, await this.reads.resolve(teacherId, WorkReferencesSchema.parse(row.items), tx));
    });
  }
  async update(teacherId: string, id: string, input: AssessmentWorkUpdate) {
    const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    return this.db.$transaction(async (tx) => {
      const row = await this.lock(tx, teacherId, id);
      if (row.lastRequestId === input.requestId) {
        if (row.lastInputHash !== hash) throw new ConflictException('Ключ запроса уже использован для других изменений.');
        return workDetail(row, await this.reads.resolve(teacherId, WorkReferencesSchema.parse(row.items), tx));
      }
      if (row.revision !== input.expectedRevision) throw new ConflictException('Работа изменена в другой вкладке. Загрузите актуальную версию, прежде чем продолжать.');
      const items = await this.reads.resolve(teacherId, input.items, tx);
      const updated = await tx.assessmentWork.update({ where: { id }, data: { title: input.title, instructions: input.instructions, gradeBand: input.gradeBand, items: json(input.items), taskCount: items.length, maxPoints: items.reduce((sum, item) => sum + item.data.task.maxPoints, 0), revision: { increment: 1 }, lastRequestId: input.requestId, lastInputHash: hash } });
      return workDetail(updated, items);
    }, { timeout: 30000 });
  }
  async freeze(teacherId: string, id: string, expectedRevision: number) {
    return this.db.$transaction((tx) => this.freezeInTransaction(tx, teacherId, id, expectedRevision), { timeout: 30000 });
  }
  async freezeInTransaction(tx: Prisma.TransactionClient, teacherId: string, id: string, expectedRevision: number) {
      const row = await this.lock(tx, teacherId, id);
      const existing = await tx.assessmentWorkVersion.findUnique({ where: { workId_revision: { workId: id, revision: expectedRevision } } });
      if (existing) return workVersion(existing);
      if (row.revision !== expectedRevision) throw new ConflictException('Работа изменилась. Сначала сохраните и проверьте актуальный состав.');
      const items = await this.reads.resolve(teacherId, WorkReferencesSchema.parse(row.items), tx);
      if (!items.length) throw new BadRequestException('Добавьте хотя бы одно задание.');
      const last = await tx.assessmentWorkVersion.aggregate({ where: { workId: id }, _max: { number: true } });
      const version = await tx.assessmentWorkVersion.create({ data: { workId: id, number: (last._max.number ?? 0) + 1, revision: row.revision, data: json({ title: row.title, instructions: row.instructions, gradeBand: row.gradeBand, items }) } });
      return workVersion(version);
  }
}
