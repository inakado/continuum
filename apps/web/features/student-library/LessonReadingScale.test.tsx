import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import LessonReadingScale from './LessonReadingScale';
import { READING_SCALE_KEY } from './useLessonReadingScale';

let mobile = false;
let listeners: Set<() => void>;
beforeEach(() => {
  mobile = false; listeners = new Set(); localStorage.clear();
  vi.stubGlobal('matchMedia', vi.fn(() => ({ get matches() { return mobile; }, addEventListener: (_: string, listener: () => void) => listeners.add(listener), removeEventListener: (_: string, listener: () => void) => listeners.delete(listener) })));
  vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function show() { return render(<article data-reading-scale="100"><LessonReadingScale /><p>Текст занятия</p></article>); }
const smaller = () => screen.getByRole('button', { name: 'Уменьшить масштаб текста' });
const larger = () => screen.getByRole('button', { name: 'Увеличить масштаб текста' });
const reset = () => screen.getByRole('button', { name: 'Сбросить масштаб до 100%' });

it('changes the article scale, respects both limits and resets the saved preference', () => {
  const view = show();
  fireEvent.click(smaller()); fireEvent.click(smaller());
  expect(smaller()).toBeDisabled();
  expect(reset()).toHaveTextContent('80%');
  expect(view.container.querySelector('article')?.style.getPropertyValue('--lesson-reading-scale')).toBe('0.8');
  for (let i = 0; i < 4; i++) fireEvent.click(larger());
  expect(larger()).toBeDisabled();
  expect(reset()).toHaveTextContent('120%');
  fireEvent.click(reset());
  expect(reset()).toHaveTextContent('100%');
  expect(localStorage.getItem(READING_SCALE_KEY)).toBe('100');
});

it('restores the preference and clamps it on a phone without losing the desktop choice', () => {
  localStorage.setItem(READING_SCALE_KEY, '80');
  show(); expect(reset()).toHaveTextContent('80%');
  act(() => { mobile = true; listeners.forEach(listener => listener()); });
  expect(reset()).toHaveTextContent('90%'); expect(smaller()).toBeDisabled();
  expect(localStorage.getItem(READING_SCALE_KEY)).toBe('80');
  act(() => { mobile = false; listeners.forEach(listener => listener()); });
  expect(reset()).toHaveTextContent('80%');
});

it.each(['junk', '85', '130', '', 'NaN'])('ignores an invalid stored scale: %s', (value) => {
  localStorage.setItem(READING_SCALE_KEY, value); show();
  expect(reset()).toHaveTextContent('100%');
});

it('works when browser storage is unavailable', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
  show(); fireEvent.click(smaller()); expect(reset()).toHaveTextContent('90%');
  fireEvent.click(reset()); expect(reset()).toHaveTextContent('100%');
});

it('controls the linked article from a header outside the reading content', () => {
  localStorage.setItem(READING_SCALE_KEY, '80');
  const view = render(<><header><LessonReadingScale articleId="lesson" /></header><article id="lesson" data-reading-scale="100"><p>Текст занятия</p></article></>);
  expect(view.container.querySelector('article')).toHaveAttribute('data-reading-scale', '80');
  expect(reset()).toHaveTextContent('80%');
  fireEvent.click(larger());
  expect(view.container.querySelector('article')).toHaveAttribute('data-reading-scale', '90');
  expect(localStorage.getItem(READING_SCALE_KEY)).toBe('90');
});
