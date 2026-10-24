"use client";

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect } from 'react';
import { AssessmentBankQuerySchema, type AssessmentBankListSchema, type GradeBand } from '@continuum/shared';
import { z } from 'zod';

export function readBankFilters(params: URLSearchParams) {
  const fields = AssessmentBankQuerySchema.shape;
  return {
    gradeBand: fields.gradeBand.catch('grade_10_11').parse(params.get('grade') ?? undefined) ?? 'grade_10_11' as GradeBand,
    search: (params.get('search') ?? '').slice(0, 200),
    topic: (params.get('topic') ?? '').slice(0, 200),
    type: fields.type.catch(undefined).parse(params.get('type') ?? undefined),
    exam: fields.exam.catch(undefined).parse(params.get('exam') ?? undefined),
    source: fields.source.catch(undefined).parse(params.get('source') ?? undefined),
    page: fields.page.catch(1).parse(params.get('page') ?? undefined),
    taskId: z.string().uuid().nullable().catch(null).parse(params.get('task')),
  };
}
type BankFilters = ReturnType<typeof readBankFilters>;
export function bankFilterParams(filters: BankFilters) {
  const params = new URLSearchParams();
  if (filters.gradeBand !== 'grade_10_11') params.set('grade', filters.gradeBand);
  if (filters.search) params.set('search', filters.search);
  if (filters.topic) params.set('topic', filters.topic);
  if (filters.type) params.set('type', filters.type);
  if (filters.exam) params.set('exam', filters.exam);
  if (filters.source) params.set('source', filters.source);
  if (filters.page !== 1) params.set('page', String(filters.page));
  if (filters.taskId) params.set('task', filters.taskId);
  return params.toString();
}
export function useBankFilters() {
  const params = useSearchParams();
  const filters = readBankFilters(new URLSearchParams(params.toString()));
  const update = useCallback((patch: Partial<BankFilters>, replace = false) => {
    const query = bankFilterParams({ ...readBankFilters(new URLSearchParams(window.location.search)), ...patch });
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    if (url !== `${window.location.pathname}${window.location.search}${window.location.hash}`) {
      window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
    }
  }, []);
  return { ...filters, update };
}

export function useBankContextCorrection({ page, taskId, update }: ReturnType<typeof useBankFilters>, data: z.infer<typeof AssessmentBankListSchema> | undefined, fetching: boolean) {
  useEffect(() => {
    if (!data || fetching) return;
    const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));
    if (page > lastPage) update({ page: lastPage, taskId: null }, true);
    else if (taskId && !data.tasks.some((task) => task.id === taskId)) update({ taskId: null }, true);
  }, [data, fetching, page, taskId, update]);
}
