import { screen } from '@testing-library/react';
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
});
