import { expect, it } from 'vitest';
import { moveWorkItem, workDropPosition } from './work-order';
it('moves a task to its final position without changing the task or source identity', () => {
  const tasks = [{ id: 'a', source: '11121' }, { id: 'b', source: '12246' }, { id: 'c', source: '65365' }];
  expect(moveWorkItem(tasks, 'a', 2)).toEqual([tasks[1], tasks[2], tasks[0]]);
  expect(moveWorkItem(tasks, 'c', 0)).toEqual([tasks[2], tasks[0], tasks[1]]);
  expect(moveWorkItem(tasks, 'a', -1)).toEqual(tasks);
  expect(tasks.map((task) => task.id)).toEqual(['a', 'b', 'c']);
});
it('computes before and after drop positions in both directions', () => {
  expect(workDropPosition(0, 2, false)).toBe(1);
  expect(workDropPosition(0, 2, true)).toBe(2);
  expect(workDropPosition(2, 0, false)).toBe(0);
  expect(workDropPosition(2, 0, true)).toBe(1);
});
