import { act, fireEvent, render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import ContinuumHeader from './ContinuumHeader';

const logout = vi.hoisted(() => vi.fn());
vi.mock('@/features/auth/useAuthLogout', () => ({ useAuthLogout: () => logout }));
vi.mock('@/features/auth/useAuthSession', () => ({ useAuthSession: () => ({ data: { user: { name: 'Ученик' } } }) }));

it('does not sign out until the work permits leaving, and preserves the session on cancellation', async () => {
  let permit!: (value: boolean) => void;
  const beforeLogout = vi.fn(() => new Promise<boolean>((resolve) => { permit = resolve; }));
  render(<ContinuumHeader homeHref="/student" beforeLogout={beforeLogout} />);
  fireEvent.click(screen.getByRole('button', { name: 'Профиль: Ученик' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Выйти' }));
  expect(logout).not.toHaveBeenCalled();
  await act(async () => { permit(false); });
  expect(logout).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Выйти' }));
  await act(async () => { permit(true); });
  expect(logout).toHaveBeenCalledOnce();
});
