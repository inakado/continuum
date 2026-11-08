import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mountLesson } from './package-runtime';
import type { LessonDefinition } from './lesson-definition';
import ReadingQuestion from './ReadingQuestion';

const definition: LessonDefinition = { lessonId: 'test-lesson', title: 'Проверка', articleId: 'test-article', titleId: 'test-title', context: 'Физика', sections: [{ id: 'test-title', title: 'Начало' }, { id: 'second', title: 'Раздел' }], questions: [{ id: 'test-question', revision: 1 }], Content: () => <><p>Текст</p><ReadingQuestion id="test-question" title="Вопрос" answer="Ответ" explanation="Пояснение" /><h2 id="second">Раздел</h2></> };
let dispose: (() => void) | undefined;
const envelope = { channel: 'continuum.lesson', version: 1 };
function receive(message: object, source: MessageEventSource = window) {
  act(() => { window.dispatchEvent(new MessageEvent('message', { data: { ...envelope, ...message }, source })); });
}
beforeEach(() => { vi.useFakeTimers(); document.body.innerHTML = '<div id="lesson-root"></div>'; vi.spyOn(window, 'postMessage').mockImplementation(() => {}); vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); });
afterEach(() => { act(() => dispose?.()); dispose = undefined; vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.documentElement.removeAttribute('data-lesson-host-visible'); });
function mount() { act(() => { dispose = mountLesson(definition, tex => tex); }); }
function init(answers = {}) { receive({ type: 'init', state: { readingScale: 100, answers }, visible: true }); }

it('waits for a validated parent initialization and rejects another window', () => {
  mount();
  expect(screen.queryByText('Проверка')).not.toBeInTheDocument();
  receive({ type: 'init', state: { readingScale: 100, answers: {} }, visible: true }, {} as Window);
  receive({ type: 'init', state: { readingScale: 999, answers: {} }, visible: true });
  expect(screen.queryByText('Проверка')).not.toBeInTheDocument();
  init();
  expect(screen.getByRole('heading', { name: 'Проверка' })).toBeVisible();
});
it('keeps content mounted across repeated handshakes and ignores unknown section targets', () => {
  mount(); init();
  const article = document.getElementById('test-article');
  const target = document.getElementById('second')!;
  target.scrollIntoView = vi.fn();
  receive({ type: 'navigate', sectionId: 'unknown' });
  expect(target.scrollIntoView).not.toHaveBeenCalled();
  receive({ type: 'navigate', sectionId: 'second' });
  expect(target.scrollIntoView).toHaveBeenCalledOnce();
  expect(target).toHaveFocus();
  init();
  expect(document.getElementById('test-article')).toBe(article);
});
it('uses saved answers before rendering and suppresses a completed question', () => {
  mount(); init({ 'test-question': 'incorrect', unknown: 'correct' });
  act(() => { window.dispatchEvent(new WheelEvent('wheel', { deltaY: 100 })); vi.advanceTimersByTime(600); });
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  const messages = vi.mocked(window.postMessage).mock.calls.map(call => call[0]);
  expect(messages).toContainEqual({ ...envelope, type: 'state', state: { readingScale: 100, answers: { 'test-question': 'incorrect' } } });
});
it('exposes host visibility without granting access to its origin or storage', () => {
  mount(); init();
  receive({ type: 'visibility', visible: false });
  expect(document.documentElement.dataset.lessonHostVisible).toBe('false');
  receive({ type: 'visibility', visible: true });
  expect(document.documentElement.dataset.lessonHostVisible).toBe('true');
});
