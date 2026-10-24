import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import type { AssignmentReport } from '@continuum/shared';
import { AssignmentReportView } from './AssignmentReportScreen';

vi.mock('@/components/ContinuumHeader', () => ({ default: () => null }));
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (listener: () => void) => { window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener); };
  return { useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search)) };
});
beforeEach(() => {
  sessionStorage.clear();
  history.replaceState({}, '', '/teacher/works/assignments/test');
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method].bind(history);
    vi.spyOn(history, method).mockImplementation((data, unused, url) => { original(data, unused, url); window.dispatchEvent(new PopStateEvent('popstate')); });
  }
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const data: AssignmentReport = { versionId: id(1), workId: id(2), title: 'МКТ', versionNumber: 1, taskCount: 6, maxPoints: 9, studentCount: 3, completedCount: 1,
  automaticTaskCount: 6, extendedTaskCount: 0, allPhotosCount: 0, allReviewsPublishedCount: 0,
  classes: [{ id: id(3), classId: id(4), title: '11А', academicYear: 2026 }, { id: id(5), classId: id(6), title: '11Б', academicYear: 2026 }],
  recipients: [
    { id: id(10), name: 'Не начал', login: 'first', assignmentId: id(3), isActive: true, deleted: false, status: 'not_started', answeredCount: 0, result: null, completedAt: null, progress: { photoTaskCount: 0, publishedReviewTaskCount: 0, resultReady: false } },
    { id: id(11), name: 'Всё заполнил', login: 'second', assignmentId: id(3), isActive: true, deleted: false, status: 'in_progress', answeredCount: 6, result: null, completedAt: null, progress: { photoTaskCount: 0, publishedReviewTaskCount: 0, resultReady: false } },
    { id: id(12), name: 'Завершивший', login: 'third', assignmentId: id(5), isActive: true, deleted: false, status: 'completed', answeredCount: 6, result: { points: 8, maxPoints: 9, percentage: 89, correctCount: 5, incorrectCount: 1 }, completedAt: '2026-10-17T00:00:00Z', progress: { photoTaskCount: 0, publishedReviewTaskCount: 0, resultReady: true } },
  ] };
it('uses five clearly labeled mixed-work columns without calling unpublished reviews checked', () => {
  render(<AssignmentReportView data={{ ...data, taskCount: 9, extendedTaskCount: 3, recipients: data.recipients.map((item) => ({ ...item, progress: { photoTaskCount: 2, publishedReviewTaskCount: 1, resultReady: false } })) }} />);
  expect(screen.getAllByRole('columnheader').map((item) => item.textContent)).toEqual(['Ученик', 'Класс', 'Тестовая часть', 'Решения', 'Проверка']);
  expect(screen.getAllByText('Опубликовано: 1 из 3')).toHaveLength(3);
  expect(screen.getByRole('combobox', { name: 'Тестовая часть' })).toBeVisible();
});
it('hides an absent test part and ignores its old URL filter for extended-only work', () => {
  history.replaceState({}, '', '/teacher/works/assignments/test?status=completed');
  render(<AssignmentReportView data={{ ...data, automaticTaskCount: 0, extendedTaskCount: 6 }} />);
  expect(screen.queryByRole('combobox', { name: 'Тестовая часть' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('columnheader').map((item) => item.textContent)).toEqual(['Ученик', 'Класс', 'Решения', 'Проверка']);
  expect(screen.getByRole('row', { name: /Всё заполнил/ })).toBeVisible();
});
it('separates completion from filled answers and filters by class/status without treating missing results as zero', () => {
  render(<AssignmentReportView data={data} />);
  const row = screen.getByRole('row', { name: /Всё заполнил/ });
  expect(within(row).getByText('В работе')).toBeVisible();
  expect(within(row).getByText('Заполнено 6 из 6')).toBeVisible();
  expect(within(row).queryByText(/0 из 9/)).not.toBeInTheDocument();
  expect(screen.getByText('8 из 9 · 89%')).toBeVisible();
  fireEvent.change(screen.getByRole('combobox', { name: 'Класс' }), { target: { value: id(3) } });
  expect(screen.queryByText('Завершивший')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'Тестовая часть' }), { target: { value: 'in_progress' } });
  expect(screen.getByText('Всё заполнил')).toBeVisible();
  expect(screen.queryByText('first')).not.toBeInTheDocument();
});

