import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import ContinuumHeader from './ContinuumHeader';

const state = vi.hoisted(() => ({ role: 'teacher', logout: vi.fn() }));
vi.mock('@/features/auth/useAuthSession', () => ({ useAuthSession: () => ({ data: { user: { role: state.role, name: 'Александр' } } }) }));
vi.mock('@/features/auth/useAuthLogout', () => ({ useAuthLogout: () => state.logout }));
beforeEach(() => { state.role = 'teacher'; state.logout.mockReset(); });

it('opens by keyboard, navigates the teacher menu and returns focus on Escape', async () => {
  const user = userEvent.setup(); render(<ContinuumHeader homeHref="/teacher" />);
  const trigger = screen.getByRole('button', { name: 'Профиль: Александр' });
  trigger.focus(); await user.keyboard('{Enter}');
  const agent = await screen.findByRole('menuitem', { name: 'Подключение агента' });
  await waitFor(() => expect(agent).toHaveFocus());
  await user.keyboard('{ArrowDown}'); expect(screen.getByRole('menuitem', { name: 'Выйти' })).toHaveFocus();
  await user.keyboard('{Escape}'); await waitFor(() => expect(trigger).toHaveFocus());
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});
it('keeps the student menu role-specific and dismisses outside', async () => {
  state.role = 'student'; const user = userEvent.setup(); render(<ContinuumHeader homeHref="/student" />);
  await user.click(screen.getByRole('button', { name: 'Профиль: Александр' }));
  expect(screen.queryByRole('menuitem', { name: 'Подключение агента' })).not.toBeInTheDocument();
  fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
  await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
});
it('honours a cancelled leave guard and does not sign out', async () => {
  const beforeLogout = vi.fn().mockResolvedValue(false), user = userEvent.setup();
  render(<ContinuumHeader homeHref="/student" beforeLogout={beforeLogout} />);
  await user.click(screen.getByRole('button', { name: 'Профиль: Александр' }));
  await user.click(screen.getByRole('menuitem', { name: 'Выйти' }));
  await waitFor(() => expect(beforeLogout).toHaveBeenCalledOnce());
  expect(state.logout).not.toHaveBeenCalled();
});
it('awaits saving and ignores a second logout while it is pending', async () => {
  const pending = Promise.withResolvers<boolean>(), beforeLogout = vi.fn(() => pending.promise), user = userEvent.setup();
  render(<ContinuumHeader homeHref="/student" beforeLogout={beforeLogout} />);
  for (let i = 0; i < 2; i++) { await user.click(screen.getByRole('button', { name: 'Профиль: Александр' })); await user.click(screen.getByRole('menuitem', { name: 'Выйти' })); }
  expect(beforeLogout).toHaveBeenCalledOnce(); expect(state.logout).not.toHaveBeenCalled();
  pending.resolve(true); await waitFor(() => expect(state.logout).toHaveBeenCalledOnce());
});

it('uses the latest leave guard after parent props change', async () => {
  const previous = vi.fn().mockResolvedValue(true), current = vi.fn().mockResolvedValue(false);
  const user = userEvent.setup();
  const view = render(<ContinuumHeader homeHref="/student" beforeLogout={previous} />);
  view.rerender(<ContinuumHeader homeHref="/student" beforeLogout={current} />);
  await user.click(screen.getByRole('button', { name: 'Профиль: Александр' }));
  await user.click(screen.getByRole('menuitem', { name: 'Выйти' }));
  await waitFor(() => expect(current).toHaveBeenCalledOnce());
  expect(previous).not.toHaveBeenCalled();
  expect(state.logout).not.toHaveBeenCalled();
});
