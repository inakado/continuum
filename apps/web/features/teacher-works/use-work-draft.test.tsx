import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import type { AssessmentWorkDetail } from '@continuum/shared';
import { useWorkDraft } from './use-work-draft';
import { teacherWorksApi } from './teacher-works.api';
import { ApiError } from '@/lib/api/client';

vi.mock('./teacher-works.api', () => ({ teacherWorksApi: { update: vi.fn() } }));
const initial: AssessmentWorkDetail = { id: '00000000-0000-4000-8000-000000000001', title: 'МКТ', instructions: '', gradeBand: 'grade_10_11', revision: 1, taskCount: 0, maxPoints: 0, updatedAt: '2026-10-17T00:00:00Z', items: [] };
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
it('flushes immediately and drains edits made during one shared in-flight save', async () => {
  vi.mocked(teacherWorksApi.update).mockReset();
  let finish!: (work: AssessmentWorkDetail) => void;
  vi.mocked(teacherWorksApi.update).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValueOnce({ ...initial, title: 'Вторая', revision: 3 });
  const { result, unmount } = renderHook(() => useWorkDraft(initial), { wrapper });
  act(() => result.current.change({ title: 'Первая' }));
  let flush!: Promise<boolean>;
  act(() => { flush = result.current.flush(); expect(result.current.flush()).toBe(flush); });
  await waitFor(() => expect(teacherWorksApi.update).toHaveBeenCalledOnce());
  act(() => result.current.change({ title: 'Вторая' }));
  await act(async () => { finish({ ...initial, title: 'Первая', revision: 2 }); expect(await flush).toBe(true); });
  expect(teacherWorksApi.update).toHaveBeenCalledTimes(2);
  expect(vi.mocked(teacherWorksApi.update).mock.calls[1][1]).toMatchObject({ title: 'Вторая', expectedRevision: 2 });
  expect(result.current.dirty).toBe(false);
  unmount();
});

it('does not retry a revision conflict and stops later saves after explicit discard', async () => {
  vi.mocked(teacherWorksApi.update).mockReset().mockRejectedValue(new ApiError(409, 'Работа изменилась'));
  const { result, unmount } = renderHook(() => useWorkDraft(initial), { wrapper });
  act(() => result.current.change({ title: 'Моя редакция' }));
  await act(async () => { expect(await result.current.flush()).toBe(false); });
  await act(async () => { expect(await result.current.flush()).toBe(false); });
  expect(teacherWorksApi.update).toHaveBeenCalledOnce();
  act(() => result.current.discard());
  await act(async () => { expect(await result.current.flush()).toBe(true); });
  expect(teacherWorksApi.update).toHaveBeenCalledOnce();
  unmount();
});

it('retries an uncertain save with the same request, then saves newer edits at the acknowledged revision', async () => {
  const update = vi.mocked(teacherWorksApi.update);
  update.mockReset();
  update.mockRejectedValueOnce(new Error('Сеть недоступна')).mockResolvedValueOnce({ ...initial, title: 'Первая', revision: 2 }).mockResolvedValueOnce({ ...initial, title: 'Вторая', revision: 3 });
  const { result, unmount } = renderHook(() => useWorkDraft(initial), { wrapper });
  act(() => result.current.change({ title: 'Первая' }));
  await waitFor(() => expect(result.current.error).not.toBeNull());
  const firstRequest = update.mock.calls[0][1];
  act(() => result.current.change({ title: 'Вторая' }));
  act(() => result.current.retry());
  await waitFor(() => expect(update).toHaveBeenCalledTimes(3), { timeout: 3000 });
  expect(update.mock.calls[1][1]).toEqual(firstRequest);
  expect(update.mock.calls[2][1]).toMatchObject({ title: 'Вторая', expectedRevision: 2 });
  await waitFor(() => expect(result.current.dirty).toBe(false));
  unmount();
});

it('does not send newer edits or update cached data after discarding an in-flight save', async () => {
  let finish!: (work: AssessmentWorkDetail) => void;
  vi.mocked(teacherWorksApi.update).mockReset().mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
  const cache = new QueryClient();
  const { result, unmount } = renderHook(() => useWorkDraft(initial), { wrapper: ({ children }) => <QueryClientProvider client={cache}>{children}</QueryClientProvider> });
  act(() => result.current.change({ title: 'Отправленное' }));
  let flush!: Promise<boolean>;
  act(() => { flush = result.current.flush(); });
  await waitFor(() => expect(teacherWorksApi.update).toHaveBeenCalledOnce());
  act(() => { result.current.change({ title: 'Не отправлять' }); result.current.discard(); });
  await act(async () => { finish({ ...initial, revision: 2 }); expect(await flush).toBe(false); });
  expect(teacherWorksApi.update).toHaveBeenCalledOnce();
  expect(cache.getQueryCache().findAll()).toHaveLength(0);
  unmount();
});
