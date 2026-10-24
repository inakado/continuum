import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { authQueryKeys } from '@/lib/query/keys';
import { usePathname, useRouter } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '@/lib/auth/client';
import { renderWithQueryClient } from '@/test/render-with-query-client';
import RoleGuard from './RoleGuard';

vi.mock('next/navigation', () => ({ usePathname: vi.fn(), useRouter: vi.fn() }));
vi.mock('@/lib/auth/client', () => ({
  authApi: { getSession: vi.fn() },
}));
describe('RoleGuard', () => {
  const replace = vi.fn();

  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue('/teacher');
    vi.mocked(useRouter).mockReturnValue({ replace } as never);
    vi.mocked(authApi.getSession).mockReset();
    replace.mockReset();
  });

  it('renders protected content for the matching role', async () => {
    vi.mocked(authApi.getSession).mockResolvedValue({
      user: { id: 'teacher-1', login: 'teacher1', name: 'Анна', role: 'teacher' },
    });

    renderWithQueryClient(<RoleGuard requiredRole="teacher">content</RoleGuard>);

    expect(await screen.findByText('content')).toBeInTheDocument();
  });

  it('redirects to login when the session is absent', async () => {
    vi.mocked(authApi.getSession).mockResolvedValue(null);

    renderWithQueryClient(<RoleGuard requiredRole="teacher">content</RoleGuard>);

    expect(await screen.findByText('Переход ко входу…')).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith('/login');
  });

  it('renders forbidden state for another role', async () => {
    vi.mocked(authApi.getSession).mockResolvedValue({
      user: { id: 'student-1', login: 'student1', name: 'Иван', role: 'student' },
    });

    renderWithQueryClient(<RoleGuard requiredRole="teacher">content</RoleGuard>);

    expect(await screen.findByText('Раздел недоступен')).toBeInTheDocument();
  });

  it('does not present an API failure as a missing session', async () => {
    vi.mocked(authApi.getSession).mockRejectedValue(new Error('network'));

    renderWithQueryClient(<RoleGuard requiredRole="teacher">content</RoleGuard>);

    expect(await screen.findByText('Сервис временно недоступен')).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it('preserves the mounted teacher editor when the session expires, but not for another account', async () => {
    vi.mocked(usePathname).mockReturnValue('/teacher/works/00000000-0000-4000-8000-000000000001');
    const owner = { user: { id: 'teacher-1', login: 'teacher1', name: 'Анна', role: 'teacher' as const } };
    vi.mocked(authApi.getSession).mockResolvedValue(owner);
    function Draft() { const [value, setValue] = useState(''); return <input aria-label="Черновик" value={value} onChange={(event) => setValue(event.target.value)} />; }
    const { queryClient } = renderWithQueryClient(<RoleGuard requiredRole="teacher"><Draft /></RoleGuard>);
    fireEvent.change(await screen.findByLabelText('Черновик'), { target: { value: 'Несохранённый ввод' } });
    await act(async () => { queryClient.setQueryData(authQueryKeys.session(), null); });
    expect(screen.getByLabelText('Черновик')).toHaveValue('Несохранённый ввод');
    expect(replace).not.toHaveBeenCalled();
    await act(async () => { queryClient.setQueryData(authQueryKeys.session(), { user: { ...owner.user, id: 'teacher-2' } }); });
    await waitFor(() => expect(screen.getByLabelText('Черновик')).toHaveValue(''));
  });
});
