import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { authApi } from '@/lib/auth/client';
import StudentReauthenticate from './StudentReauthenticate';

vi.mock('@/lib/auth/client', () => ({ authApi: { signIn: vi.fn(), signOut: vi.fn() } }));
it('keeps the work on failed login and refuses to resume under another account', async () => {
  const ready = vi.fn();
  vi.mocked(authApi.signIn).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ user: { id: 'other', role: 'student' } } as never).mockResolvedValueOnce({ user: { id: 'owner', role: 'student' } } as never);
  render(<QueryClientProvider client={new QueryClient()}><StudentReauthenticate owner="owner" login="student1" onReady={ready} /></QueryClientProvider>);
  const submit = () => { fireEvent.change(screen.getByLabelText('Пароль для продолжения работы'), { target: { value: 'password' } }); fireEvent.click(screen.getByRole('button', { name: 'Войти и продолжить' })); };
  submit();
  await screen.findByRole('alert');
  expect(ready).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Пароль для продолжения работы')).toHaveValue('');
  submit();
  await waitFor(() => expect(authApi.signOut).toHaveBeenCalledOnce());
  expect(ready).not.toHaveBeenCalled();
  submit();
  await waitFor(() => expect(ready).toHaveBeenCalledOnce());
});
