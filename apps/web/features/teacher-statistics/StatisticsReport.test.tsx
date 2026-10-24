import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AssessmentStatistics, ScoreDistribution } from '@continuum/shared';
import { StatisticsReportView } from './StatisticsReportScreen';
import { downloadStatisticsCsv } from './statistics-csv';

vi.mock('@/components/ContinuumHeader', () => ({ default: () => null }));
vi.mock('./statistics-csv', () => ({ downloadStatisticsCsv: vi.fn() }));
vi.mock('./StatisticsAnswerContent', () => ({ default: ({ recipient }: { recipient?: string }) => <section aria-label="Ответ ученика">{recipient ?? 'Условие задания'}</section> }));
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  return { useSearchParams: () => new URLSearchParams(useSyncExternalStore((callback) => { window.addEventListener('popstate', callback); return () => window.removeEventListener('popstate', callback); }, () => window.location.search)) };
});
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const distribution = (counts: number[], pendingCount = 1): ScoreDistribution => ({ scoredCount: counts.reduce((a, b) => a + b, 0), pendingCount, buckets: counts.map((count, points) => ({ points, count, percentage: counts.reduce((a, b) => a + b, 0) ? Math.round(1000 * count / counts.reduce((a, b) => a + b, 0)) / 10 : null })) });
const summary = { studentCount: 3, finalCount: 1, automatic: { maxPoints: 2, scoredCount: 2, averagePoints: 0.5 }, extended: { maxPoints: 3, scoredCount: 1, averagePoints: 3 }, total: { maxPoints: 5, scoredCount: 1, averagePoints: 4 } };
const data: AssessmentStatistics = {
  versionId: id(1), workId: id(2), title: 'Магнитное поле', versionNumber: 2,
  classes: [{ id: id(3), classId: id(4), title: '11А', academicYear: 2026 }, { id: id(5), classId: id(6), title: '11Б', academicYear: 2026 }],
  tasks: [{ id: id(7), stableId: 'matching', title: 'Сила Лоренца', gradeBand: 'grade_10_11', topicPath: ['Магнетизм'], type: 'matching', maxPoints: 2, version: 1, excerpt: '', source: { provider: 'Школково' } }, { id: id(8), stableId: 'extended', title: 'Работа газа', gradeBand: 'grade_10_11', topicPath: ['МКТ'], type: 'extended', maxPoints: 3, version: 1, excerpt: '', source: { provider: 'Школково' } }],
  students: [
    { id: id(10), assignmentId: id(3), name: 'Иванов Иван', login: 'ivanov', scores: [{ state: 'scored', points: 1 }, { state: 'scored', points: 3 }], automaticPoints: 1, extendedPoints: 3, totalPoints: 4 },
    { id: id(11), assignmentId: id(5), name: 'Петров Пётр', login: 'petrov', scores: [{ state: 'scored', points: 0 }, { state: 'awaiting_review' }], automaticPoints: 0, extendedPoints: null, totalPoints: null },
    { id: id(12), assignmentId: id(5), name: 'Сидоров Семён', login: 'sidorov', scores: [{ state: 'in_progress' }, { state: 'no_photos' }], automaticPoints: null, extendedPoints: null, totalPoints: null },
  ],
  summary, distributions: [distribution([1, 1, 0]), distribution([0, 0, 0, 1], 2)],
  classResults: [{ assignmentId: id(3), summary: { ...summary, studentCount: 1 }, distributions: [distribution([0, 1, 0], 0), distribution([0, 0, 0, 1], 0)] }, { assignmentId: id(5), summary: { ...summary, studentCount: 2 }, distributions: [distribution([1, 0, 0]), distribution([0, 0, 0, 0], 2)] }],
};
beforeEach(() => {
  vi.mocked(downloadStatisticsCsv).mockClear();
  history.replaceState(null, '', '/teacher/statistics/test');
  const original = history.pushState.bind(history);
  vi.spyOn(history, 'pushState').mockImplementation((...args) => { original(...args); window.dispatchEvent(new PopStateEvent('popstate')); });
});
afterEach(async () => {
  cleanup();
  // Radix restores focus on the next tick; finish it before Vitest replaces the DOM realm.
  await new Promise((resolve) => setTimeout(resolve, 0));
  vi.restoreAllMocks();
});
const table = () => screen.getByRole('region', { name: 'Распределение учеников по баллам' });
it('exports all filtered students across pages, respecting class, search, task and score; disables empty export', () => {
  const students = [...Array.from({ length: 25 }, (_, index) => ({ ...data.students[0], id: id(100 + index), name: `Иванов ${String(index + 1).padStart(2, '0')}` })), ...data.students.slice(1)];
  render(<StatisticsReportView data={{ ...data, students }} />);
  fireEvent.click(screen.getByRole('button', { name: 'По ученикам' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Класс' }), { target: { value: id(3) } });
  fireEvent.change(screen.getByRole('searchbox', { name: 'Поиск ученика' }), { target: { value: 'Иванов' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Задание' }), { target: { value: id(7) } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Полученный балл' }), { target: { value: '1' } });
  expect(within(screen.getByRole('region', { name: 'Баллы учеников по заданиям' })).getAllByRole('row')).toHaveLength(21);
  fireEvent.click(screen.getByRole('button', { name: /Скачать CSV/ }));
  expect(downloadStatisticsCsv).toHaveBeenCalledWith(expect.anything(), students.slice(0, 25), id(7));
  fireEvent.change(screen.getByRole('searchbox', { name: 'Поиск ученика' }), { target: { value: 'нет ученика' } });
  expect(screen.getByRole('button', { name: /Скачать CSV/ })).toBeDisabled();
  expect(screen.queryByText(/Прокрутите таблицу вправо/)).not.toBeInTheDocument();
});
it('uses one real table with stable point headers, mixed maxima and distinct pending counts', () => {
  const numberTask = { ...data.tasks[0], maxPoints: 1 };
  render(<StatisticsReportView data={{ ...data, tasks: [numberTask, data.tasks[1]] }} />);
  const grid = within(table());
  for (const label of ['0 баллов', '1 балл', '2 балла', '3 балла']) expect(grid.getByRole('columnheader', { name: label })).toBeVisible();
  const row = grid.getByRole('row', { name: /Сила Лоренца/ });
  expect(within(row).getAllByText('—')).toHaveLength(2);
  expect(within(row).getByRole('button', { name: 'Сила Лоренца: учтено 2 из 3' })).toBeVisible();
  expect(within(row).getByRole('button', { name: 'Сила Лоренца: без результата 1' })).toBeVisible();
  expect(screen.queryByText('Позиции соответствия')).not.toBeInTheDocument();
});
it('switches percentage to actual student counts without changing denominators and keeps it in the URL', () => {
  render(<StatisticsReportView data={data} />);
  const button = screen.getByRole('button', { name: /^Сила Лоренца: 1 балл,/ });
  expect(button).toHaveTextContent('50%');
  fireEvent.change(screen.getByRole('combobox', { name: 'Формат значений' }), { target: { value: 'count' } });
  expect(button).toHaveTextContent(/^1$/);
  expect(screen.getByText('Количество учеников с каждым баллом по заданию.')).toBeVisible();
  expect(screen.queryByText('Проценты — среди учеников с результатом по заданию.')).not.toBeInTheDocument();
  expect(window.location.search).toContain('unit=count');
  fireEvent.change(screen.getByRole('combobox', { name: 'Класс' }), { target: { value: id(3) } });
  expect(screen.getByRole('button', { name: 'Сила Лоренца: учтено 1 из 1' })).toBeVisible();
});
it('opens a task condition from the matrix header without changing filters or trial answers', async () => {
  history.replaceState(null, '', `/teacher/statistics/test?view=students&class=${id(3)}&task=${id(7)}&score=1&listSearch=МКТ&listClass=${id(4)}`);
  render(<StatisticsReportView data={data} />);
  const before = location.search;
  const origin = screen.getByRole('button', { name: 'Условие задания 1: Сила Лоренца' });
  origin.focus(); fireEvent.click(origin);
  expect(within(screen.getByRole('dialog')).getByText('Условие задания')).toBeVisible();
  expect(location.search).toBe(before);
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(origin).toHaveFocus());
  const back = new URL(screen.getByRole('link', { name: '← Статистика работ' }).getAttribute('href')!, 'http://localhost');
  expect(back.pathname).toBe('/teacher/statistics');
  expect(back.searchParams.get('search')).toBe('МКТ');
  expect(back.searchParams.get('class')).toBe(id(4));
});
it('opens the selected group on the right, drills into a real answer and restores focus after closing', async () => {
  render(<StatisticsReportView data={data} />);
  const origin = screen.getByRole('button', { name: /^Сила Лоренца: 1 балл,/ });
  origin.focus(); fireEvent.click(origin);
  const drawer = screen.getByRole('dialog');
  expect(window.location.search).not.toContain('view=students');
  expect(within(drawer).getByRole('button', { name: /Иванов Иван/ })).toBeVisible();
  expect(within(drawer).queryByRole('button', { name: /Петров/ })).not.toBeInTheDocument();
  fireEvent.click(within(drawer).getByRole('button', { name: /Иванов Иван/ }));
  expect(within(drawer).getByRole('region', { name: 'Ответ ученика' })).toHaveTextContent(id(10));
  fireEvent.click(within(drawer).getByRole('button', { name: 'К списку учеников' }));
  expect(within(drawer).getByRole('button', { name: /Иванов Иван/ })).toBeVisible();
  fireEvent.keyDown(document, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(origin).toHaveFocus());
});
it('moves from a group to a filtered matrix and keeps only the selected task column', () => {
  render(<StatisticsReportView data={data} />);
  fireEvent.click(screen.getByRole('button', { name: /^Сила Лоренца: 1 балл,/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Открыть в таблице учеников' }));
  expect(window.location.search).toContain('view=students');
  expect(window.location.search).toContain('score=1');
  const matrix = screen.getByRole('region', { name: 'Баллы учеников по заданиям' });
  expect(within(matrix).getByText('Иванов Иван')).toBeVisible();
  expect(within(matrix).queryByText('Петров Пётр')).not.toBeInTheDocument();
  expect(within(matrix).getAllByRole('columnheader')).toHaveLength(6);
});
it('keeps an unreviewed/no-photo group separate from zero and transfers its filter to the matrix', () => {
  render(<StatisticsReportView data={data} />);
  fireEvent.click(screen.getByRole('button', { name: 'Работа газа: без результата 2' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('Ожидает проверки')).toBeVisible();
  expect(within(dialog).getByText('Нет фото')).toBeVisible();
  expect(within(dialog).queryByText('Иванов Иван')).not.toBeInTheDocument();
  fireEvent.click(within(dialog).getByRole('button', { name: 'Открыть в таблице учеников' }));
  expect(window.location.search).toContain('result=pending');
  expect(screen.getByRole('combobox', { name: 'Полученный балл' })).toHaveValue('pending');
  expect(screen.getByText('Петров Пётр')).toBeVisible();
  expect(screen.queryByText('Иванов Иван')).not.toBeInTheDocument();
});
it('uses the same score columns for class comparison and retains the two-part summary', () => {
  render(<StatisticsReportView data={data} />);
  fireEvent.click(screen.getByRole('button', { name: 'Сравнение классов' }));
  const comparison = screen.getByRole('region', { name: 'Распределение баллов по классам' });
  expect(within(comparison).getByRole('row', { name: /11А/ })).toBeVisible();
  expect(within(comparison).getByRole('columnheader', { name: '3 балла' })).toBeVisible();
  fireEvent.change(screen.getByRole('searchbox', { name: 'Найти класс' }), { target: { value: '11А' } });
  expect(within(comparison).queryByRole('row', { name: /11Б/ })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'Сравнение классов' }), { target: { value: '' } });
  expect(screen.getByRole('columnheader', { name: 'Общий итог' })).toBeVisible();
  expect(screen.getByRole('row', { name: /11Б/ })).toBeVisible();
});
it('searches and sorts compact rows, restores URL state and resets empty searches', () => {
  render(<StatisticsReportView data={data} />);
  fireEvent.click(screen.getByRole('button', { name: 'Задание' }));
  expect(within(table()).getAllByRole('row')[2]).toHaveTextContent('Работа газа');
  expect(window.location.search).toContain('sort=title');
  fireEvent.change(screen.getByRole('searchbox', { name: 'Найти задание' }), { target: { value: 'нет такой задачи' } });
  expect(screen.getByText('По этим фильтрам ничего не найдено.')).toBeVisible();
  expect(screen.queryByText(/Прокрутите таблицу вправо/)).not.toBeInTheDocument();
  expect(screen.queryByText('Проценты — среди учеников с результатом по заданию.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Сбросить поиск' }));
  expect(within(table()).getAllByRole('row')).toHaveLength(4);
  history.replaceState(null, '', `/teacher/statistics/test?view=students&class=${id(5)}&task=${id(8)}&result=pending&unit=count`);
  fireEvent(window, new PopStateEvent('popstate'));
  expect(screen.getByRole('combobox', { name: 'Класс' })).toHaveValue(id(5));
  expect(screen.getByRole('combobox', { name: 'Полученный балл' })).toHaveValue('pending');
  expect(screen.getByText('Петров Пётр')).toBeVisible();
});
it('shows all supported point levels instead of silently truncating tasks above three points', () => {
  render(<StatisticsReportView data={{ ...data, tasks: [{ ...data.tasks[0], maxPoints: 5 }, data.tasks[1]], distributions: [distribution([1, 0, 0, 0, 0, 1]), data.distributions[1]] }} />);
  expect(within(table()).getByRole('columnheader', { name: '5 баллов' })).toBeVisible();
});
it('keeps all twenty task columns, compact profile names and one-line numbered headers with three pinned totals', () => {
  const tasks = Array.from({ length: 20 }, (_, index) => ({ ...data.tasks[0], id: id(200 + index), title: `Задание ${index + 1}` }));
  const student = { ...data.students[0], name: 'Анна Мария Петровна Иванова-Смирнова', displayName: 'Иванова-Смирнова Анна Мария', scores: tasks.map(() => ({ state: 'scored' as const, points: 1 })) };
  history.replaceState(null, '', '/teacher/statistics/test?view=students');
  render(<StatisticsReportView data={{ ...data, tasks, students: [student] }} />);
  const grid = within(screen.getByRole('region', { name: 'Баллы учеников по заданиям' }));
  expect(grid.getAllByRole('columnheader')).toHaveLength(25);
  expect(grid.getByRole('rowheader')).toHaveTextContent('Иванова-Смирнова Анна Мария');
  expect(grid.getByRole('rowheader')).not.toHaveTextContent('Петровна');
  expect(grid.getByRole('rowheader').querySelector('span')).toHaveAttribute('title', student.name);
  expect(grid.getByRole('button', { name: 'Условие задания 20: Задание 20' })).toHaveTextContent(/^20$/);
  expect(grid.queryByText('из 2')).not.toBeInTheDocument();
  const totals = ['Тест', 'Решения', 'Итог'].map((name) => grid.getByRole('columnheader', { name }));
  expect(totals.map((header) => header.style.right)).toEqual(['168px', '84px', '0px']);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Поиск ученика' }), { target: { value: 'Петровна' } });
  expect(grid.getByRole('rowheader')).toBeVisible();
});
