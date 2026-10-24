"use client";
import { useSearchParams } from 'next/navigation';
import { z } from 'zod';
import { readStatisticsSort, type StatisticsSort, type StatisticsUnit } from './statistics-table';
import { statisticsListHref } from './use-statistics-list-filters';

const view = z.enum(['tasks', 'students', 'classes']).catch('tasks');
const uuid = z.uuid().catch('');
const number = z.coerce.number().int().nonnegative().max(100).catch(-1);
type Patch = { view?: 'tasks' | 'students' | 'classes'; class?: string; task?: string; score?: string; page?: string; result?: string; unit?: StatisticsUnit; sort?: StatisticsSort; direction?: 'asc' | 'desc' };
export function useStatisticsFilters() {
  const params = useSearchParams();
  const sort = readStatisticsSort(params.get('sort'));
  const descending = params.get('direction') === 'desc';
  function update(patch: Patch) {
    const next = new URLSearchParams(window.location.search);
    const defaults: Record<string, string> = { view: 'tasks', page: '1', unit: 'percent', sort: 'order', direction: 'asc', result: 'all' };
    for (const [key, value] of Object.entries(patch)) { if (value && value !== defaults[key]) next.set(key, value); else next.delete(key); }
    const url = `${window.location.pathname}${next.size ? `?${next}` : ''}`;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.pushState(null, '', url);
  }
  return {
    listHref: statisticsListHref(new URLSearchParams(params.toString())),
    view: view.parse(params.get('view')), classId: uuid.parse(params.get('class')), taskId: uuid.parse(params.get('task')),
    score: params.has('score') ? number.parse(params.get('score')) : -1,
    result: z.enum(['all', 'scored', 'pending']).catch('all').parse(params.get('result')),
    unit: z.enum(['percent', 'count']).catch('percent').parse(params.get('unit')),
    sort, descending,
    page: z.coerce.number().int().min(1).max(100000).catch(1).parse(params.get('page')),
    update,
    changeSort: (key: StatisticsSort) => update({ sort: key, direction: sort === key ? descending ? 'asc' : 'desc' : key === 'order' || key === 'title' ? 'asc' : 'desc', page: '1' }),
  };
}
export type StatisticsFilters = ReturnType<typeof useStatisticsFilters>;
