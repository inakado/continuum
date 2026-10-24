import { expect, it, vi } from 'vitest';
import type { Prisma } from '@prisma/client';
import { readWorkProgress } from '../src/assessment-assignments/work-progress';

const scope = { id: 'student', completedAt: null, automaticTaskCount: 1, extendedTaskIds: ['task-1', 'task-2'] };
const answer = { id: 'answer', recipientId: 'student', taskId: 'task-1', revision: 3, _count: { photos: 2 }, review: { id: 'review', publishedRevision: 2 } };
const version = { reviewId: 'review', revision: 2, sourceRevision: 3, points: 0, report: { solutionId: 'answer', sourceRevision: 3, confirmedAt: new Date() } };
function database(answers = [answer], versions: object[] = [version]) {
  return { assessmentSolutionAnswer: { findMany: vi.fn().mockResolvedValue(answers) }, assessmentReviewVersion: { findMany: vi.fn().mockResolvedValue(versions) } } as unknown as Prisma.TransactionClient;
}
it('counts tasks rather than photos, includes zero-point publication and waits for both independent parts', async () => {
  const rows = [answer, { ...answer, id: 'answer-2', taskId: 'task-2' }, { ...answer, id: 'unrelated', taskId: 'not-in-snapshot' }];
  const partial = (await readWorkProgress(database(rows), [scope])).get(scope.id);
  expect(partial).toEqual({ photoTaskCount: 2, publishedReviewTaskCount: 1, resultReady: false });
  const reviewed = { ...answer, id: 'answer-2', taskId: 'task-2', review: { id: 'review-2', publishedRevision: 1 } };
  const db = database([answer, reviewed], [version, { ...version, reviewId: 'review-2', revision: 1, report: { ...version.report, solutionId: 'answer-2' } }]);
  expect((await readWorkProgress(db, [scope])).get(scope.id)?.resultReady).toBe(false);
  expect((await readWorkProgress(db, [{ ...scope, completedAt: new Date() }])).get(scope.id)?.resultReady).toBe(true);
  expect((await readWorkProgress(db, [{ ...scope, automaticTaskCount: 0 }])).get(scope.id)?.resultReady).toBe(true);
});
it('does not treat stale, unconfirmed, foreign or scoreless reports as published results', async () => {
  for (const invalid of [
    { ...version, sourceRevision: 2 }, { ...version, points: null }, { ...version, report: null },
    { ...version, report: { ...version.report, confirmedAt: null } },
    { ...version, report: { ...version.report, solutionId: 'someone-else' } },
    { ...version, report: { ...version.report, sourceRevision: 2 } },
  ]) expect((await readWorkProgress(database([answer], [invalid]), [scope])).get(scope.id)?.publishedReviewTaskCount).toBe(0);
});
it('handles automatic-only work without querying photo metadata', async () => {
  const db = database();
  const automatic = { ...scope, extendedTaskIds: [] };
  expect((await readWorkProgress(db, [automatic])).get(scope.id)).toEqual({ photoTaskCount: 0, publishedReviewTaskCount: 0, resultReady: false });
  expect((await readWorkProgress(db, [{ ...automatic, completedAt: new Date() }])).get(scope.id)?.resultReady).toBe(true);
  expect(db.assessmentSolutionAnswer.findMany).not.toHaveBeenCalled();
});
