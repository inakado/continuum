import { expect, it } from 'vitest';
import { formatDistributionValue, readStatisticsSort, sortStatisticsRows, type StatisticsTableRow } from './statistics-table';
const row = (id: string, max: number, counts: number[], pendingCount: number, order: number): StatisticsTableRow => ({ id, title: id, order, max, distribution: { pendingCount, scoredCount: counts.reduce((a, b) => a + b, 0), buckets: counts.map((count, points) => ({ points, count, percentage: null })) } });
it('sorts percentages by the correct row denominator and counts by actual head count, keeping nonapplicable rows last', () => {
  const rows = [row('A', 2, [2, 8, 0], 0, 1), row('B', 2, [0, 4, 0], 2, 2), row('C', 0, [0], 4, 3)];
  expect(sortStatisticsRows(rows, 'score-1', true, 'percent').map((x) => x.id)).toEqual(['B', 'A', 'C']);
  expect(sortStatisticsRows(rows, 'score-1', true, 'count').map((x) => x.id)).toEqual(['A', 'B', 'C']);
  expect(sortStatisticsRows(rows, 'score-1', false, 'count').map((x) => x.id)).toEqual(['B', 'A', 'C']);
  expect(rows.map((x) => x.id)).toEqual(['A', 'B', 'C']);
});
it('accepts only supported URL sort keys and formats a real zero differently from missing data', () => {
  expect(readStatisticsSort('score-100')).toBe('score-100');
  for (const invalid of ['score-101', 'score--1', 'score-1.5', 'other', null]) expect(readStatisticsSort(invalid)).toBe('order');
  expect(formatDistributionValue({ points: 0, count: 0, percentage: 0 }, 'percent')).toBe('0%');
  expect(formatDistributionValue({ points: 0, count: 0, percentage: null }, 'percent')).toBe('—');
  expect(formatDistributionValue({ points: 2, count: 12, percentage: 40 }, 'count')).toBe('12');
});
