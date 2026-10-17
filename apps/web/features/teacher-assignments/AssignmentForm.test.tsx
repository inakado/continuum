import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import type { AssignmentPrepare } from '@continuum/shared';
import AssignmentForm from './AssignmentForm';
import { teacherAssignmentsApi } from './teacher-assignments.api';

vi.mock('./teacher-assignments.api', () => ({ teacherAssignmentsApi: { assign: vi.fn() } }));
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const data: AssignmentPrepare = {
  work: { id: id(1), title: 'МКТ', gradeBand: 'grade_10_11', taskCount: 6, maxPoints: 9, revision: 2 },
  selection: { kind: 'draft', expectedRevision: 2 }, versions: [],
  classes: [2, 3].map((n) => ({ id: id(n), title: `11${n === 2 ? 'А' : 'Б'}`, grade: 11, academicYear: 2026, assignmentId: null, rosterHash: 'a'.repeat(64), students: [{ id: id(n + 10), name: `Ученик ${n}`, login: `student${n}`, isActive: true, alreadyAssigned: false }] })),
};
afterEach(() => { cleanup(); vi.clearAllMocks(); });
it('selects rosters, previews pupils and replays the exact assignment after a lost response', async () => {
  vi.mocked(teacherAssignmentsApi.assign).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({ versionId: id(20), versionNumber: 1, addedCount: 2 });
  const assigned = vi.fn();
  render(<QueryClientProvider client={new QueryClient()}><AssignmentForm data={data} onAssigned={assigned} onReload={vi.fn()} onVersionChange={vi.fn()} onPreview={vi.fn()} /></QueryClientProvider>);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Выбрать 11А' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Выбрать 11Б' }));
  expect(screen.getByText('Выбрано: 2 класса · 2 ученика')).toBeVisible();
  fireEvent.click(screen.getAllByRole('button', { name: 'Список учеников' })[0]);
  expect(screen.getByText('Ученик 2')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Назначить' }));
  await screen.findByRole('button', { name: 'Повторить назначение' });
  expect(screen.queryByText('Failed to fetch')).not.toBeInTheDocument();
  expect(screen.getByRole('checkbox', { name: 'Выбрать 11А' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Повторить назначение' }));
  await waitFor(() => expect(assigned).toHaveBeenCalledWith(id(20)));
  const calls = vi.mocked(teacherAssignmentsApi.assign).mock.calls;
  expect(calls[1]).toEqual(calls[0]);
  expect(calls[0][1].classes.map((item) => item.id)).toEqual([id(2), id(3)]);
});
