import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { bankFilterParams, readBankFilters, useBankFilters } from './use-bank-filters';

vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (listener: () => void) => { window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener); };
  return { useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search)) };
});
beforeEach(() => {
  history.replaceState({}, '', '/teacher/bank');
  // Next synchronizes useSearchParams after native history writes; emulate only that seam.
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method].bind(history);
    vi.spyOn(history, method).mockImplementation((data, unused, url) => { original(data, unused, url); window.dispatchEvent(new PopStateEvent('popstate')); });
  }
});
afterEach(() => vi.restoreAllMocks());
it('validates each URL field independently without losing legitimate filters', () => {
  expect(readBankFilters(new URLSearchParams('grade=wrong&type=wrong&exam=wrong&source=&page=-2&topic=МКТ&search=газ&task=wrong'))).toEqual({ gradeBand: 'grade_10_11', search: 'газ', topic: 'МКТ', type: undefined, exam: undefined, source: undefined, page: 1, taskId: null });
  expect(readBankFilters(new URLSearchParams('page=999999999999&search=' + 'x'.repeat(300))).search).toHaveLength(200);
});
it('round-trips supported fields, omits defaults and never carries unrelated parameters', () => {
  const filters = readBankFilters(new URLSearchParams('grade=grade_8&search=газ+&topic=МКТ&type=short_number&exam=none&source=Авторское&page=2&task=00000000-0000-4000-8000-000000000001&token=secret'));
  expect(readBankFilters(new URLSearchParams(bankFilterParams(filters)))).toEqual(filters);
  expect(bankFilterParams(filters)).not.toContain('token');
  expect(bankFilterParams(readBankFilters(new URLSearchParams()))).toBe('');
});
it('restores direct links and remounts, uses replace for search and supports Back/Forward', async () => {
  history.replaceState({}, '', '/teacher/bank?grade=grade_8&topic=МКТ&exam=ege&source=Школково&page=2');
  const hook = renderHook(() => useBankFilters());
  expect(hook.result.current).toMatchObject({ gradeBand: 'grade_8', topic: 'МКТ', exam: 'ege', source: 'Школково', page: 2 });
  act(() => hook.result.current.update({ type: 'matching', page: 1 }));
  const entries = history.length;
  act(() => hook.result.current.update({ search: 'газ ' }, true));
  expect(hook.result.current.search).toBe('газ '); expect(history.length).toBe(entries);
  act(() => history.back()); await waitFor(() => expect(hook.result.current.page).toBe(2));
  act(() => history.forward()); await waitFor(() => expect(hook.result.current.type).toBe('matching'));
  hook.unmount(); const restored = renderHook(() => useBankFilters());
  expect(restored.result.current.search).toBe('газ ');
});
