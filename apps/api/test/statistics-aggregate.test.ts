import { expect, it } from 'vitest';
import type { WorkSnapshot } from '../src/assessment-assignments/assignment-data';
import { buildStatistics, type StatisticsRecipient } from '../src/assessment-assignments/statistics-aggregate';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const base = { title: 'Задание', gradeBand: 'grade_10_11' as const, topicPath: ['Физика'], source: { provider: 'Авторское' } };
const snapshot: WorkSnapshot = { title: 'Статистика', instructions: '', gradeBand: 'grade_10_11', items: [
  { taskId: id(1), version: 1, data: { task: { ...base, id: 'matching', type: 'matching', maxPoints: 2, rows: [{ id: 'a', content: 'A' }, { id: 'b', content: 'Б' }], options: [{ id: '1', content: 'Первый' }, { id: '2', content: 'Второй' }], grading: { policy: 'ege_physics_matching_v1', matches: { a: '1', b: '2' } } }, statement: 'Условие', solution: null, hash: 'hash', images: [] } },
  { taskId: id(2), version: 1, data: { task: { ...base, id: 'extended', type: 'extended', maxPoints: 3 }, statement: 'Развёрнутая', solution: null, hash: 'hash2', images: [] } },
] };
const groups = [{ id: id(10), classId: id(11), title: '11А', academicYear: 2026 }, { id: id(20), classId: id(21), title: '11Б', academicYear: 2026 }];
const student = (n: number, patch: Partial<StatisticsRecipient> = {}): StatisticsRecipient => ({ id: id(100 + n), assignmentId: groups[0].id, studentName: `Ученик ${n}`, studentLogin: `student${n}`, startedAt: new Date(), completedAt: new Date(), points: 0, answers: {}, ...patch });
it('uses exact score buckets and finalized denominators, not the percentage of points earned', () => {
  const rows = [student(1, { points: 2, answers: { [id(1)]: { type: 'matching', matches: { a: '1', b: '2' } } } }), student(2, { points: 1, answers: { [id(1)]: { type: 'matching', matches: { a: '1' } } } }), student(3), student(4, { completedAt: null }), student(5, { completedAt: null, startedAt: null, assignmentId: groups[1].id })];
  const stats = buildStatistics(snapshot, rows, [{ recipientId: rows[0].id, taskId: id(2), hasPhotos: true, points: 0 }, { recipientId: rows[1].id, taskId: id(2), hasPhotos: true, points: null }], groups);
  expect(stats.distributions[0]).toEqual({ scoredCount: 3, pendingCount: 2, buckets: [0, 1, 2].map((points) => ({ points, count: 1, percentage: 33.3 })) });
  expect(stats.distributions[1].buckets).toEqual([0, 1, 2, 3].map((points) => ({ points, count: points === 0 ? 1 : 0, percentage: points === 0 ? 100 : 0 })));
  expect(stats.students[1].scores[1]).toEqual({ state: 'awaiting_review' });
  expect(stats.summary).toEqual({ studentCount: 5, finalCount: 1, automatic: { maxPoints: 2, scoredCount: 3, averagePoints: 1 }, extended: { maxPoints: 3, scoredCount: 1, averagePoints: 0 }, total: { maxPoints: 5, scoredCount: 1, averagePoints: 2 } });
  expect(stats.classResults[1].distributions[0]).toMatchObject({ scoredCount: 0, pendingCount: 1, buckets: [{ points: 0, count: 0, percentage: null }, { points: 1, count: 0, percentage: null }, { points: 2, count: 0, percentage: null }] });
});
it('preserves historical totals and pinned exact grading instead of applying EGE to old work', () => {
  const old = structuredClone(snapshot);
  const task = old.items[0].data.task;
  if (task.type === 'matching') delete task.grading.policy;
  const partial = student(1, { answers: { [id(1)]: { type: 'matching', matches: { a: '1' } } } });
  expect(buildStatistics(old, [partial], [], groups).students[0].scores[0]).toEqual({ state: 'scored', points: 0 });
  const inconsistent = buildStatistics(snapshot, [student(2, { points: 2 })], [], groups);
  expect(inconsistent.students[0].scores[0]).toEqual({ state: 'unavailable' });
  expect(inconsistent.students[0].automaticPoints).toBe(2);
  expect(inconsistent.distributions[0].scoredCount).toBe(0);
});
it('handles absent parts, empty classes and known zero without inventing zero results', () => {
  const extended = { ...snapshot, items: [snapshot.items[1]] };
  const row = student(1, { completedAt: null, points: null });
  const stats = buildStatistics(extended, [row], [{ recipientId: row.id, taskId: id(2), hasPhotos: true, points: 3 }], groups);
  expect(stats.students[0].totalPoints).toBe(3);
  expect(stats.summary.automatic).toEqual({ maxPoints: 0, scoredCount: 0, averagePoints: null });
  expect(stats.classResults[1].summary.total.averagePoints).toBeNull();
  const automatic = buildStatistics({ ...snapshot, items: [snapshot.items[0]] }, [student(1)], [], groups);
  expect(automatic.students[0].totalPoints).toBe(0);
  expect(automatic.summary.extended.averagePoints).toBeNull();
});
