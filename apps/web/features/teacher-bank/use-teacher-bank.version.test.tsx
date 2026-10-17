import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { useTeacherBankTask } from './use-teacher-bank';

vi.mock('./teacher-bank.api', () => ({ teacherBankApi: { view: vi.fn(async (id: string, version?: number) => ({ id, version: version ?? 3 })) } }));

it('keeps pinned revisions and latest task content in separate query entries', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const initialProps: { version: number | undefined } = { version: 1 };
  const view = renderHook(({ version }) => useTeacherBankTask('task', version), { wrapper, initialProps });
  await waitFor(() => expect(view.result.current.data?.version).toBe(1));
  view.rerender({ version: 2 });
  await waitFor(() => expect(view.result.current.data?.version).toBe(2));
  view.rerender({ version: undefined });
  await waitFor(() => expect(view.result.current.data?.version).toBe(3));
  view.rerender({ version: 1 });
  await waitFor(() => expect(view.result.current.data?.version).toBe(1));
  view.unmount();
  client.clear();
});
