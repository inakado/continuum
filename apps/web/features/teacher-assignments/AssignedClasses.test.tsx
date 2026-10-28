import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import type { AssignmentReport } from '@continuum/shared';
import AssignedClasses from './AssignedClasses';
import { teacherAssignmentsApi } from './teacher-assignments.api';

vi.mock('./teacher-assignments.api', () => ({ teacherAssignmentsApi: { revocation: vi.fn(), revoke: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const report: AssignmentReport = { versionId: id(1), workId: id(2), title: 'Кинематика', versionNumber: 1, taskCount: 1, maxPoints: 1,
  automaticTaskCount: 1, extendedTaskCount: 0, studentCount: 2, completedCount: 0, allPhotosCount: 0, allReviewsPublishedCount: 0,
  classes: [{ id: id(3), classId: id(4), title: '11 Б', academicYear: 2026 }],
  recipients: [0, 1].map((n) => ({ id: id(10 + n), name: `Ученик ${n}`, login: `student${n}`, assignmentId: id(3), isActive: n === 0, deleted: false, status: 'not_started', answeredCount: 0, result: null, completedAt: null, progress: { photoTaskCount: 0, publishedReviewTaskCount: 0, resultReady: false } })),
};
const preview = { id: id(3), workId: id(2), versionId: id(1), title: 'Кинематика', classTitle: '11 Б', academicYear: 2026, studentCount: 2, startedCount: 0, completedCount: 0, recipientsHash: 'a'.repeat(64) };
function show(data = report) {
  const removed = vi.fn(), cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={cache}><AssignedClasses data={data} onRemoved={removed} /><button>Вне панели</button></QueryClientProvider>);
  return { removed, trigger: screen.getByRole('button', { name: /^Управлять назначением:/ }) };
}

it('opens by keyboard with snapshot recipient counts and returns focus on Escape without locking the page', async () => {
  const user = userEvent.setup(), { trigger } = show();
  expect(trigger).toHaveTextContent('11 Б · 2 ученика');
  trigger.focus(); await user.keyboard('{Enter}');
  const panel = screen.getByRole('dialog', { name: 'Кому назначена работа' });
  expect(within(panel).getByText('2026–2027 · 2 ученика')).toBeVisible();
  expect(document.body).not.toHaveAttribute('data-scroll-locked');
  expect(teacherAssignmentsApi.revocation).not.toHaveBeenCalled();
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(trigger).toHaveFocus();
});

it('closes the panel before confirmation, preserves the safe cancel focus and returns to the summary', async () => {
  vi.mocked(teacherAssignmentsApi.revocation).mockResolvedValue(preview);
  const user = userEvent.setup(), { trigger } = show();
  await user.click(trigger);
  await user.click(screen.getByRole('button', { name: 'Удалить назначение у класса 11 Б за 2026–2027' }));
  expect(await screen.findByText(/Учеников: 2/)).toBeVisible();
  expect(screen.getAllByRole('dialog')).toHaveLength(1);
  expect(screen.getByRole('dialog')).toHaveAccessibleName('Удалить назначение?');
  expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Отмена' }));
  await waitFor(() => expect(trigger).toHaveFocus());
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(teacherAssignmentsApi.revoke).not.toHaveBeenCalled();
});

it('keeps confirmation semantics and reports removal of the last assignment', async () => {
  vi.mocked(teacherAssignmentsApi.revocation).mockResolvedValue(preview);
  vi.mocked(teacherAssignmentsApi.revoke).mockResolvedValue({ id: id(3), workId: id(2), versionId: id(1) });
  const user = userEvent.setup(), { trigger, removed } = show();
  await user.click(trigger);
  await user.click(screen.getByRole('button', { name: /^Удалить назначение у класса/ }));
  await screen.findByText(/Учеников: 2/);
  await user.click(screen.getByRole('button', { name: 'Удалить назначение' }));
  await waitFor(() => expect(removed).toHaveBeenCalledWith(true));
  expect(teacherAssignmentsApi.revoke).toHaveBeenCalledWith({ id: id(3), input: { expectedRecipientsHash: preview.recipientsHash } }, expect.anything());
});

it('distinguishes equal class names by year and dismisses outside without opening a destructive preview', async () => {
  const user = userEvent.setup(), { trigger } = show({ ...report, classes: [...report.classes, { ...report.classes[0], id: id(5), academicYear: 2025, classId: null }] });
  expect(trigger).toHaveTextContent('2 класса · 2 ученика');
  await user.click(trigger);
  expect(screen.getByText('2025–2026 · 0 учеников')).toBeVisible();
  expect(screen.getByText('Класс удалён')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Удалить назначение у класса 11 Б за 2025–2026' })).toBeVisible();
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Вне панели' }), { pointerType: 'mouse' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(teacherAssignmentsApi.revocation).not.toHaveBeenCalled();
});

it('keeps five classes compact in the summary and shows all of their snapshot counts on demand', async () => {
  const classes = ['11 А', '11 Б', '10 А', '10 Б', '10 В'].map((title, index) => ({ ...report.classes[0], id: id(100 + index), title }));
  const recipients = classes.flatMap((group, index) => Array.from({ length: 24 }, (_, n) => ({ ...report.recipients[0], id: id(1000 + index * 100 + n), assignmentId: group.id })));
  const user = userEvent.setup(), { trigger } = show({ ...report, classes, recipients, studentCount: 120 });
  expect(trigger).toHaveTextContent('5 классов · 120 учеников');
  await user.click(trigger);
  const panel = screen.getByRole('dialog', { name: 'Кому назначена работа' });
  expect(within(panel).getAllByRole('listitem')).toHaveLength(5);
  expect(within(panel).getAllByText('2026–2027 · 24 ученика')).toHaveLength(5);
  expect(within(panel).getAllByRole('button', { name: /^Удалить назначение у класса/ })).toHaveLength(5);
});
