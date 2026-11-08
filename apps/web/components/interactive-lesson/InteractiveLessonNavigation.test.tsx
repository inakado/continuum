import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { InteractiveLessonManifest } from '@continuum/shared';
import InteractiveLessonNavigation from './InteractiveLessonNavigation';

const manifest: InteractiveLessonManifest = { schemaVersion: 1, lessonId: 'kin-01', title: 'Кинематика', entrypoint: 'lesson.html', contentSha256: 'a'.repeat(64), sections: [{ id: 'intro', title: 'Начало' }], questions: [] };
afterEach(() => vi.restoreAllMocks());

it('shows the actual mobile scale and increases from it without overwriting the preferred desktop scale', () => {
  let mobile = true;
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ get matches() { return mobile; }, media: query } as MediaQueryList));
  const onScale = vi.fn();
  const { container } = render(<InteractiveLessonNavigation manifest={manifest} active="intro" scale={80} onNavigate={vi.fn()} onScale={onScale} disabled={false} />);
  const decrease = container.querySelector<HTMLButtonElement>('[aria-label="Уменьшить масштаб текста"]')!;
  const increase = container.querySelector<HTMLButtonElement>('[aria-label="Увеличить масштаб текста"]')!;
  const reset = container.querySelector<HTMLButtonElement>('[aria-label="Сбросить масштаб текста"]')!;
  expect(reset).toHaveTextContent('90%');
  expect(decrease).toBeDisabled();
  expect(onScale).not.toHaveBeenCalled();
  fireEvent.click(increase);
  expect(onScale).toHaveBeenCalledWith(100);
  onScale.mockClear();

  mobile = false;
  act(() => window.dispatchEvent(new Event('resize')));
  expect(reset).toHaveTextContent('80%');
  expect(decrease).toBeDisabled();
  expect(onScale).not.toHaveBeenCalled();
  fireEvent.click(increase);
  expect(onScale).toHaveBeenCalledWith(90);
});

it('closes the menu when focus enters the lesson iframe, without intercepting ordinary host focus', async () => {
  const { container } = render(<><InteractiveLessonNavigation manifest={manifest} active="intro" scale={100} onNavigate={vi.fn()} onScale={vi.fn()} disabled={false} /><iframe title="Lesson" /></>);
  const menu = container.querySelector<HTMLDivElement>('[popover]')!;
  const hidePopover = vi.fn();
  Object.defineProperty(menu, 'hidePopover', { value: hidePopover });
  vi.spyOn(menu, 'matches').mockReturnValue(true);
  const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Разделы занятия"]')!;
  trigger.focus();
  fireEvent.blur(window);
  await new Promise(resolve => setTimeout(resolve, 5));
  expect(hidePopover).not.toHaveBeenCalled();

  container.querySelector<HTMLIFrameElement>('iframe')!.focus();
  fireEvent.blur(window);
  await waitFor(() => expect(hidePopover).toHaveBeenCalledOnce());
});
