import { act, cleanup, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AssessmentBankQuery } from '@continuum/shared';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useTeacherBank } from './use-teacher-bank';

const reply = (total = 0) => new Response(JSON.stringify({ tasks: [], total, topics: [], sources: [], pageSize: 50 }));
const clients: QueryClient[] = [];
const advance = (ms = 0) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
function mount(query: AssessmentBankQuery) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  clients.push(client);
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook(useTeacherBank, { wrapper, initialProps: query });
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('loads a direct search immediately, debounces a word to one GET and clears without waiting', async () => {
  const fetcher = vi.fn(async (_url: string) => reply()); vi.stubGlobal('fetch', fetcher);
  const base: AssessmentBankQuery = { search: 'газ', topic: '', page: 1, exam: 'ege', source: 'Школково' };
  const hook = mount(base);
  await advance(); expect(fetcher).toHaveBeenCalledTimes(1);
  for (const search of ['м', 'ма', 'маг']) { hook.rerender({ ...base, search }); await advance(100); }
  expect(fetcher).toHaveBeenCalledTimes(1);
  await advance(199); expect(fetcher).toHaveBeenCalledTimes(1);
  await advance(1); expect(fetcher).toHaveBeenCalledTimes(2);
  const url = new URL(fetcher.mock.calls.at(-1)![0] as string);
  expect(Object.fromEntries(url.searchParams)).toMatchObject({ search: 'маг', exam: 'ege', source: 'Школково' });
  hook.rerender({ ...base, search: '' }); await advance();
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(new URL(fetcher.mock.calls.at(-1)![0] as string).searchParams.has('search')).toBe(false);
});

it('passes cancellation to fetch and ignores a late response from a superseded search', async () => {
  let finishOld!: (response: Response) => void;
  const fetcher = vi.fn((_url: string, _options: RequestInit) => new Promise<Response>((resolve) => { finishOld = resolve; }));
  vi.stubGlobal('fetch', fetcher);
  const hook = mount({ search: 'старое', topic: '', page: 1 });
  const oldSignal = fetcher.mock.calls[0][1].signal!;
  hook.rerender({ search: 'новое', topic: '', page: 1 });
  expect(oldSignal.aborted).toBe(true);
  fetcher.mockImplementation(async () => reply(2));
  await advance(300); await advance(1);
  expect(hook.result.current.data?.total).toBe(2);
  await act(async () => finishOld(reply(99))); await advance(1);
  expect(hook.result.current.data?.total).toBe(2);
  expect(hook.result.current.error).toBeNull();
  expect(fetcher.mock.calls[1][1]).toMatchObject({ method: 'GET', credentials: 'include', cache: 'no-store', signal: expect.any(AbortSignal) });
});

it('does not delay filters, pagination or a restored initial URL', async () => {
  const fetcher = vi.fn(async (_url: string) => reply()); vi.stubGlobal('fetch', fetcher);
  const hook = mount({ search: 'газ', topic: '', page: 1 }); await advance();
  hook.rerender({ search: 'газ', topic: 'МКТ', page: 1 }); await advance();
  hook.rerender({ search: 'газ', topic: 'МКТ', page: 2 }); await advance();
  expect(fetcher).toHaveBeenCalledTimes(3);
  hook.unmount();
  mount({ search: 'другая работа', topic: 'МКТ', page: 2 }); await advance();
  expect(fetcher).toHaveBeenCalledTimes(4);
});

it('serializes a path containing punctuation as JSON rather than a comma-joined label', async () => {
  const fetcher = vi.fn(async (_url: string) => reply()); vi.stubGlobal('fetch', fetcher);
  const topicPath = ['Механика, движение', 'Графики / координаты'];
  mount({ search: '', topic: '', topicPath, page: 1 }); await advance();
  const url = new URL(fetcher.mock.calls[0][0]);
  expect(JSON.parse(url.searchParams.get('topicPath')!)).toEqual(topicPath);
});
