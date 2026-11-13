import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import BankTaskDetails from './BankTaskDetails';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('names the answer by its actual content and omits it when the task has no answer key', () => {
  const view = render(<BankTaskDetails answer={<p>42</p>} metadata={<p>Источник</p>} hasSolution />);
  expect(screen.getByRole('button', { name: 'Ответ и решение' })).toBeVisible();
  view.rerender(<BankTaskDetails answer={null} metadata={<p>Источник</p>} hasSolution={false} />);
  expect(screen.queryByRole('button', { name: /Ответ/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Метаданные' })).toBeVisible();
});

it.each([false, true])('scrolls to opened details and respects reduced motion: %s', async reducedMotion => {
  const user = userEvent.setup();
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  vi.spyOn(window, 'matchMedia').mockReturnValue({ ...preference, matches: reducedMotion });
  render(<BankTaskDetails answer={<p>42</p>} metadata={<p>Источник</p>} hasSolution={false} />);
  const scroll = vi.fn();
  screen.getByRole('region', { name: 'Ответ и информация о задаче' }).scrollIntoView = scroll;
  expect(scroll).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Метаданные' }));
  expect(scroll).toHaveBeenCalledWith({ block: 'start', behavior: reducedMotion ? 'instant' : 'smooth' });
  await user.click(screen.getByRole('button', { name: 'Метаданные' }));
  expect(scroll).toHaveBeenCalledTimes(1);
});
