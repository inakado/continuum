import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AssignmentSummary } from '@continuum/shared';
import StatisticsListScreen from './StatisticsListScreen';
import { statisticsListHref, statisticsReportHref } from './use-statistics-list-filters';

vi.mock('@/features/teacher-works/WorksShell', () => ({ default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock('@/features/teacher-assignments/use-assignments', () => ({ useAssignments: () => ({ data: works, isPending: false, error: null }) }));
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  return { useSearchParams: () => new URLSearchParams(useSyncExternalStore((callback) => { window.addEventListener('popstate', callback); return () => window.removeEventListener('popstate', callback); }, () => window.location.search)) };
});
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const group = (n: number, classId: string | null, title: string) => ({ id: id(n), classId, title, academicYear: 2026 });
const work = (n: number, title: string, classes: AssignmentSummary['classes']): AssignmentSummary => ({ versionId: id(n), workId: id(n + 100), title, versionNumber: n, classes, taskCount: 3, maxPoints: 5, automaticTaskCount: 3, extendedTaskCount: 0, studentCount: 20, completedCount: 10, allPhotosCount: 0, allReviewsPublishedCount: 0 });
const works = [work(1, 'Магнитное поле', [group(11, id(21), '11А'), group(12, id(22), '11Б')]), work(2, 'МКТ', [group(13, id(22), '11Б')]), work(3, 'Магнитное поле · вариант 2', [group(14, id(21), '11А')])];
beforeEach(() => {
  history.replaceState(null, '', '/teacher/statistics');
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method].bind(history);
    vi.spyOn(history, method).mockImplementation((...args) => { original(...args); window.dispatchEvent(new PopStateEvent('popstate')); });
  }
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('keeps list filters after remount/refresh and maps the school class to each version assignment', () => {
  const view = render(<StatisticsListScreen />);
  fireEvent.change(screen.getByRole('searchbox', { name: 'Поиск работы' }), { target: { value: 'Магнит' } });
  expect(history.replaceState).toHaveBeenCalledOnce();
  expect(history.pushState).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('combobox', { name: 'Класс' }), { target: { value: id(21) } });
  expect(history.pushState).toHaveBeenCalledOnce();
  const links = screen.getAllByRole('link');
  expect(links).toHaveLength(2);
  expect(new URL(links[0].getAttribute('href')!, 'http://localhost').searchParams.get('class')).toBe(id(11));
  expect(new URL(links[1].getAttribute('href')!, 'http://localhost').searchParams.get('class')).toBe(id(14));
  const back = statisticsListHref(new URLSearchParams(links[0].getAttribute('href')!.split('?')[1]));
  expect(back).toBe(`${location.pathname}${location.search}`);
  view.unmount(); render(<StatisticsListScreen />);
  expect(screen.getByRole('searchbox')).toHaveValue('Магнит');
  expect(screen.getByRole('combobox', { name: 'Класс' })).toHaveValue(id(21));
});

it('restores history, handles a removed class as All and resets an empty result in one action', () => {
  render(<StatisticsListScreen />);
  act(() => history.replaceState(null, '', `/teacher/statistics?search=МКТ&class=${id(22)}`));
  expect(screen.getAllByRole('link')).toHaveLength(1);
  act(() => { history.replaceState(null, '', `/teacher/statistics?class=${id(999)}`); window.dispatchEvent(new PopStateEvent('popstate')); });
  expect(screen.getByRole('combobox', { name: 'Класс' })).toHaveValue('');
  expect(screen.getAllByRole('link')).toHaveLength(3);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'нет работы' } });
  fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
  expect(location.search).toBe('');
  expect(screen.getByRole('searchbox')).toHaveValue('');
});

it('keeps only bounded list context in return links and supports historical assignments without a live class', () => {
  const query = new URLSearchParams({ listSearch: 'а'.repeat(250), listClass: id(21), class: id(11), returnTo: 'https://foreign.example', answer: 'secret' });
  const target = new URL(statisticsListHref(query), 'http://localhost');
  expect(target.pathname).toBe('/teacher/statistics');
  expect([...target.searchParams.keys()]).toEqual(['search', 'class']);
  expect(target.searchParams.get('search')).toHaveLength(200);
  expect(statisticsListHref(new URLSearchParams('listClass=invalid&returnTo=https://foreign.example'))).toBe('/teacher/statistics');
  const historical = work(4, 'История', [group(15, null, 'Прежний класс')]);
  const url = new URL(statisticsReportHref(historical, { classId: id(15), search: '' }), 'http://localhost');
  expect(url.searchParams.get('class')).toBe(id(15));
  expect(statisticsReportHref(works[0], { classId: '', search: '' })).toBe(`/teacher/statistics/${id(1)}`);
});
