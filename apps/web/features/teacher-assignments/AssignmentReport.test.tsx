import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { AssignmentReport } from '@continuum/shared';
import { AssignmentReportView } from './AssignmentReportScreen';

vi.mock('@/components/ContinuumHeader', () => ({ default: () => null }));
afterEach(cleanup);
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const data: AssignmentReport = { versionId: id(1), workId: id(2), title: 'МКТ', versionNumber: 1, taskCount: 6, maxPoints: 9, studentCount: 3, completedCount: 1,
  classes: [{ id: id(3), classId: id(4), title: '11А', academicYear: 2026 }, { id: id(5), classId: id(6), title: '11Б', academicYear: 2026 }],
  recipients: [
    { id: id(10), name: 'Не начал', login: 'first', assignmentId: id(3), isActive: true, deleted: false, status: 'not_started', answeredCount: 0, result: null, completedAt: null },
    { id: id(11), name: 'Всё заполнил', login: 'second', assignmentId: id(3), isActive: true, deleted: false, status: 'in_progress', answeredCount: 6, result: null, completedAt: null },
    { id: id(12), name: 'Завершивший', login: 'third', assignmentId: id(5), isActive: true, deleted: false, status: 'completed', answeredCount: 6, result: { points: 8, maxPoints: 9, percentage: 89, correctCount: 5, incorrectCount: 1 }, completedAt: '2026-10-17T00:00:00Z' },
  ] };
it('separates completion from filled answers and filters by class/status without treating missing results as zero', () => {
  render(<AssignmentReportView data={data} />);
  const row = screen.getByRole('row', { name: /Всё заполнил/ });
  expect(within(row).getByText('В работе')).toBeVisible();
  expect(within(row).getByText('6 из 6')).toBeVisible();
  expect(within(row).getByText('—')).toBeVisible();
  expect(screen.getByText('8 из 9 · 89%')).toBeVisible();
  fireEvent.change(screen.getByRole('combobox', { name: 'Класс' }), { target: { value: id(3) } });
  expect(screen.queryByText('Завершивший')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'В работе 1' }));
  expect(screen.getByText('Всё заполнил')).toBeVisible();
  expect(screen.queryByText('first')).not.toBeInTheDocument();
});
