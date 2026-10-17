import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { ASSESSMENT_WORK_TASK_LIMIT, type AssessmentTaskView } from '@continuum/shared';
import { useWorkArrangement } from './use-work-arrangement';

it('does not restore a removed task above the work limit', () => {
  const item: AssessmentTaskView = {
    id: 'removed', version: 1, statement: 'Условие', solution: null, images: {},
    task: { id: 'task', title: 'Задание', gradeBand: 'grade_10_11', topicPath: ['МКТ'], type: 'short_number', maxPoints: 1, source: { provider: 'Авторское' }, grading: { answer: '1', absoluteTolerance: 0 } },
  };
  const change = vi.fn();
  const { result, rerender } = renderHook(({ items }) => useWorkArrangement(items, change), { initialProps: { items: [item] } });
  act(() => result.current.remove(item, 0));
  expect(change).toHaveBeenLastCalledWith([]);
  const full = Array.from({ length: ASSESSMENT_WORK_TASK_LIMIT }, (_, index) => ({ ...item, id: `task-${index}` }));
  rerender({ items: full });
  change.mockClear();
  act(() => result.current.undo());
  expect(change).not.toHaveBeenCalled();
  expect(result.current.announcement).toContain('500 заданий');
  rerender({ items: full.slice(1) });
  act(() => result.current.undo());
  expect(change.mock.calls[0][0]).toHaveLength(ASSESSMENT_WORK_TASK_LIMIT);
  expect(change.mock.calls[0][0][0].id).toBe('removed');
});
