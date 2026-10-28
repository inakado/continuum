import { isDeepStrictEqual } from 'node:util';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { AssessmentPackageTask } from '@continuum/shared';
import { StoredAssessmentTaskSchema, type StoredAssessmentTask } from '../assessment-bank/assessment-bank.mapper';

type Item = { taskId: string; version: number; data: StoredAssessmentTask; presentationVersion?: number };
export async function assessmentPresentationRevision(tx: Prisma.TransactionClient, taskIds: string[]) {
  const rows = taskIds.length ? await tx.assessmentTaskVersion.findMany({ where: { taskId: { in: taskIds }, isPresentationCorrection: true },
    select: { taskId: true, version: true }, distinct: ['taskId'], orderBy: [{ taskId: 'asc' }, { version: 'desc' }] }) : [];
  return createHash('sha256').update(JSON.stringify(rows)).digest('hex');
}
// Only statement, images, solution and choice/row text may change. Answer identity and all metadata stay pinned.
export function assessmentPresentationCompatible(a: AssessmentPackageTask, b: AssessmentPackageTask) {
  const definition = (task: AssessmentPackageTask) => ({ ...task,
    ...('options' in task ? { options: task.options.map(({ id }) => ({ id })) } : {}),
    ...('rows' in task ? { rows: task.rows.map(({ id }) => ({ id })) } : {}),
  });
  return isDeepStrictEqual(definition(a), definition(b));
}

export async function applyAssessmentPresentations(tx: Prisma.TransactionClient, items: Item[]): Promise<Item[]> {
  if (!items.length) return items;
  const rows = await tx.assessmentTaskVersion.findMany({ where: { taskId: { in: [...new Set(items.map((item) => item.taskId))] }, isPresentationCorrection: true },
    select: { taskId: true, version: true, data: true }, orderBy: { version: 'desc' } });
  const corrections = rows.map((row) => ({ ...row, data: StoredAssessmentTaskSchema.parse(row.data) }));
  return items.map((item) => {
    const correction = corrections.find((row) => row.taskId === item.taskId && row.version > item.version && assessmentPresentationCompatible(item.data.task, row.data.task));
    return correction ? { ...item, presentationVersion: correction.version, data: { ...item.data, statement: correction.data.statement, images: correction.data.images,
      solution: correction.data.solution, task: correction.data.task } } : item;
  });
}
