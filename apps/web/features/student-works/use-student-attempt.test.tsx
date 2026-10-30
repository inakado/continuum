import { act, renderHook, waitFor } from '@testing-library/react';
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type { StudentWorkDetail } from '@continuum/shared';
import { useStudentAttempt } from './use-student-attempt';
import { studentWorksApi } from './student-works.api';

vi.mock('./student-works.api', () => ({ studentWorksApi: { save: vi.fn(), finish: vi.fn() } }));
const id = '00000000-0000-4000-8000-000000000001';
const initial: StudentWorkDetail = { id, title: 'Работа', versionNumber: 1, taskCount: 1, assignedAt: '2026-10-17T00:00:00Z', revision: 1, status: 'in_progress', answeredCount: 0, startedAt: '2026-10-17T00:00:00Z', completedAt: null, result: null, instructions: '', answers: {}, items: [{ id, title: 'Число', type: 'short_number', statement: 'Условие', images: {}, maxPoints: 1 }] };
afterEach(() => { vi.resetAllMocks(); onlineManager.setOnline(true); });

function attempt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(() => useStudentAttempt(initial), { wrapper });
}

it('flushes before debounce, shares the in-flight request and includes newer input before leaving', async () => {
  let acknowledge!: (value: typeof initial) => void;
  vi.mocked(studentWorksApi.save).mockImplementationOnce(() => new Promise((resolve) => { acknowledge = resolve; }))
    .mockResolvedValueOnce({ ...initial, revision: 3, answeredCount: 1 });
  const { result } = attempt();
  act(() => result.current.change(id, { type: 'short_number', value: '1' }));
  let first!: Promise<boolean>; let second!: Promise<boolean>;
  await act(async () => { first = result.current.flush(); second = result.current.flush(); });
  expect(studentWorksApi.save).toHaveBeenCalledTimes(1);
  act(() => result.current.change(id, { type: 'short_number', value: '2' }));
  await act(async () => { acknowledge({ ...initial, revision: 2, answeredCount: 1 }); expect(await first).toBe(true); expect(await second).toBe(true); });
  expect(studentWorksApi.save).toHaveBeenCalledTimes(2);
  expect(vi.mocked(studentWorksApi.save).mock.calls[1][2]).toMatchObject({ expectedRevision: 2, answer: { value: '2' } });
  expect(result.current.dirty).toBe(false);
});

it('keeps input and the exact unacknowledged request after a failed flush', async () => {
  vi.mocked(studentWorksApi.save).mockRejectedValueOnce(new TypeError('offline')).mockResolvedValue({ ...initial, revision: 2, answeredCount: 1 });
  const { result } = attempt();
  act(() => result.current.change(id, { type: 'short_number', value: '7' }));
  await act(async () => { expect(await result.current.flush()).toBe(false); });
  expect(result.current.answers[id]).toEqual({ type: 'short_number', value: '7' });
  await act(async () => { expect(await result.current.flush()).toBe(true); });
  expect(vi.mocked(studentWorksApi.save).mock.calls[1]).toEqual(vi.mocked(studentWorksApi.save).mock.calls[0]);
});

it('retries an unacknowledged network request on reconnect without changing its identity', async () => {
  vi.mocked(studentWorksApi.save).mockRejectedValueOnce(new TypeError('offline')).mockResolvedValue({ ...initial, revision: 2, answeredCount: 1 });
  const { result } = attempt();
  act(() => { window.dispatchEvent(new Event('offline')); result.current.change(id, { type: 'short_number', value: '-2.5' }); });
  expect(result.current.online).toBe(false);
  await waitFor(() => expect(result.current.error).not.toBeNull());
  await act(async () => { window.dispatchEvent(new Event('online')); });
  await waitFor(() => expect(result.current.dirty).toBe(false));
  expect(vi.mocked(studentWorksApi.save).mock.calls[1]).toEqual(vi.mocked(studentWorksApi.save).mock.calls[0]);
});
it('retries the same unanswered save before newer edits and finishes only after every acknowledgement', async () => {
  vi.mocked(studentWorksApi.save).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce({ ...initial, revision: 2, answeredCount: 1 }).mockResolvedValueOnce({ ...initial, revision: 3, answeredCount: 1 });
  vi.mocked(studentWorksApi.finish).mockResolvedValue({ ...initial, revision: 4, status: 'completed', completedAt: '2026-10-17T01:00:00Z', result: { correctCount: 1, incorrectCount: 0 } });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result } = renderHook(() => useStudentAttempt(initial), { wrapper });
  act(() => result.current.change(id, { type: 'short_number', value: '1' }));
  await waitFor(() => expect(result.current.error).not.toBeNull(), { timeout: 1500 });
  act(() => result.current.change(id, { type: 'short_number', value: '2' }));
  await act(async () => { await result.current.finish(); });
  expect(studentWorksApi.finish).not.toHaveBeenCalled();
  act(() => result.current.retry());
  await waitFor(() => expect(result.current.dirty).toBe(false), { timeout: 2500 });
  const calls = vi.mocked(studentWorksApi.save).mock.calls;
  expect(calls[1]).toEqual(calls[0]);
  expect(calls[2][2]).toMatchObject({ expectedRevision: 2, answer: { value: '2' } });
  await act(async () => { await result.current.finish(); });
  expect(studentWorksApi.finish).toHaveBeenCalledWith(id, 3);
  expect(result.current.state.result).toEqual({ correctCount: 1, incorrectCount: 0 });
});
it('refreshes completed grades without replacing saved answers or attempt revision', async () => {
  const completed: StudentWorkDetail = { ...initial, status: 'completed', revision: 7, completedAt: '2026-10-17T01:00:00Z', answers: { [id]: { type: 'short_number', value: '7' } }, result: { correctCount: 0, incorrectCount: 1, points: 0 }, taskResults: { [id]: { points: 0, maxPoints: 1 } } };
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const { result, rerender } = renderHook(({ data }) => useStudentAttempt(data), { wrapper, initialProps: { data: completed } });
  rerender({ data: { ...completed, result: { correctCount: 1, incorrectCount: 0, points: 1 }, taskResults: { [id]: { points: 1, maxPoints: 1 } }, answers: {} } });
  await waitFor(() => expect(result.current.state.result?.points).toBe(1));
  expect(result.current.state.taskResults?.[id].points).toBe(1);
  expect(result.current.answers).toBe(completed.answers); expect(result.current.saved).toBe(completed.answers);
  expect(result.current.state.revision).toBe(7);
  expect(studentWorksApi.save).not.toHaveBeenCalled(); expect(studentWorksApi.finish).not.toHaveBeenCalled();
});
