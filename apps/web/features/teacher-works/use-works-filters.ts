"use client";
import { useSearchParams } from 'next/navigation';

export function readWorksFilters(params: URLSearchParams) {
  return { search: (params.get('search') ?? '').slice(0, 200), archived: params.get('show') === 'archived' };
}
export function worksFilterQuery(filters: ReturnType<typeof readWorksFilters>) {
  const query = new URLSearchParams();
  if (filters.search) query.set('search', filters.search.slice(0, 200));
  if (filters.archived) query.set('show', 'archived');
  return query.toString();
}
export function worksListHref(params: URLSearchParams) {
  const query = worksFilterQuery(readWorksFilters(params));
  return `/teacher/works${query ? `?${query}` : ''}`;
}
export function useWorksFilters() {
  const params = useSearchParams();
  const filters = readWorksFilters(new URLSearchParams(params.toString()));
  function update(patch: Partial<typeof filters>, replace = false) {
    const next = { ...readWorksFilters(new URLSearchParams(window.location.search)), ...patch };
    const query = worksFilterQuery(next);
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
  }
  return { ...filters, update, listQuery: worksFilterQuery(filters) };
}
