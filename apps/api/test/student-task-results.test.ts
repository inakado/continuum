import { expect, it } from 'vitest';
import { attemptState, type WorkSnapshot } from '../src/assessment-assignments/assignment-data';

const id = '00000000-0000-4000-8000-000000000001';
const extended = '00000000-0000-4000-8000-000000000002';
const task = { id: 'matching', title: 'Соответствие', gradeBand: 'grade_10_11' as const, topicPath: ['Механика'], source: { provider: 'Авторское' }, maxPoints: 2,
  type: 'matching' as const, rows: [{ id: 'a', content: 'А' }, { id: 'b', content: 'Б' }], options: [{ id: '1', content: '1' }, { id: '2', content: '2' }], grading: { policy: 'ege_physics_matching_v1' as const, matches: { a: '1', b: '2' } } };
const data = { task, statement: 'Условие', solution: 'Секрет', hash: 'hash', images: [] };
const snapshot: WorkSnapshot = { title: 'Работа', instructions: '', gradeBand: 'grade_10_11', items: [{ taskId: id, version: 1, data }, { taskId: extended, version: 1, data: { ...data, task: { ...task, id: 'extended', type: 'extended', grading: { criteria: 'Критерии' } } } }] };
const row = { revision: 2, startedAt: new Date(), completedAt: null, answeredCount: 1, correctCount: 0, incorrectCount: 0, points: 1, answers: { [id]: { type: 'matching', matches: { a: '1' } } } };
it('never exposes task scores before completion or in list projections', () => {
  expect(attemptState(row, snapshot)).not.toHaveProperty('taskResults');
  const { answers, ...listRow } = row;
  expect(attemptState({ ...listRow, completedAt: new Date() }, snapshot)).not.toHaveProperty('taskResults');
});
it('returns only points from pinned grading after completion, including missing and partial answers', () => {
  for (const [matches, points] of [[{}, 0], [{ a: '1' }, 1], [{ a: '1', b: '2' }, 2]] as const) {
    const state = attemptState({ ...row, completedAt: new Date(), answers: { [id]: { type: 'matching', matches } } }, snapshot);
    expect(state.taskResults).toEqual({ [id]: { points, maxPoints: 2 } });
    expect(JSON.stringify(state)).not.toContain('Секрет');
    expect(state.taskResults).not.toHaveProperty(extended);
  }
  expect(attemptState({ ...row, completedAt: new Date(), answers: {} }, snapshot).taskResults?.[id].points).toBe(0);
});
