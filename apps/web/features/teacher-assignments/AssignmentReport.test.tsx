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
it('labels both work parts and counts only published reviews', () => {
  render(<AssignmentReportView data={{ ...data, taskCount: 9, extendedTaskCount: 3, recipients: data.recipients.map((item) => ({ ...item, progress: { photoTaskCount: 2, publishedReviewTaskCount: 1, resultReady: false } })) }} />);
  expect(screen.getAllByRole('columnheader').map((item) => item.textContent)).toEqual(['Ученик', 'Класс', 'Тестовая часть', 'Развёрнутая часть', 'Проверка решений']);
  expect(screen.getAllByText('Проверено: 1 из 3')).toHaveLength(3);
  expect(screen.getByRole('group', { name: 'Тестовая часть' })).toBeVisible();
  expect(screen.getAllByRole('button', { name: /^Открыть решения:/ })).toHaveLength(3);
  expect(screen.queryByText(/Фото считаются|не файлами|а не файлам/)).not.toBeInTheDocument();
});
it('hides an absent test part and ignores its old URL filter for extended-only work', () => {
  history.replaceState({}, '', '/teacher/works/assignments/test?status=completed');
  render(<AssignmentReportView data={{ ...data, automaticTaskCount: 0, extendedTaskCount: 6 }} />);
  expect(screen.queryByRole('group', { name: 'Тестовая часть' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('columnheader').map((item) => item.textContent)).toEqual(['Ученик', 'Класс', 'Развёрнутая часть', 'Проверка решений']);
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
  fireEvent.click(screen.getByRole('button', { name: /^В работе \d+$/ }));
  expect(screen.getByText('Всё заполнил')).toBeVisible();
  expect(screen.queryByText('first')).not.toBeInTheDocument();
});

it('exposes status counts in the class/search scope and allows clearing an empty filter', () => {
  render(<AssignmentReportView data={data} />);
  const statuses = screen.getByRole('group', { name: 'Тестовая часть' });
  expect(within(statuses).getByRole('button', { name: 'Все 3' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.change(screen.getByRole('combobox', { name: 'Класс' }), { target: { value: id(3) } });
  expect(within(statuses).getByRole('button', { name: 'Все 2' })).toBeVisible();
  expect(within(statuses).getByRole('button', { name: 'Завершили 0' })).toBeEnabled();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Поиск ученика' }), { target: { value: 'second' } });
  expect(within(statuses).getByRole('button', { name: 'Все 1' })).toBeVisible();
  fireEvent.click(within(statuses).getByRole('button', { name: 'Завершили 0' }));
  expect(screen.getByText('По этим фильтрам учеников нет.')).toBeVisible();
  fireEvent.click(within(statuses).getByRole('button', { name: 'Все 1' }));
  expect(screen.getByText('Всё заполнил')).toBeVisible();
  expect(screen.queryByText('По этим фильтрам учеников нет.')).not.toBeInTheDocument();
});

it('resets pagination when the status selection changes', () => {
  const recipients = Array.from({ length: 25 }, (_, n) => ({ ...data.recipients[0], id: id(100 + n), name: `Ученик ${n + 1}` }));
  render(<AssignmentReportView data={{ ...data, recipients, studentCount: 25, completedCount: 0 }} />);
  fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
  expect(screen.getByText('21–25 из 25')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /^Не начали \d+$/ }));
  expect(screen.getByText('1–20 из 25')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Назад' })).toBeDisabled();
});

it('restores filters, page and private search on remount; Back/Forward restores URL filters', async () => {
  const recipients = Array.from({ length: 25 }, (_, n) => ({ ...data.recipients[0], id: id(100 + n), name: `Ученик ${n + 1}` }));
  const report = { ...data, recipients, studentCount: 25, completedCount: 0 };
  const view = render(<AssignmentReportView data={report} userId="teacher-a" />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Класс' }), { target: { value: id(3) } });
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Ученик' } });
  fireEvent.click(screen.getByRole('button', { name: /^Не начали \d+$/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
  expect(location.search).toContain('page=2');
  expect(decodeURIComponent(location.href)).not.toContain('Ученик');
  view.unmount(); render(<AssignmentReportView data={report} userId="teacher-a" />);
  expect(screen.getByRole('combobox', { name: 'Класс' })).toHaveValue(id(3));
  expect(screen.getByRole('button', { name: /^Не начали \d+$/ })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('searchbox')).toHaveValue('Ученик');
  expect(screen.getByText('21–25 из 25')).toBeVisible();
  act(() => history.back()); await waitFor(() => expect(screen.getByText('1–20 из 25')).toBeVisible());
  act(() => history.forward()); await waitFor(() => expect(screen.getByText('21–25 из 25')).toBeVisible());
});

it('ignores invalid filters, removed classes and an out-of-range page', () => {
  history.replaceState({}, '', `/teacher/works/assignments/test?class=${id(99)}&status=invalid&page=10000000000000000`);
  render(<AssignmentReportView data={data} />);
  expect(screen.getByRole('combobox', { name: 'Класс' })).toHaveValue('');
  expect(screen.getByRole('button', { name: /^Все \d+$/ })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByText('1–3 из 3')).toBeVisible();
});

it('hides a redundant single-class filter and normalizes its old URL while preserving other filters and page', () => {
  history.replaceState({}, '', `/teacher/works/assignments/test?class=${id(3)}&status=not_started&photos=none&page=2`);
  const recipients = Array.from({ length: 25 }, (_, n) => ({ ...data.recipients[0], id: id(100 + n), name: `Ученик ${n + 1}` }));
  render(<AssignmentReportView data={{ ...data, classes: data.classes.slice(0, 1), recipients, studentCount: 25, completedCount: 0, extendedTaskCount: 2 }} />);
  expect(screen.queryByRole('combobox', { name: 'Класс' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /^Управлять назначением:/ })).toHaveTextContent('11А · 25 учеников');
  expect(screen.getByText('21–25 из 25')).toBeVisible();
  expect(location.search).not.toContain('class=');
  expect(location.search).toContain('status=not_started');
  expect(location.search).toContain('photos=none');
  expect(location.search).toContain('page=2');
});

it('keeps assignment metadata outside the filters and independent of the displayed students', () => {
  render(<AssignmentReportView data={data} />);
  const summary = screen.getByRole('button', { name: /^Управлять назначением:/ });
  expect(summary).toHaveTextContent('11А, 11Б · 3 ученика');
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'second' } });
  expect(screen.getByText('1–1 из 1')).toBeVisible();
  expect(summary).toHaveTextContent('11А, 11Б · 3 ученика');
  expect(screen.queryByText(/^Назначенные классы:/)).not.toBeInTheDocument();
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

it('filters photos independently from test completion, with counts scoped by the other filters', () => {
  const report = { ...data, extendedTaskCount: 2, recipients: [
    { ...data.recipients[0], name: 'Без фотографий' },
    { ...data.recipients[1], name: 'Фото частично', progress: { photoTaskCount: 1, publishedReviewTaskCount: 0, resultReady: false } },
    { ...data.recipients[2], name: 'Все фото', progress: { photoTaskCount: 2, publishedReviewTaskCount: 1, resultReady: false } },
    { ...data.recipients[2], id: id(13), name: 'Все опубликованы', progress: { photoTaskCount: 2, publishedReviewTaskCount: 2, resultReady: true } },
  ] };
  render(<AssignmentReportView data={report} />);
  const photos = screen.getByRole('combobox', { name: 'Развёрнутая часть' });
  fireEvent.change(photos, { target: { value: 'awaiting_review' } });
  expect(screen.getByText('Фото частично')).toBeVisible();
  expect(screen.getByText('Все фото')).toBeVisible();
  expect(screen.queryByText('Все опубликованы')).not.toBeInTheDocument();
  expect(screen.queryByText('Без фотографий')).not.toBeInTheDocument();
  expect(location.search).toContain('photos=awaiting_review');
  const status = screen.getByRole('group', { name: 'Тестовая часть' });
  expect(within(status).getByRole('button', { name: 'Завершили 1' })).toBeVisible();
  fireEvent.click(within(status).getByRole('button', { name: /^Завершили \d+$/ }));
  expect(within(photos).getByRole('option', { name: 'Все — 2' })).toBeInTheDocument();
  expect(screen.getByText('Все фото')).toBeVisible();
  expect(screen.queryByText('Фото частично')).not.toBeInTheDocument();
  fireEvent.change(photos, { target: { value: 'none' } });
  expect(screen.getByText('По этим фильтрам учеников нет.')).toBeVisible();
  fireEvent.click(within(status).getByRole('button', { name: /^Все \d+$/ }));
  expect(screen.getByText('Без фотографий')).toBeVisible();
  fireEvent.change(photos, { target: { value: 'partial' } });
  expect(screen.getByText('Фото частично')).toBeVisible();
  fireEvent.change(photos, { target: { value: 'uploaded' } });
  expect(screen.getByText('Все фото')).toBeVisible();
  expect(screen.getByText('Все опубликованы')).toBeVisible();
  fireEvent.change(photos, { target: { value: 'published' } });
  expect(screen.getByText('Все опубликованы')).toBeVisible();
  expect(screen.queryByText('Все фото')).not.toBeInTheDocument();
});

it('resets the page on photo filtering, restores URL state and ignores photos for automatic-only work', () => {
  history.replaceState({}, '', '/teacher/works/assignments/test?photos=none&page=2');
  const recipients = Array.from({ length: 25 }, (_, n) => ({ ...data.recipients[0], id: id(100 + n), name: `Ученик ${n + 1}` }));
  const view = render(<AssignmentReportView data={{ ...data, recipients, extendedTaskCount: 2 }} />);
  expect(screen.getByText('21–25 из 25')).toBeVisible();
  expect(screen.getByRole('combobox', { name: 'Развёрнутая часть' })).toHaveValue('none');
  fireEvent.change(screen.getByRole('combobox', { name: 'Развёрнутая часть' }), { target: { value: 'partial' } });
  expect(location.search).not.toContain('page=');
  view.unmount();
  render(<AssignmentReportView data={data} />);
  expect(screen.queryByRole('combobox', { name: 'Развёрнутая часть' })).not.toBeInTheDocument();
  expect(screen.getByText('Всё заполнил')).toBeVisible();
});
