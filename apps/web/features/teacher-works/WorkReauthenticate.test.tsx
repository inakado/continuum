import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { authApi } from '@/lib/auth/client';
import { authQueryKeys } from '@/lib/query/keys';
import WorkReauthenticate from './WorkReauthenticate';

vi.mock('@/lib/auth/client', () => ({ authApi: { signIn: vi.fn(), signOut: vi.fn().mockResolvedValue(undefined) } }));
it('preserves the editor on failed login, rejects another account and restores only the original teacher', async () => {
  const ready = vi.fn(), close = vi.fn(), client = new QueryClient();
  vi.mocked(authApi.signIn).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ user: { id: 'other', role: 'teacher' } } as never).mockResolvedValueOnce({ user: { id: 'owner', role: 'student' } } as never).mockResolvedValueOnce({ user: { id: 'owner', role: 'teacher' } } as never);
  render(<QueryClientProvider client={client}><WorkReauthenticate owner="owner" login="teacher1" onReady={ready} onClose={close} /></QueryClientProvider>);
  const submit = () => { fireEvent.change(screen.getByLabelText('Пароль для сохранения работы'), { target: { value: 'password' } }); fireEvent.click(screen.getByRole('button', { name: 'Войти и сохранить' })); };
  submit(); await screen.findByRole('alert');
  expect(ready).not.toHaveBeenCalled(); expect(screen.getByLabelText('Пароль для сохранения работы')).toHaveValue('');
  submit(); await waitFor(() => expect(authApi.signOut).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Отмена' })).toBeEnabled());
  submit(); await waitFor(() => expect(authApi.signOut).toHaveBeenCalledTimes(2));
  expect(ready).not.toHaveBeenCalled(); expect(client.getQueryData(authQueryKeys.session())).toBeUndefined();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Отмена' })).toBeEnabled());
  submit(); await waitFor(() => expect(ready).toHaveBeenCalledOnce());
  expect(client.getQueryData(authQueryKeys.session())).toEqual({ user: { id: 'owner', role: 'teacher' } });
});
