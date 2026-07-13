import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '@/lib/auth/client';
import { createQueryClient } from '@/lib/query/query-client';
import { useAuthLogout } from './useAuthLogout';

vi.mock('next/navigation', () => ({ useRouter: vi.fn() }));
vi.mock('@/lib/auth/client', () => ({ authApi: { signOut: vi.fn() } }));

describe('useAuthLogout', () => {
  const replace = vi.fn();

  beforeEach(() => {
    replace.mockReset();
    vi.mocked(useRouter).mockReturnValue({ replace } as never);
    vi.mocked(authApi.signOut).mockReset();
  });

  it('clears server state and redirects even when sign-out fails', async () => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(['private'], { value: true });
    vi.mocked(authApi.signOut).mockRejectedValue(new Error('offline'));
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useAuthLogout(), { wrapper });

    await expect(act(() => result.current())).rejects.toThrow('offline');

    expect(queryClient.getQueryData(['private'])).toBeUndefined();
    expect(replace).toHaveBeenCalledWith('/login');
  });
});
