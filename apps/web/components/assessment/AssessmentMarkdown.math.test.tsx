import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import AssessmentMarkdown from './AssessmentMarkdown';

const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts');

afterEach(() => {
  cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  document.head.querySelector('script[src="/vendor/mathjax/tex-chtml.js"]')?.remove();
  Reflect.deleteProperty(window, 'MathJax');
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts); else Reflect.deleteProperty(document, 'fonts');
});

it('measures inline and display math in their real text context and retypesets after a width change', async () => {
  let width = 640;
  const getMetricsFor = vi.fn((_node: HTMLElement, display: boolean) => ({ display, em: 18, ex: 9, containerWidth: width, scale: 1, family: 'Inter' }));
  let fontsReady!: () => void;
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: new Promise<void>((resolve) => { fontsReady = resolve; }) } });
  const tex2chtmlPromise = vi.fn(async (tex: string, options: { containerWidth: number }) => {
    const output = document.createElement('span'); output.dataset.typeset = tex; output.dataset.width = String(options.containerWidth);
    return output;
  });
  const reset = vi.fn();
  const updateDocument = vi.fn(() => {
    expect(document.querySelector('[data-typeset]')).toBeInTheDocument();
    expect(reset).toHaveBeenCalledTimes(updateDocument.mock.calls.length);
  });
  const observers: Array<{ callback: ResizeObserverCallback; target?: Element; observer: ResizeObserver }> = [];
  const disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class implements ResizeObserver {
    private entry: (typeof observers)[number];
    constructor(callback: ResizeObserverCallback) { this.entry = { callback, observer: this }; observers.push(this.entry); }
    observe(target: Element) { this.entry.target = target; }
    unobserve() {}
    disconnect = disconnect;
  });
  const append = document.head.appendChild.bind(document.head);
  vi.spyOn(document.head, 'appendChild').mockImplementation(function<T extends Node>(node: T): T {
    const result = append(node);
    if (node instanceof HTMLScriptElement && node.src.endsWith('/vendor/mathjax/tex-chtml.js')) {
      Object.assign(window, { MathJax: { startup: { promise: Promise.resolve(), document: { reset, updateDocument } }, getMetricsFor, tex2chtmlPromise } });
      queueMicrotask(() => node.dispatchEvent(new Event('load')));
    }
    return result;
  });
  const view = render(<AssessmentMarkdown images={{}} text={'Значение $x^2$.\n\n$$\\frac{a}{b}$$'} />);
  await act(async () => {});
  expect(tex2chtmlPromise).not.toHaveBeenCalled();
  await act(async () => { fontsReady(); });
  await waitFor(() => expect(tex2chtmlPromise).toHaveBeenCalledTimes(2));
  expect(updateDocument).toHaveBeenCalledTimes(2);
  expect(getMetricsFor.mock.calls.map(([, display]) => display)).toEqual([false, true]);
  expect(getMetricsFor.mock.calls.every(([node]) => node.isConnected)).toBe(true);
  expect(tex2chtmlPromise).toHaveBeenCalledWith('x^2', expect.objectContaining({ display: false, em: 18, ex: 9, containerWidth: 640 }));
  expect(tex2chtmlPromise).toHaveBeenCalledWith('\\frac{a}{b}', expect.objectContaining({ display: true }));
  expect(observers).toHaveLength(2);
  width = 280;
  const observed = observers[0];
  act(() => observed.callback([{ target: observed.target!, contentRect: new DOMRect(0, 0, width, 100) } as ResizeObserverEntry], observed.observer));
  await waitFor(() => expect(tex2chtmlPromise).toHaveBeenCalledWith('x^2', expect.objectContaining({ containerWidth: 280 })));
  let finishOld!: (node: HTMLElement) => void;
  tex2chtmlPromise.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
  width = 200;
  act(() => observed.callback([{ target: observed.target!, contentRect: new DOMRect(0, 0, width, 100) } as ResizeObserverEntry], observed.observer));
  await waitFor(() => expect(tex2chtmlPromise).toHaveBeenCalledTimes(4));
  width = 240;
  act(() => observed.callback([{ target: observed.target!, contentRect: new DOMRect(0, 0, width, 100) } as ResizeObserverEntry], observed.observer));
  await waitFor(() => expect(view.container.querySelector('[data-typeset="x^2"]')).toHaveAttribute('data-width', '240'));
  const stale = document.createElement('span'); stale.dataset.typeset = 'stale';
  await act(async () => { finishOld(stale); });
  expect(view.container.querySelector('[data-typeset="stale"]')).not.toBeInTheDocument();
  expect(updateDocument).toHaveBeenCalledTimes(4);
  view.unmount();
  expect(disconnect).toHaveBeenCalledTimes(2);
});
