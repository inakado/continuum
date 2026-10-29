import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import type { AssessmentWorkSummary } from '@continuum/shared';
import { ApiError } from '@/lib/api/client';
import { teacherWorkQueryKeys } from '@/lib/query/keys';
import TeacherWorksScreen from './TeacherWorksScreen';
import { teacherWorksApi } from './teacher-works.api';

vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  return { useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams(useSyncExternalStore((listener) => { window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener); }, () => window.location.search)) };
});
vi.mock('@/components/ContinuumHeader', () => ({ default: () => null }));
vi.mock('./teacher-works.api', () => ({ teacherWorksApi: { list: vi.fn(), copy: vi.fn(), create: vi.fn(), archive: vi.fn(), remove: vi.fn() } }));
const work: AssessmentWorkSummary & { hasAssignments: boolean } = { id: '00000000-0000-4000-8000-000000000001', title: 'МКТ', hasAssignments: false, gradeBand: 'grade_10_11', revision: 2, taskCount: 0, maxPoints: 0, updatedAt: '2026-10-21T00:00:00Z', isArchived: false, lifecycleRevision: 1, canDelete: true };
beforeEach(() => {
  vi.restoreAllMocks(); vi.resetAllMocks(); history.replaceState({}, '', '/teacher/works');
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method].bind(history);
    vi.spyOn(history, method).mockImplementation((data, unused, url) => { original(data, unused, url); window.dispatchEvent(new PopStateEvent('popstate')); });
  }
  vi.mocked(teacherWorksApi.list).mockResolvedValue([work]);
});
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><TeacherWorksScreen /></QueryClientProvider>);
  return client;
}
async function menu(action: string) {
  const user = userEvent.setup(); await user.click(await screen.findByRole('button', { name: 'Действия с работой: МКТ' }));
  await user.click(await screen.findByRole('menuitem', { name: action })); return user;
}
it('filters archives without a new navigation tab and restores through the same row menu', async () => {
  let current = work;
  vi.mocked(teacherWorksApi.list).mockImplementation(async () => [current]);
  vi.mocked(teacherWorksApi.archive).mockImplementation(async ({ input }) => { current = { ...current, isArchived: input.isArchived, lifecycleRevision: (current.lifecycleRevision ?? 1) + 1 }; return { id: work.id }; });
  setup(); const user = await menu('В архив');
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Действия с работой: МКТ' })).not.toBeInTheDocument());
  expect(screen.getByRole('searchbox', { name: 'Поиск работ' })).toHaveFocus();
  await user.selectOptions(screen.getByLabelText('Показывать'), 'archived');
  expect(await screen.findByRole('button', { name: 'Действия с работой: МКТ' })).toBeVisible();
  await menu('Восстановить');
  expect(await screen.findByRole('heading', { name: 'Архив пуст' })).toBeVisible();
  await user.selectOptions(screen.getByLabelText('Показывать'), 'active');
  expect(await screen.findByRole('button', { name: 'Действия с работой: МКТ' })).toBeVisible();
  expect(teacherWorksApi.archive).toHaveBeenNthCalledWith(1, { id: work.id, input: { isArchived: true, expectedLifecycleRevision: 1 } }, expect.anything());
  expect(teacherWorksApi.archive).toHaveBeenNthCalledWith(2, { id: work.id, input: { isArchived: false, expectedLifecycleRevision: 2 } }, expect.anything());
  expect(teacherWorksApi.remove).not.toHaveBeenCalled();
});
it('never offers deletion for an assigned work but keeps archiving and copying', async () => {
  vi.mocked(teacherWorksApi.list).mockResolvedValue([{ ...work, canDelete: false, hasAssignments: true }]);
  setup(); const user = userEvent.setup(); await user.click(await screen.findByRole('button', { name: 'Действия с работой: МКТ' }));
  expect(screen.getByRole('menuitem', { name: 'В архив' })).toBeVisible();
  expect(screen.getByRole('menuitem', { name: 'Создать копию' })).toBeVisible();
  expect(screen.queryByRole('menuitem', { name: 'Удалить черновик' })).not.toBeInTheDocument();
});
it('repeats the same archive transition after an uncertain network result', async () => {
  vi.mocked(teacherWorksApi.archive).mockRejectedValueOnce(new Error('Network')).mockResolvedValueOnce({ id: work.id });
  const client = setup(); const user = await menu('В архив');
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось изменить состояние работы');
  const original = vi.mocked(teacherWorksApi.archive).mock.calls[0][0];
  act(() => client.setQueryData(teacherWorkQueryKeys.list(), [{ ...work, lifecycleRevision: 3 }]));
  await user.click(screen.getByRole('button', { name: 'Повторить' }));
  await waitFor(() => expect(teacherWorksApi.archive).toHaveBeenCalledTimes(2));
  expect(vi.mocked(teacherWorksApi.archive).mock.calls[1][0]).toEqual(original);
});
it('focuses cancel, explains deletion and cancels without a write', async () => {
  setup(); const user = await menu('Удалить черновик');
  const dialog = screen.getByRole('dialog');
  expect(dialog).toHaveTextContent('Задания в банке и созданные копии останутся');
  expect(within(dialog).getByRole('button', { name: 'Отмена' })).toHaveFocus();
  await user.click(within(dialog).getByRole('button', { name: 'Отмена' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Действия с работой: МКТ' })).toHaveFocus();
  expect(teacherWorksApi.remove).not.toHaveBeenCalled();
});
it('keeps the confirmed revisions through a refresh and preserves the dialog on a conflict', async () => {
  vi.mocked(teacherWorksApi.remove).mockRejectedValue(new ApiError(409, 'Работа уже назначена. Её можно отправить в архив, но нельзя удалить.'));
  const client = setup(); const user = await menu('Удалить черновик');
  act(() => client.setQueryData(teacherWorkQueryKeys.list(), [{ ...work, revision: 3, lifecycleRevision: 2, canDelete: false }]));
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить черновик' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Работа уже назначена');
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(teacherWorksApi.remove).toHaveBeenCalledWith({ id: work.id, input: { expectedRevision: 2, expectedLifecycleRevision: 1 } }, expect.anything());
});
it('blocks dismissal and repeat while deleting, then refreshes the list and focuses search', async () => {
  const pending = Promise.withResolvers<{ id: string }>(); vi.mocked(teacherWorksApi.remove).mockReturnValue(pending.promise);
  const client = setup(); client.setQueryData(teacherWorkQueryKeys.detail(work.id), { ...work, items: [] });
  client.setQueryData(teacherWorkQueryKeys.preview(work.id, 1), { ...work, items: [] });
  const user = await menu('Удалить черновик');
  await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Удалить черновик' }));
  expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Отмена' })).toBeDisabled();
  await user.keyboard('{Escape}'); expect(screen.getByRole('dialog')).toBeVisible();
  expect(teacherWorksApi.remove).toHaveBeenCalledOnce();
  vi.mocked(teacherWorksApi.list).mockResolvedValue([]); pending.resolve({ id: work.id });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(await screen.findByRole('heading', { name: 'Пока нет работ' })).toBeVisible();
  expect(screen.getByRole('searchbox', { name: 'Поиск работ' })).toHaveFocus();
  expect(client.getQueryData(teacherWorkQueryKeys.detail(work.id))).toBeUndefined();
  expect(client.getQueryData(teacherWorkQueryKeys.preview(work.id, 1))).toBeUndefined();
});
