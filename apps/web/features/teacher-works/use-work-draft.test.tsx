import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import type { AssessmentWorkDetail } from '@continuum/shared';
import { useWorkDraft } from './use-work-draft';
import { teacherWorksApi } from './teacher-works.api';

vi.mock('./teacher-works.api', () => ({ teacherWorksApi: { update: vi.fn() } }));
const initial: AssessmentWorkDetail = { id: '00000000-0000-4000-8000-000000000001', title: 'МКТ', instructions: '', gradeBand: 'grade_10_11', revision: 1, taskCount: 0, maxPoints: 0, updatedAt: '2026-10-17T00:00:00Z', items: [] };
const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
it('retries an uncertain save with the same request, then saves newer edits at the acknowledged revision', async () => {
  const update = vi.mocked(teacherWorksApi.update);
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
