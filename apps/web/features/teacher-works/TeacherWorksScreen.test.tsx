import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, expect, it, vi } from 'vitest';
import type { AssessmentWorkDetail } from '@continuum/shared';
import { ApiError } from '@/lib/api/client';
import { teacherWorkQueryKeys } from '@/lib/query/keys';
import TeacherWorksScreen from './TeacherWorksScreen';
import { teacherWorksApi } from './teacher-works.api';

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  return { useRouter: () => ({ push }), useSearchParams: () => new URLSearchParams(useSyncExternalStore((listener) => { window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener); }, () => window.location.search)) };
});
vi.mock('@/components/ContinuumHeader', () => ({ default: () => null }));
vi.mock('./teacher-works.api', () => ({ teacherWorksApi: { list: vi.fn(), copy: vi.fn(), create: vi.fn(), archive: vi.fn(), remove: vi.fn() } }));
const work: AssessmentWorkDetail & { hasAssignments: boolean } = { id: '00000000-0000-4000-8000-000000000001', title: 'Термодинамика', hasAssignments: false, gradeBand: 'grade_10_11', revision: 2, taskCount: 0, maxPoints: 0, instructions: '', items: [], updatedAt: '2026-10-21T00:00:00Z' };
const copied = { ...work, id: '00000000-0000-4000-8000-000000000002', title: 'Термодинамика — копия', revision: 1 };
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
async function copyFromMenu() {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Действия с работой: Термодинамика' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Создать копию' }));
  return user;
}
it('offers copying in the row menu, opens an independent draft and primes its query cache', async () => {
  vi.mocked(teacherWorksApi.copy).mockResolvedValue(copied);
  const client = setup();
  const trigger = await screen.findByRole('button', { name: 'Действия с работой: Термодинамика' });
  const user = userEvent.setup(); await user.click(trigger); await user.keyboard('{Escape}');
  expect(trigger).toHaveFocus(); expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  await copyFromMenu(); await waitFor(() => expect(push).toHaveBeenCalledWith(`/teacher/works/${copied.id}`));
  expect(teacherWorksApi.copy).toHaveBeenCalledWith({ sourceId: work.id, input: { id: expect.any(String), expectedRevision: 2 } }, expect.anything());
  expect(client.getQueryData(teacherWorkQueryKeys.detail(copied.id))).toEqual(copied);
  expect(teacherWorksApi.create).not.toHaveBeenCalled();
});
it('carries the filtered list context into the work link', async () => {
  history.replaceState({}, '', '/teacher/works?search=Термо');
  setup();
  const link = await screen.findByRole('link', { name: /Термодинамика.*Не назначена/ });
  expect(link).toHaveAttribute('href', `/teacher/works/${work.id}?search=%D0%A2%D0%B5%D1%80%D0%BC%D0%BE`);
});

it('shows only assignment presence and keeps it after editing and archiving', async () => {
  const assigned = { ...work, id: '00000000-0000-4000-8000-000000000003', title: 'Кинематика', taskCount: 30, maxPoints: 45, hasAssignments: true };
  vi.mocked(teacherWorksApi.list).mockResolvedValue([work, assigned]);
  const client = setup();
  expect(await screen.findByRole('link', { name: /Термодинамика.*Не назначена/ })).toBeVisible();
  expect(screen.getByRole('link', { name: /Кинематика.*Назначена/ })).toBeVisible();
  act(() => client.setQueryData(teacherWorkQueryKeys.list(), [{ ...assigned, revision: 7 }]));
  expect(screen.getByRole('link', { name: /Кинематика.*Назначена/ })).toBeVisible();
  expect(screen.queryByText(/Черновик|Есть новые изменения|Редакция изменена/)).not.toBeInTheDocument();
  act(() => client.setQueryData(teacherWorkQueryKeys.list(), [{ ...assigned, isArchived: true }]));
  await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Показывать' }), 'archived');
  expect(screen.getByRole('link', { name: /Кинематика.*Назначена.*Архив/ })).toBeVisible();
});
it('retries an uncertain result with the same payload even if the source list refreshes', async () => {
  vi.mocked(teacherWorksApi.copy).mockRejectedValueOnce(new Error('Сеть недоступна')).mockResolvedValueOnce(copied);
  const client = setup(); const user = await copyFromMenu();
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось создать копию. Повторите попытку.');
  const original = vi.mocked(teacherWorksApi.copy).mock.calls[0][0];
  act(() => client.setQueryData(teacherWorkQueryKeys.list(), [{ ...work, revision: 3 }]));
  await user.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Повторить копирование' }));
  await waitFor(() => expect(push).toHaveBeenCalledOnce());
  expect(vi.mocked(teacherWorksApi.copy).mock.calls[1][0]).toEqual(original);
});
it('uses a fresh revision and key after a definite conflict rather than silently copying a newer source', async () => {
  vi.mocked(teacherWorksApi.copy).mockRejectedValueOnce(new ApiError(409, 'Работа изменилась')).mockResolvedValueOnce(copied);
  const client = setup(); const user = await copyFromMenu();
  expect(await screen.findByRole('alert')).toHaveTextContent('Работа изменилась');
  act(() => client.setQueryData(teacherWorkQueryKeys.list(), [{ ...work, revision: 3 }]));
  await user.click(screen.getByRole('button', { name: 'Повторить копирование' }));
  await waitFor(() => expect(push).toHaveBeenCalledOnce());
  expect(vi.mocked(teacherWorksApi.copy).mock.calls[1][0].input.expectedRevision).toBe(3);
  expect(vi.mocked(teacherWorksApi.copy).mock.calls[1][0].input.id).not.toBe(vi.mocked(teacherWorksApi.copy).mock.calls[0][0].input.id);
});
it('blocks another click while creating a copy and exposes a readable pending state', async () => {
  const pending = Promise.withResolvers<AssessmentWorkDetail>(); vi.mocked(teacherWorksApi.copy).mockReturnValue(pending.promise);
  setup(); const user = await copyFromMenu();
  expect(await screen.findByRole('status')).toHaveTextContent('Создаём копию');
  const trigger = screen.getByRole('button', { name: 'Действия с работой: Термодинамика' });
  expect(trigger).toBeDisabled(); await user.click(trigger); expect(teacherWorksApi.copy).toHaveBeenCalledOnce();
  pending.resolve(copied); await waitFor(() => expect(push).toHaveBeenCalledOnce());
});
