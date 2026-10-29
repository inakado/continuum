import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { AssessmentWorkReferenceSchema, GradeBandSchema, type AssessmentWorkReference, type AssessmentWorkAnswerCheck } from '@continuum/shared';
import type { AssessmentWork, AssessmentWorkVersion, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { mapAssessmentView, StoredAssessmentTaskSchema } from '../assessment-bank/assessment-bank.mapper';
import { gradeAssessmentAnswer, validateAssessmentAnswer } from '../common/assessment-grading';
import { applyAssessmentPresentations } from '../common/assessment-presentation';

export const WorkReferencesSchema = z.array(AssessmentWorkReferenceSchema);
const StoredWorkItemSchema = z.object({ taskId: z.uuid(), version: z.number().int().positive(), data: StoredAssessmentTaskSchema });
export const WorkSnapshotSchema = z.object({ title: z.string(), instructions: z.string(), gradeBand: GradeBandSchema, items: z.array(StoredWorkItemSchema).min(1) });
type StoredWorkItem = z.infer<typeof StoredWorkItemSchema>;
type WorkSummaryRow = Pick<AssessmentWork, 'id' | 'title' | 'gradeBand' | 'revision' | 'taskCount' | 'maxPoints' | 'updatedAt' | 'archivedAt' | 'lifecycleRevision'>;
const workSummary = (row: WorkSummaryRow) => ({ id: row.id, title: row.title, gradeBand: row.gradeBand, revision: row.revision, taskCount: row.taskCount, maxPoints: row.maxPoints, updatedAt: row.updatedAt.toISOString(), isArchived: Boolean(row.archivedAt), lifecycleRevision: row.lifecycleRevision });
const taskView = (item: StoredWorkItem & { presentationVersion?: number }) => mapAssessmentView(item.taskId, item.version, item.data, `/teacher/assessment-bank/tasks/${item.taskId}/images`, item.presentationVersion);
export const workDetail = (row: AssessmentWork, items: StoredWorkItem[]) => ({ ...workSummary(row), instructions: row.instructions, items: items.map(taskView), copySkippedTaskCount: row.copySkippedTaskCount });
export function workVersion(row: AssessmentWorkVersion, items?: StoredWorkItem[]) {
  const snapshot = WorkSnapshotSchema.parse(row.data);
  return { id: row.id, workId: row.workId, number: row.number, revision: row.revision, createdAt: row.createdAt.toISOString(), ...snapshot, items: (items ?? snapshot.items).map(taskView), maxPoints: snapshot.items.reduce((sum, item) => sum + item.data.task.maxPoints, 0) };
}

@Injectable()
export class AssessmentWorksReadService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  async owned(teacherId: string, id: string, client: Prisma.TransactionClient = this.db) {
    const row = await client.assessmentWork.findFirst({ where: { id, teacherId, deletedAt: null } });
    if (!row) throw new NotFoundException('Работа не найдена.');
    return row;
  }
  async resolve(teacherId: string, refs: AssessmentWorkReference[], client: Prisma.TransactionClient = this.db): Promise<StoredWorkItem[]> {
    if (!refs.length) return [];
    const rows = await client.assessmentTaskVersion.findMany({ where: { task: { teacherId }, OR: refs.map((ref) => ({ taskId: ref.taskId, version: ref.version })) }, select: { taskId: true, version: true, data: true } });
    const map = new Map(rows.map((row) => [`${row.taskId}@${row.version}`, row]));
    return refs.map((ref) => {
      const row = map.get(`${ref.taskId}@${ref.version}`);
      if (!row) throw new BadRequestException('Задание или выбранная версия недоступны в вашем банке.');
      return { ...ref, data: StoredAssessmentTaskSchema.parse(row.data) };
    });
  }
  async list(teacherId: string) {
    const rows = await this.db.assessmentWork.findMany({ where: { teacherId, deletedAt: null }, select: { id: true, title: true, gradeBand: true, revision: true, taskCount: true, maxPoints: true, updatedAt: true, archivedAt: true, lifecycleRevision: true, _count: { select: { versions: { where: { assignments: { some: {} } } } } } }, orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }] });
    return rows.map((row) => ({ ...workSummary(row), hasAssignments: row._count.versions > 0, canDelete: row._count.versions === 0 }));
  }
  async detail(teacherId: string, id: string) {
    return this.db.$transaction(async (tx) => {
      const row = await this.owned(teacherId, id, tx);
      return workDetail(row, await applyAssessmentPresentations(tx, await this.resolve(teacherId, WorkReferencesSchema.parse(row.items), tx)));
    });
  }
  async version(teacherId: string, id: string, number: number) {
    await this.owned(teacherId, id);
    const row = await this.db.assessmentWorkVersion.findUnique({ where: { workId_number: { workId: id, number } } });
    if (!row) throw new NotFoundException('Версия работы не найдена.');
    return workVersion(row, await applyAssessmentPresentations(this.db, WorkSnapshotSchema.parse(row.data).items));
  }
  async checkAnswer(teacherId: string, id: string, input: AssessmentWorkAnswerCheck) {
    const item = await this.db.$transaction(async (tx) => {
      const work = await this.owned(teacherId, id, tx);
      if (input.source.kind === 'version') {
        const version = await tx.assessmentWorkVersion.findUnique({ where: { workId_number: { workId: id, number: input.source.number } } });
        if (!version) throw new NotFoundException('Версия работы не найдена.');
        return WorkSnapshotSchema.parse(version.data).items.find((entry) => entry.taskId === input.taskId);
      }
      if (work.revision !== input.source.expectedRevision) throw new ConflictException('Работа изменилась. Обновите предпросмотр и повторите проверку.');
      const ref = WorkReferencesSchema.parse(work.items).find((entry) => entry.taskId === input.taskId);
      return ref ? (await this.resolve(teacherId, [ref], tx))[0] : undefined;
    });
    if (!item) throw new BadRequestException('Задание не входит в работу.');
    const task = item.data.task;
    if (task.type === 'extended') throw new BadRequestException('Развёрнутые решения проверяются отдельно.');
    validateAssessmentAnswer(input.answer, task);
    const points = gradeAssessmentAnswer(task, input.answer);
    return { correct: points === task.maxPoints, points, maxPoints: task.maxPoints };
  }
}
