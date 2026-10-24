import type { ScoreDistribution, StatisticsStudent } from '@continuum/shared';

export type StatisticsUnit = 'percent' | 'count';
export type StatisticsSort = 'order' | 'title' | 'scored' | 'pending' | `score-${number}`;
export type StatisticsBucket = number | 'scored' | 'pending';
export type StatisticsGroup = { taskId: string; assignmentId: string; bucket: StatisticsBucket };
export type StatisticsSelection =
  | { kind: 'task'; taskId: string }
  | { kind: 'group'; group: StatisticsGroup }
  | { kind: 'answer'; taskId: string; recipient: string; back?: StatisticsGroup };
export type StatisticsTableRow = { id: string; title: string; order: number; max: number; distribution: ScoreDistribution };

export function readStatisticsSort(value: string | null): StatisticsSort {
  if (value === 'title' || value === 'scored' || value === 'pending') return value;
  if (value && /^score-(?:\d|[1-9]\d|100)$/.test(value)) return value as StatisticsSort;
  return 'order';
}
export const scoreTone = (points: number, max: number) => points === max ? 'full' : points === 0 ? 'zero' : 'partial';
export const statisticsStateLabels = { not_started: 'Не начата', in_progress: 'В работе', no_photos: 'Нет фото', awaiting_review: 'Ожидает проверки', unavailable: 'Нет детализации' };
export const formatDistributionValue = (bucket: ScoreDistribution['buckets'][number], unit: StatisticsUnit) => unit === 'count' ? String(bucket.count) : bucket.percentage === null ? '—' : `${bucket.percentage.toLocaleString('ru')}%`;

export function sortStatisticsRows(rows: StatisticsTableRow[], sort: StatisticsSort, descending: boolean, unit: StatisticsUnit) {
  const numeric = (row: StatisticsTableRow) => {
    if (sort === 'order') return row.order;
    if (sort === 'scored') return row.distribution.scoredCount;
    if (sort === 'pending') return row.distribution.pendingCount;
    const points = Number(sort.slice('score-'.length));
    const bucket = row.distribution.buckets.find((entry) => entry.points === points);
    return points > row.max || !bucket || row.distribution.scoredCount === 0 ? null : unit === 'count' ? bucket.count : bucket.count / row.distribution.scoredCount;
  };
  return [...rows].sort((a, b) => {
    if (sort === 'title') return (descending ? -1 : 1) * a.title.localeCompare(b.title, 'ru');
    const av = numeric(a), bv = numeric(b);
    if (av === null || bv === null) return av === bv ? a.order - b.order : av === null ? 1 : -1;
    return (descending ? -1 : 1) * (av - bv) || a.order - b.order;
  });
}
export function statisticsGroupStudents(students: StatisticsStudent[], taskIndex: number, group: StatisticsGroup) {
  return students.filter((student) => {
    if (group.assignmentId && student.assignmentId !== group.assignmentId) return false;
    const cell = student.scores[taskIndex];
    if (!cell) return false;
    return group.bucket === 'pending' ? cell.state !== 'scored' : cell.state === 'scored' && (group.bucket === 'scored' || cell.points === group.bucket);
  });
}
