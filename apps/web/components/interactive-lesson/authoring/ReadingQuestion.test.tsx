import userEvent from '@testing-library/user-event';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import ReadingQuestion from './ReadingQuestion';
import { LessonEnvironmentProvider, type LessonEnvironment } from './LessonEnvironment';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
const question = <ReadingQuestion id="new-question" title="Новый термин?" answer="Путь" explanation="Длина траектории." />;
function offer() { fireEvent.wheel(window, { deltaY: 100 }); act(() => vi.advanceTimersByTime(600)); }
function environment(answers = {}): LessonEnvironment { return { state: { readingScale: 100, answers }, saveAnswer: vi.fn(), setReadingScale: vi.fn() }; }

it('uses the host-initialized answer before offering a completed question in an opaque iframe', () => {
  const env = environment({ 'new-question': 'incorrect' });
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('opaque origin'); });
  render(<LessonEnvironmentProvider value={env}>{question}</LessonEnvironmentProvider>);
  offer();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});
it('writes only its own configured question result through the host adapter', () => {
  const env = environment({ other: 'correct' });
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  render(<LessonEnvironmentProvider value={env}>{question}</LessonEnvironmentProvider>);
  offer();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '  ПУТЬ  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));
  expect(env.saveAnswer).toHaveBeenCalledExactlyOnceWith('new-question', 'correct');
  expect(storage).not.toHaveBeenCalled();
  expect(screen.getByText('Верно')).toBeVisible();
});
it('preserves exact-match punctuation and shows the configured explanation after an error', () => {
  const env = environment();
  render(<LessonEnvironmentProvider value={env}>{question}</LessonEnvironmentProvider>);
  offer();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Путь.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Проверить' }));
  expect(env.saveAnswer).toHaveBeenCalledExactlyOnceWith('new-question', 'incorrect');
  expect(screen.getByText('Неверно. Длина траектории.')).toBeVisible();
});

it('checks native Enter in the input without depending on a permitted form submission', () => {
  const env = environment();
  render(<LessonEnvironmentProvider value={env}>{question}</LessonEnvironmentProvider>);
  offer();
  const input = screen.getByRole('textbox');
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(env.saveAnswer).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: 'Путь' } });
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
  expect(env.saveAnswer).not.toHaveBeenCalled();
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(env.saveAnswer).toHaveBeenCalledExactlyOnceWith('new-question', 'correct');
});
it('checks keyboard Enter on the button through a click, without native form submission', async () => {
  const env = environment();
  render(<LessonEnvironmentProvider value={env}>{question}</LessonEnvironmentProvider>);
  offer();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Путь' } });
  vi.useRealTimers();
  const user = userEvent.setup();
  const button = screen.getByRole('button', { name: 'Проверить' });
  expect(button).toHaveAttribute('type', 'button');
  const submit = vi.fn();
  button.closest('form')!.addEventListener('submit', submit);
  button.focus();
  await user.keyboard('{Enter}');
  expect(env.saveAnswer).toHaveBeenCalledExactlyOnceWith('new-question', 'correct');
  expect(submit).not.toHaveBeenCalled();
});
