import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '@/lib/auth/client';
import { renderWithQueryClient } from '@/test/render-with-query-client';
import AppEntry from './AppEntry';

const { replace } = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/lib/auth/client', () => ({ authApi: { getSession: vi.fn() } }));

describe('AppEntry', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('waits for the session without sending an authenticated user to login', () => {
    vi.mocked(authApi.getSession).mockReturnValue(new Promise(() => {}));
    renderWithQueryClient(<AppEntry />);
    expect(screen.getByRole('status')).toHaveTextContent('Открываем Континуум');
    expect(replace).not.toHaveBeenCalled();
  });

  it.each(['teacher', 'student', 'admin'] as const)('opens the %s home using the verified session', async (role) => {
    vi.mocked(authApi.getSession).mockResolvedValue({ user: { id: 'user', name: 'Имя', login: 'login', role } });
    renderWithQueryClient(<AppEntry />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith(`/${role}`));
  });

  it('opens login when the session is absent', async () => {
    vi.mocked(authApi.getSession).mockResolvedValue(null);
    renderWithQueryClient(<AppEntry />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
  });

  it('keeps a network failure separate from logout and allows retry', async () => {
    vi.mocked(authApi.getSession).mockRejectedValue(new Error('network'));
    renderWithQueryClient(<AppEntry />, { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) });
    const retry = await screen.findByRole('button', { name: 'Повторить' });
    expect(replace).not.toHaveBeenCalled();
    vi.mocked(authApi.getSession).mockResolvedValue({ user: { id: 'user', name: 'Имя', login: 'login', role: 'student' } });
    await userEvent.click(retry);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/student'));
  });
});
