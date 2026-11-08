import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PrototypeReadingQuestion from './PrototypeReadingQuestion';

const title = 'Как называется раздел механики, который описывает движение тел?';
beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
function advance(ms: number) { act(() => vi.advanceTimersByTime(ms)); }
function show() { return render(<article><p id="kinematics-intro" tabIndex={-1}>Введение</p><PrototypeReadingQuestion /><p>Продолжение главы</p><a href="#next">Следующий раздел</a></article>); }
function stopScrolling() { fireEvent.wheel(window, { deltaY: 120 }); advance(600); }
function enter(value: string) { fireEvent.change(screen.getByRole('textbox', { name: 'Ваш ответ' }), { target: { value } }); fireEvent.click(screen.getByRole('button', { name: 'Проверить' })); }

it('waits until scrolling stops, offers once, and has no question buttons in the text', () => {
  show();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  fireEvent.scroll(window);
  advance(400);
  fireEvent.scroll(window);
  advance(400);
  expect(screen.queryByRole('region', { name: title })).not.toBeInTheDocument();
  advance(200);
  expect(screen.getByRole('region', { name: title })).toBeVisible();
  expect(document.activeElement).toBe(document.body);
  fireEvent.click(screen.getByRole('button', { name: 'Закрыть вопрос' }));
  stopScrolling();
  expect(screen.queryByRole('region', { name: title })).not.toBeInTheDocument();
});

it.each(['  КИНЕМАТИКА  ', 'Динамика'])('remembers a checked answer (%s) and never offers it on return', value => {
  const view = show();
  stopScrolling();
  expect(screen.getByRole('button', { name: 'Проверить' })).toBeDisabled();
  enter(value);
  const sheet = screen.getByRole('region', { name: title });
  if (value.trim() === 'КИНЕМАТИКА') {
    expect(within(sheet).getByText('Верно', { exact: true })).toBeVisible();
    expect(within(sheet).queryByText(/объясняет/)).not.toBeInTheDocument();
    advance(1599);
    expect(screen.getByRole('region', { name: title })).toBeVisible();
    advance(1);
  } else {
    expect(within(sheet).getByText(/Неверно. Кинематика описывает/)).toBeVisible();
    advance(3000);
    expect(screen.getByRole('region', { name: title })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Закрыть вопрос' }));
  }
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Продолжить' })).not.toBeInTheDocument();
  view.unmount();
  show();
  stopScrolling();
  expect(screen.queryByRole('region', { name: title })).not.toBeInTheDocument();
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});

it('checks an answer when local browser storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  show();
  stopScrolling();
  enter('Динамика');
  expect(screen.getByText(/Неверно. Кинематика описывает/)).toBeVisible();
});

it('supports keyboard reading and ignores zoom gestures', () => {
  show();
  fireEvent.wheel(window, { deltaY: 120, ctrlKey: true });
  advance(600);
  expect(screen.queryByRole('region', { name: title })).not.toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'PageDown' });
  advance(600);
  expect(screen.getByRole('region', { name: title })).toBeVisible();
});

it('does not offer an overdue question after a fast jump and can offer it on return', () => {
  const view = show();
  let top = -1500;
  vi.spyOn(view.container.querySelector('span')!, 'getBoundingClientRect').mockImplementation(() => ({ top } as DOMRect));
  stopScrolling();
  expect(screen.queryByRole('region', { name: title })).not.toBeInTheDocument();
  top = 150;
  stopScrolling();
  expect(screen.getByRole('region', { name: title })).toBeVisible();
});

it('checks the current reading position after the scroll debounce finishes', () => {
  const view = show();
  let top = 150;
  vi.spyOn(view.container.querySelector('span')!, 'getBoundingClientRect').mockImplementation(() => ({ top } as DOMRect));
  fireEvent.scroll(window); advance(400);
  top = -1500;
  fireEvent.scroll(window); advance(600);
  expect(screen.queryByRole('region', { name: title })).not.toBeInTheDocument();
});

it('restores a visible previous focus target', () => {
  show();
  const link = screen.getByRole('link', { name: 'Следующий раздел' });
  vi.spyOn(link, 'getBoundingClientRect').mockReturnValue({ top: 100, bottom: 140 } as DOMRect);
  link.focus(); stopScrolling();
  screen.getByRole('textbox', { name: 'Ваш ответ' }).focus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(link).toHaveFocus();
});

it('returns to the visible reading paragraph instead of the chapter start', () => {
  show(); stopScrolling();
  const paragraph = screen.getByText('Продолжение главы');
  vi.spyOn(paragraph, 'getBoundingClientRect').mockReturnValue({ top: 100, bottom: 140 } as DOMRect);
  screen.getByRole('textbox', { name: 'Ваш ответ' }).focus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(paragraph).toHaveFocus();
  expect(paragraph).toHaveAttribute('tabindex', '-1');
  screen.getByRole('link', { name: 'Следующий раздел' }).focus();
  expect(paragraph).not.toHaveAttribute('tabindex');
});

it('closes with Escape and returns keyboard focus to the text', () => {
  show();
  stopScrolling();
  screen.getByRole('textbox', { name: 'Ваш ответ' }).focus();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('region', { name: title })).not.toBeInTheDocument();
  expect(screen.getByText('Введение')).toHaveFocus();
});

it('keeps the panel inert during its exit animation and removes it when the animation finishes', () => {
  show();
  stopScrolling();
  const panel = screen.getByRole('region', { name: title });
  fireEvent.click(screen.getByRole('button', { name: 'Закрыть вопрос' }));
  expect(panel).toHaveAttribute('data-state', 'closing');
  expect(panel).toHaveAttribute('inert');
  // jsdom не предоставляет AnimationEvent, поэтому React выбирает WebKit-событие.
  fireEvent(panel, new Event('webkitAnimationEnd', { bubbles: true }));
  expect(panel).not.toBeInTheDocument();
});
