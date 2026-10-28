"use client";

import { useCallback, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import type { AssignmentReport } from '@continuum/shared';
import { photoFilterSchema } from './report-photo-filters';
import { readReportSearch, reportSearchKey, writeReportSearch } from '@/lib/assessment/report-search';

const statusSchema = z.enum(['all', 'not_started', 'in_progress', 'completed']);
function readReportFilters(params: URLSearchParams) {
  return {
    classId: z.string().uuid().catch('').parse(params.get('class')),
    status: statusSchema.catch('all').parse(params.get('status')),
    photos: photoFilterSchema.catch('all').parse(params.get('photos')),
    page: z.coerce.number().int().min(1).max(1_000_000).catch(1).parse(params.get('page')),
  };
}
type ReportFilters = ReturnType<typeof readReportFilters>;
function reportFilterParams(filters: ReportFilters) {
  const params = new URLSearchParams();
  if (filters.classId) params.set('class', filters.classId);
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.photos !== 'all') params.set('photos', filters.photos);
  if (filters.page !== 1) params.set('page', String(filters.page));
  return params.toString();
}
export function useReportFilters(versionId: string, classes: AssignmentReport['classes'], userId?: string) {
  const params = useSearchParams();
  const filters = readReportFilters(new URLSearchParams(params.toString()));
  const key = reportSearchKey(userId, versionId);
  const [search, setSearch] = useState('');
  useEffect(() => { setSearch(readReportSearch(key)); }, [key]);
  const update = useCallback((patch: Partial<ReportFilters>, replace = false) => {
    const query = reportFilterParams({ ...readReportFilters(new URLSearchParams(window.location.search)), ...patch });
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
    }
  }, []);
  const classId = classes.length > 1 && classes.some((item) => item.id === filters.classId) ? filters.classId : '';
  useEffect(() => { if (classId !== filters.classId) update({ classId }, true); }, [classId, filters.classId, update]);
  return { ...filters, classId, search, update, changeSearch: (value: string) => {
    const next = value.slice(0, 200);
    setSearch(next); writeReportSearch(key, next); update({ page: 1 }, true);
  } };
}
