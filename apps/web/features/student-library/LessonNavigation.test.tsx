import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import LessonNavigation from './LessonNavigation';
import { lessonSections } from './lesson-navigation';

let frames: FrameRequestCallback[], scroll: number, headerHeight: number;
beforeEach(() => {
  localStorage.clear(); frames = []; scroll = 0; headerHeight = 64;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const index = lessonSections.findIndex(({ id }) => id === this.id);
    return { top: index < 0 ? 0 : index * 1000 - scroll, bottom: this.tagName === 'HEADER' ? headerHeight : 0, left: 200 } as DOMRect;
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function flush() { act(() => { frames.splice(0).forEach((callback) => callback(0)); }); }
function show() { render(<><header><LessonNavigation /></header><article id="kinematics-lesson">{lessonSections.map(({ id, title }) => <h2 key={id} id={id}>{title}</h2>)}</article></>); flush(); }

it.each([64, 58])('tracks the visible section at a %s px header, including an exact anchor landing', (height) => {
  headerHeight = height; show();
  expect(document.querySelector('a[href="#kinematics-title"]')).toHaveAttribute('aria-current', 'location');
  scroll = 3000 - headerHeight - 24;
  fireEvent.scroll(window); flush();
  expect(document.querySelector('a[href="#point-position-title"]')).toHaveAttribute('aria-current', 'location');
  scroll = 7500;
  fireEvent.scroll(window); flush();
  expect(document.querySelector('a[href="#displacement-theory"]')).toHaveAttribute('aria-current', 'location');
});

it('moves keyboard focus to the chosen section and removes temporary tabindex on leaving', () => {
  show();
  const panel = document.querySelector<HTMLElement>('[popover]')!;
  const hide = vi.fn(); Object.defineProperty(panel, 'hidePopover', { value: hide });
  fireEvent.click(document.querySelector('a[href="#radius-vector-theory"]')!);
  const heading = screen.getByRole('heading', { name: 'Радиус-вектор' });
  expect(hide).toHaveBeenCalledOnce();
  expect(heading).toHaveFocus();
  screen.getByRole('button', { name: 'Разделы занятия' }).focus();
  expect(heading).not.toHaveAttribute('tabindex');
});
