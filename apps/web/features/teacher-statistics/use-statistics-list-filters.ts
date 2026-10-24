"use client";
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import type { AssignmentSummary } from '@continuum/shared';

const uuid = z.uuid().catch('');
export function readStatisticsListFilters(params: URLSearchParams) {
  return { search: (params.get('search') ?? '').slice(0, 200), classId: uuid.parse(params.get('class')) };
}
export function statisticsListQuery(filters: ReturnType<typeof readStatisticsListFilters>) {
  const query = new URLSearchParams();
  if (filters.search) query.set('search', filters.search.slice(0, 200));
  const classId = uuid.parse(filters.classId);
  if (classId) query.set('class', classId);
  return query.toString();
}
export function statisticsListHref(reportParams: URLSearchParams) {
  const query = statisticsListQuery({ search: reportParams.get('listSearch') ?? '', classId: reportParams.get('listClass') ?? '' });
  return `/teacher/statistics${query ? `?${query}` : ''}`;
}
export function statisticsReportHref(work: Pick<AssignmentSummary, 'versionId' | 'classes'>, filters: ReturnType<typeof readStatisticsListFilters>) {
  const query = new URLSearchParams();
  if (filters.search) query.set('listSearch', filters.search.slice(0, 200));
  const group = work.classes.find((item) => (item.classId ?? item.id) === filters.classId);
  if (group) { query.set('listClass', filters.classId); query.set('class', group.id); }
  return `/teacher/statistics/${work.versionId}${query.size ? `?${query}` : ''}`;
}
export function useStatisticsListFilters() {
  const params = useSearchParams();
  const filters = readStatisticsListFilters(new URLSearchParams(params.toString()));
  function update(patch: Partial<typeof filters>, replace = false) {
    const query = statisticsListQuery({ ...readStatisticsListFilters(new URLSearchParams(window.location.search)), ...patch });
    const url = `/teacher/statistics${query ? `?${query}` : ''}`;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
  }
  return { ...filters, update };
}
