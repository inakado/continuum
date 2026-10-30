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
// Presentation ignores option/row text; grading corrections additionally opt out of key equality. Metadata and answer identities stay pinned.
function definition(task: AssessmentPackageTask, omitGrading = false) {
  return { ...task,
    ...(omitGrading && 'grading' in task ? { grading: null } : {}),
    ...('options' in task ? { options: task.options.map(({ id }) => ({ id })) } : {}),
    ...('rows' in task ? { rows: task.rows.map(({ id }) => ({ id })) } : {}),
  };
}
export function assessmentPresentationCompatible(a: AssessmentPackageTask, b: AssessmentPackageTask) {
  return isDeepStrictEqual(definition(a), definition(b));
}

export function assessmentGradingCompatible(a: AssessmentPackageTask, b: AssessmentPackageTask) {
  return a.type !== 'extended' && b.type !== 'extended' && isDeepStrictEqual(definition(a, true), definition(b, true));
}

export async function applyAssessmentPresentations(tx: Prisma.TransactionClient, items: Item[]): Promise<Item[]> {
  if (!items.length) return items;
  const rows = await tx.assessmentTaskVersion.findMany({ where: { taskId: { in: [...new Set(items.map(item => item.taskId))] }, isPresentationCorrection: true },
    select: { taskId: true, version: true, data: true, gradingSourceVersion: true }, orderBy: { version: 'asc' } });
  const refs = rows.filter(row => row.gradingSourceVersion != null).map(row => ({ taskId: row.taskId, version: row.gradingSourceVersion! }));
  const sources = refs.length ? await tx.assessmentTaskVersion.findMany({ where: { OR: refs }, select: { taskId: true, version: true, data: true } }) : [];
  const sourceById = new Map(sources.map(row => [`${row.taskId}:${row.version}`, StoredAssessmentTaskSchema.parse(row.data).task]));
  const corrections = rows.map(row => ({ ...row, data: StoredAssessmentTaskSchema.parse(row.data) }));
  return items.map(item => {
    let current = item;
    for (const correction of corrections) {
      if (correction.taskId !== item.taskId || correction.version <= (current.presentationVersion ?? current.version)) continue;
      const source = correction.gradingSourceVersion != null ? sourceById.get(`${item.taskId}:${correction.gradingSourceVersion}`) : correction.data.task;
      if (!source || !assessmentPresentationCompatible(current.data.task, source)) continue;
      current = { ...current, presentationVersion: correction.version, data: correction.data };
    }
    return current;
  });
}
