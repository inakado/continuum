import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import type { AssessmentTaskSummary, AssessmentTaskView } from '@continuum/shared';
import TeacherBankScreen from './TeacherBankScreen';
import { teacherBankApi } from './teacher-bank.api';

vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (fn: () => void) => { window.addEventListener('popstate', fn); return () => window.removeEventListener('popstate', fn); };
  return { useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => location.search)) };
});
vi.mock('@/components/ContinuumHeader', () => ({ default: () => null }));
vi.mock('./BankTaskPreview', () => ({ default: ({ data }: { data: AssessmentTaskView }) => <h2>{data.task.title}</h2> }));
vi.mock('./teacher-bank.api', () => ({ teacherBankApi: { list: vi.fn(), view: vi.fn(), remove: vi.fn(), restore: vi.fn() } }));
const tasks = ['Давление', 'Температура'].map((title, index) => ({ id: `00000000-0000-4000-8000-00000000000${index}`, title, version: 1, gradeBand: 'grade_10_11', topicPath: ['МКТ'], type: 'short_number', maxPoints: 1, source: { provider: 'Школково' } } as AssessmentTaskSummary));
beforeEach(() => {
  vi.resetAllMocks(); history.replaceState({}, '', '/teacher/bank?search=газ');
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method].bind(history);
    vi.spyOn(history, method).mockImplementation((data, unused, url) => { original(data, unused, url); window.dispatchEvent(new PopStateEvent('popstate')); });
  }
});
it('keeps both undo actions in an empty bank and returns to the original filters and task', async () => {
  const removed = new Set<string>();
  vi.mocked(teacherBankApi.list).mockImplementation(async () => ({ tasks: tasks.filter((task) => !removed.has(task.id)), total: tasks.length - removed.size, topics: ['МКТ'], topicPaths: [['МКТ']], pageSize: 50 }));
  vi.mocked(teacherBankApi.view).mockImplementation(async (id) => ({ id, version: 1, lifecycleRevision: 1, task: tasks.find((task) => task.id === id), statement: '', solution: null, images: {} } as AssessmentTaskView));
  vi.mocked(teacherBankApi.remove).mockImplementation(async (id) => { removed.add(id); return { id, version: 1, deletionRevision: 2 }; });
  vi.mocked(teacherBankApi.restore).mockImplementation(async (id) => { removed.delete(id); return { id }; });
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={cache}><TeacherBankScreen /></QueryClientProvider>);
  const user = userEvent.setup();
  for (const task of tasks) {
    await screen.findByRole('heading', { name: task.title });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Действия с заданием' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Действия с заданием' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Удалить из банка' }));
    await user.click(screen.getByRole('button', { name: 'Удалить из банка' }));
    await screen.findByRole('region', { name: `Удалено: ${task.title}` });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  }
  await screen.findByRole('heading', { name: 'Ничего не найдено' });
  expect(screen.getAllByRole('button', { name: 'Отменить' })).toHaveLength(2);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'другой фильтр' } });
  await user.click(screen.getAllByRole('button', { name: 'Отменить' })[1]);
  await screen.findByRole('heading', { name: 'Температура' });
  expect(screen.getByRole('searchbox')).toHaveValue('газ');
  expect(new URLSearchParams(location.search).get('task')).toBe(tasks[1].id);
  expect(screen.getAllByRole('button', { name: 'Отменить' })).toHaveLength(1);
  expect(teacherBankApi.restore).toHaveBeenCalledWith(tasks[1].id, { expectedVersion: 1, expectedDeletionRevision: 2 });
});
