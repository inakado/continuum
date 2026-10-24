import { BadRequestException, ConflictException, GoneException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { AssessmentWorkCopy, AssessmentWorkCreate, AssessmentWorkUpdate } from '@continuum/shared';
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
      const row = await tx.assessmentWork.findFirst({ where: { id: input.id, teacherId, deletedAt: null } });
      if (!row) throw new NotFoundException('Работа не найдена.');
      return workDetail(row, await this.reads.resolve(teacherId, WorkReferencesSchema.parse(row.items), tx));
    });
  }
  async update(teacherId: string, id: string, input: AssessmentWorkUpdate) {
    const hash = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${teacherId}::uuid FOR UPDATE`;
      const row = await this.lock(tx, teacherId, id);
      if (row.lastRequestId === input.requestId) {
        if (row.lastInputHash !== hash) throw new ConflictException('Ключ запроса уже использован для других изменений.');
        return workDetail(row, await this.reads.resolve(teacherId, WorkReferencesSchema.parse(row.items), tx));
      }
      if (row.revision !== input.expectedRevision) throw new ConflictException('Работа изменена в другой вкладке. Загрузите актуальную версию, прежде чем продолжать.');
      const previous = new Set(WorkReferencesSchema.parse(row.items).map((item) => `${item.taskId}@${item.version}`));
      const added = input.items.filter((item) => !previous.has(`${item.taskId}@${item.version}`));
      const removed = await tx.assessmentBankTask.count({ where: { teacherId, deletedAt: { not: null }, id: { in: added.map((item) => item.taskId) } } });
      if (removed) throw new BadRequestException('Выбранное задание удалено из банка. Обновите список и выберите другое.');
      const items = await this.reads.resolve(teacherId, input.items, tx);
      const updated = await tx.assessmentWork.update({ where: { id }, data: { title: input.title, instructions: input.instructions, gradeBand: input.gradeBand, items: json(input.items), taskCount: items.length, maxPoints: items.reduce((sum, item) => sum + item.data.task.maxPoints, 0), revision: { increment: 1 }, lastRequestId: input.requestId, lastInputHash: hash } });
      return workDetail(updated, items);
    }, { timeout: 30000 });
  }
  async copy(teacherId: string, id: string, input: AssessmentWorkCopy) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${teacherId}::uuid FOR UPDATE`;
      const source = await this.lock(tx, teacherId, id);
      const existing = await tx.assessmentWork.findUnique({ where: { id: input.id } });
      if (existing) {
        if (existing.teacherId !== teacherId || existing.copiedFromId !== id || existing.copiedFromRevision !== input.expectedRevision) throw new ConflictException('Ключ копирования уже использован. Обновите список работ.');
        if (existing.deletedAt) throw new GoneException('Эта копия уже удалена. Создайте новую копию из списка работ.');
        return workDetail(existing, await this.reads.resolve(teacherId, WorkReferencesSchema.parse(existing.items), tx));
      }
      if (source.revision !== input.expectedRevision) throw new ConflictException('Работа изменилась. Список обновлён — проверьте её перед копированием.');
      const sourceRefs = WorkReferencesSchema.parse(source.items);
      const available = await tx.assessmentBankTask.findMany({ where: { teacherId, deletedAt: null, id: { in: sourceRefs.map((ref) => ref.taskId) } }, select: { id: true } });
      const availableIds = new Set(available.map((task) => task.id));
      const refs = sourceRefs.filter((ref) => availableIds.has(ref.taskId));
      const items = await this.reads.resolve(teacherId, refs, tx);
      const suffix = ' — копия';
      await tx.assessmentWork.createMany({ data: [{
        id: input.id, teacherId, title: source.title.slice(0, 200 - suffix.length).replace(/[\uD800-\uDBFF]$/, '').trimEnd() + suffix,
        instructions: source.instructions, gradeBand: source.gradeBand, items: json(refs),
        taskCount: items.length, maxPoints: items.reduce((sum, item) => sum + item.data.task.maxPoints, 0),
        copiedFromId: id, copiedFromRevision: input.expectedRevision,
        copySkippedTaskCount: sourceRefs.length - refs.length,
      }], skipDuplicates: true });
      const row = await tx.assessmentWork.findUniqueOrThrow({ where: { id: input.id } });
      if (row.teacherId !== teacherId || row.copiedFromId !== id || row.copiedFromRevision !== input.expectedRevision) throw new ConflictException('Ключ копирования уже использован. Обновите список работ.');
      return workDetail(row, items);
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
