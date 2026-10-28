import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import AssignmentsListScreen from './AssignmentsListScreen';

const state = vi.hoisted(() => ({ automaticTaskCount: 6, extendedTaskCount: 3 }));
vi.mock('@/components/ContinuumHeader', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('./use-assignments', () => ({ useAssignments: () => ({ data: [{ versionId: 'version', title: 'Термодинамика', versionNumber: 1, classes: [{ title: '11А' }], studentCount: 20, completedCount: 12, allPhotosCount: 8, allReviewsPublishedCount: 5, ...state }] }) }));
beforeEach(() => { state.automaticTaskCount = 6; state.extendedTaskCount = 3; });
it('labels all three independent counts in students rather than files or total completed work', () => {
  render(<AssignmentsListScreen />);
  expect(screen.getByText('Тест завершили: 12 из 20')).toBeVisible();
  expect(screen.getByText('Все решения: 8 из 20 учеников')).toBeVisible();
  expect(screen.getByText('Решения проверены: 5 из 20 учеников')).toBeVisible();
});
it('omits zero-task aggregates for automatic-only and extended-only work', () => {
  state.extendedTaskCount = 0;
  const view = render(<AssignmentsListScreen />);
  expect(screen.queryByText(/Все решения/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Решения проверены/)).not.toBeInTheDocument();
  view.unmount(); state.automaticTaskCount = 0; state.extendedTaskCount = 3;
  render(<AssignmentsListScreen />);
  expect(screen.queryByText(/Тест завершили/)).not.toBeInTheDocument();
});
