import { screen } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authApi } from '@/lib/auth/client';
import { renderWithQueryClient } from '@/test/render-with-query-client';
import RoleGuard from './RoleGuard';

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }));
vi.mock('@/lib/auth/client', () => ({
  authApi: { getSession: vi.fn() },
}));
vi.mock('@/features/teacher-content/auth/AuthRequired', () => ({
  default: () => <div>teacher-auth-required</div>,
}));
vi.mock('@/features/student-content/auth/StudentAuthRequired', () => ({
  default: () => <div>student-auth-required</div>,
}));

describe('RoleGuard', () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue('/teacher');
    vi.mocked(authApi.getSession).mockReset();
  });

  it('renders protected content for the matching role', async () => {
    vi.mocked(authApi.getSession).mockResolvedValue({
      user: { id: 'teacher-1', login: 'teacher1', role: 'teacher' },
    });

    renderWithQueryClient(<RoleGuard requiredRole="teacher">content</RoleGuard>);

    expect(await screen.findByText('content')).toBeInTheDocument();
  });

  it('renders sign-in state when the session is absent', async () => {
    vi.mocked(authApi.getSession).mockResolvedValue(null);

    renderWithQueryClient(<RoleGuard requiredRole="teacher">content</RoleGuard>);

    expect(await screen.findByText('teacher-auth-required')).toBeInTheDocument();
  });

  it('renders forbidden state for another role', async () => {
    vi.mocked(authApi.getSession).mockResolvedValue({
      user: { id: 'student-1', login: 'student1', role: 'student' },
    });

    renderWithQueryClient(<RoleGuard requiredRole="teacher">content</RoleGuard>);

    expect(await screen.findByText('Доступ запрещён')).toBeInTheDocument();
  });

  it('does not present an API failure as a missing session', async () => {
    vi.mocked(authApi.getSession).mockRejectedValue(new Error('network'));

    renderWithQueryClient(<RoleGuard requiredRole="teacher">content</RoleGuard>);

    expect(await screen.findByText('Сервис временно недоступен')).toBeInTheDocument();
    expect(screen.queryByText('teacher-auth-required')).not.toBeInTheDocument();
  });
});