it('uses one status select next to search, updates counts within class/search scope and allows clearing the filter', () => {
  render(<AssignmentReportView data={data} />);
  const status = screen.getByRole('combobox', { name: 'Тестовая часть' });
  expect(status).toHaveValue('all');
  expect(within(status).getByRole('option', { name: 'Все — 3' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Все 3$/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'Класс' }), { target: { value: id(3) } });
  expect(within(status).getByRole('option', { name: 'Все — 2' })).toBeInTheDocument();
  expect(within(status).getByRole('option', { name: 'Завершили — 0' })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Поиск ученика' }), { target: { value: 'second' } });
  expect(within(status).getByRole('option', { name: 'Все — 1' })).toBeInTheDocument();
  fireEvent.change(status, { target: { value: 'completed' } });
  expect(screen.getByText('По этим фильтрам учеников нет.')).toBeVisible();
  fireEvent.change(status, { target: { value: 'all' } });
  expect(screen.getByText('Всё заполнил')).toBeVisible();
  expect(screen.queryByText('По этим фильтрам учеников нет.')).not.toBeInTheDocument();
});

it('resets pagination when the status selection changes', () => {
  const recipients = Array.from({ length: 25 }, (_, n) => ({ ...data.recipients[0], id: id(100 + n), name: `Ученик ${n + 1}` }));
  render(<AssignmentReportView data={{ ...data, recipients, studentCount: 25, completedCount: 0 }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
  expect(screen.getByText('21–25 из 25')).toBeVisible();
  fireEvent.change(screen.getByRole('combobox', { name: 'Тестовая часть' }), { target: { value: 'not_started' } });
  expect(screen.getByText('1–20 из 25')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Назад' })).toBeDisabled();
});

it('restores filters, page and private search on remount; Back/Forward restores URL filters', async () => {
  const recipients = Array.from({ length: 25 }, (_, n) => ({ ...data.recipients[0], id: id(100 + n), name: `Ученик ${n + 1}` }));
  const report = { ...data, recipients, studentCount: 25, completedCount: 0 };
  const view = render(<AssignmentReportView data={report} userId="teacher-a" />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Класс' }), { target: { value: id(3) } });
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Ученик' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Тестовая часть' }), { target: { value: 'not_started' } });
  fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
  expect(location.search).toContain('page=2');
  expect(decodeURIComponent(location.href)).not.toContain('Ученик');
  view.unmount(); render(<AssignmentReportView data={report} userId="teacher-a" />);
  expect(screen.getByRole('combobox', { name: 'Класс' })).toHaveValue(id(3));
  expect(screen.getByRole('combobox', { name: 'Тестовая часть' })).toHaveValue('not_started');
  expect(screen.getByRole('searchbox')).toHaveValue('Ученик');
  expect(screen.getByText('21–25 из 25')).toBeVisible();
  act(() => history.back()); await waitFor(() => expect(screen.getByText('1–20 из 25')).toBeVisible());
  act(() => history.forward()); await waitFor(() => expect(screen.getByText('21–25 из 25')).toBeVisible());
});

it('ignores invalid filters, removed classes and an out-of-range page', () => {
  history.replaceState({}, '', `/teacher/works/assignments/test?class=${id(99)}&status=invalid&page=10000000000000000`);
  render(<AssignmentReportView data={data} />);
  expect(screen.getByRole('combobox', { name: 'Класс' })).toHaveValue('');
  expect(screen.getByRole('combobox', { name: 'Тестовая часть' })).toHaveValue('all');
  expect(screen.getByText('1–3 из 3')).toBeVisible();
});

it('isolates search by teacher and report and keeps typing usable when storage is blocked', () => {
  const view = render(<AssignmentReportView data={data} userId="teacher-a" />);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'second' } });
  view.unmount();
  const other = render(<AssignmentReportView data={data} userId="teacher-b" />);
  expect(screen.getByRole('searchbox')).toHaveValue('');
  other.unmount();
  const anotherReport = render(<AssignmentReportView data={{ ...data, versionId: id(99) }} userId="teacher-a" />);
  expect(screen.getByRole('searchbox')).toHaveValue('');
  anotherReport.unmount();
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  render(<AssignmentReportView data={data} userId="teacher-a" />);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'second' } });
  expect(screen.getByText('Всё заполнил')).toBeVisible();
  expect(screen.getByRole('searchbox')).toHaveValue('second');
});
