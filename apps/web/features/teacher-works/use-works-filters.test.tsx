import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readWorksFilters, useWorksFilters, worksListHref } from './use-works-filters';
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  return { useSearchParams: () => new URLSearchParams(useSyncExternalStore((listener) => { window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener); }, () => window.location.search)) };
});
beforeEach(() => {
  history.replaceState({}, '', '/teacher/works');
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method].bind(history);
    vi.spyOn(history, method).mockImplementation((data, unused, url) => { original(data, unused, url); window.dispatchEvent(new PopStateEvent('popstate')); });
  }
});
afterEach(() => vi.restoreAllMocks());
it('restores context across remount and Back/Forward, replaces search and omits defaults', async () => {
  history.replaceState({}, '', '/teacher/works?search=МКТ&show=archived');
  const hook = renderHook(() => useWorksFilters());
  expect(hook.result.current).toMatchObject({ search: 'МКТ', archived: true });
  act(() => hook.result.current.update({ archived: false }));
  const length = history.length;
  act(() => hook.result.current.update({ search: 'газ' }, true));
  expect(history.length).toBe(length);
  act(() => history.back()); await waitFor(() => expect(hook.result.current).toMatchObject({ search: 'МКТ', archived: true }));
  act(() => history.forward()); await waitFor(() => expect(hook.result.current).toMatchObject({ search: 'газ', archived: false }));
  hook.unmount(); const restored = renderHook(() => useWorksFilters());
  expect(restored.result.current.search).toBe('газ');
  act(() => restored.result.current.update({ search: '' }, true));
  expect(location.search).toBe('');
});
it('bounds URL search and accepts only the explicit archive value', () => {
  expect(readWorksFilters(new URLSearchParams('show=wrong'))).toEqual({ search: '', archived: false });
  expect(readWorksFilters(new URLSearchParams('search=' + 'x'.repeat(300))).search).toHaveLength(200);
  expect(worksListHref(new URLSearchParams('search=МКТ&show=archived&returnTo=https://foreign.example'))).toBe('/teacher/works?search=%D0%9C%D0%9A%D0%A2&show=archived');
  expect(worksListHref(new URLSearchParams('returnTo=https://foreign.example'))).toBe('/teacher/works');
});
