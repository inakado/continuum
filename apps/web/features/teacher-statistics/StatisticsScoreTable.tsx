import { pointsLabel } from '@/features/teacher-bank/task-source';
import { formatDistributionValue, scoreTone, sortStatisticsRows, type StatisticsBucket, type StatisticsSort, type StatisticsTableRow, type StatisticsUnit } from './statistics-table';
import styles from './teacher-statistics.module.css';

type Props = {
  rows: StatisticsTableRow[]; max: number; unit: StatisticsUnit;
  label?: string; showNumbers?: boolean; sort?: StatisticsSort; descending?: boolean; compact?: boolean;
  onSort?: (sort: StatisticsSort) => void; onLabel?: (id: string) => void;
  onGroup: (id: string, bucket: StatisticsBucket) => void;
};
export default function StatisticsScoreTable({ rows, max, unit, label = 'Задание', showNumbers = true, sort = 'order', descending = false, onSort, onLabel, onGroup, compact = false }: Props) {
  const points = Array.from({ length: (compact ? max : Math.max(3, max)) + 1 }, (_, n) => n);
  const ordered = sortStatisticsRows(rows, sort, descending, unit);
  function heading(text: string, key: StatisticsSort) {
    return onSort ? <button className={styles.sortButton} onClick={() => onSort(key)}>{text}{sort === key && <span aria-hidden="true">{descending ? ' ↓' : ' ↑'}</span>}</button> : text;
  }
  const ariaSort = (key: StatisticsSort) => sort === key ? descending ? 'descending' as const : 'ascending' as const : undefined;
  return <div className={styles.tableScroll} tabIndex={0} role="region" aria-label={label === 'Класс' ? 'Распределение баллов по классам' : 'Распределение учеников по баллам'}>
    <table className={styles.scoreTable} style={{ minWidth: `${compact ? 120 + points.length * 64 : 710 + Math.max(0, max - 3) * 88}px` }}>
      <colgroup>{showNumbers && <col className={styles.numberColumn} />}<col className={styles.titleColumn} />{!compact && <col className={styles.maxColumn} />}{points.map((point) => <col className={styles.pointColumn} key={point} />)}{!compact && <><col className={styles.resultColumn} /><col className={styles.pendingColumn} /></>}</colgroup>
      <thead><tr>{showNumbers && <th scope="col" rowSpan={2} className={styles.numeric} aria-sort={ariaSort('order')}>{heading('№', 'order')}</th>}
        <th scope="col" rowSpan={2} className={styles.rowTitle} aria-sort={ariaSort('title')}>{heading(label, 'title')}</th>{!compact && <th scope="col" rowSpan={2} className={`${styles.numeric} ${styles.maxCell}`}>Макс.</th>}
        <th scope="colgroup" colSpan={points.length} className={styles.groupHeading}>Распределение учеников по полученным баллам</th>
        {!compact && <><th scope="col" rowSpan={2} className={`${styles.numeric} ${styles.resultCell}`} aria-sort={ariaSort('scored')}>{heading('Учтено', 'scored')}</th>
        <th scope="col" rowSpan={2} className={styles.numeric} aria-sort={ariaSort('pending')}>{heading('Без результата', 'pending')}</th></>}
      </tr><tr>{points.map((point) => <th scope="col" key={point} className={styles.numeric} aria-sort={ariaSort(`score-${point}`)}>{heading(pointsLabel(point), `score-${point}`)}</th>)}</tr></thead>
      <tbody>{ordered.map((row) => <tr key={row.id}>
        {showNumbers && <td className={`${styles.numeric} ${styles.rowNumber}`}>{row.order}</td>}
        <th scope="row" className={styles.rowTitle}>{onLabel ? <button className={styles.taskTitle} title={row.title} onClick={() => onLabel(row.id)}>{row.title}</button> : <span title={row.title}>{row.title}</span>}</th>
        {!compact && <td className={`${styles.numeric} ${styles.maxCell}`}>{row.max}</td>}
        {points.map((point) => {
          const bucket = row.distribution.buckets.find((entry) => entry.points === point);
          const applicable = point <= row.max;
          if (!applicable || !bucket || row.distribution.scoredCount === 0) return <td key={point} className={`${styles.numeric} ${styles.unavailable}`} title={applicable ? 'Окончательных результатов пока нет' : `Максимум за задание: ${row.max}`}>—</td>;
          return <td key={point} className={`${styles.numeric} ${styles.scoreCell}`}><button className={styles.scoreButton} disabled={bucket.count === 0} data-tone={scoreTone(point, row.max)} title={`${bucket.count} из ${row.distribution.scoredCount} учеников`} aria-label={`${row.title}: ${pointsLabel(point)}, учеников: ${bucket.count}, доля: ${bucket.percentage?.toLocaleString('ru')}%`} onClick={() => onGroup(row.id, point)}>{formatDistributionValue(bucket, unit)}</button></td>;
        })}
        {!compact && <><td className={`${styles.numeric} ${styles.resultCell}`}><button className={styles.scoreButton} disabled={row.distribution.scoredCount === 0} onClick={() => onGroup(row.id, 'scored')} aria-label={`${row.title}: учтено ${row.distribution.scoredCount} из ${row.distribution.scoredCount + row.distribution.pendingCount}`}>{row.distribution.scoredCount}<span className={styles.muted}> / {row.distribution.scoredCount + row.distribution.pendingCount}</span></button></td>
        <td className={styles.numeric}><button className={styles.scoreButton} disabled={row.distribution.pendingCount === 0} onClick={() => onGroup(row.id, 'pending')} aria-label={`${row.title}: без результата ${row.distribution.pendingCount}`}>{row.distribution.pendingCount}</button></td></>}
      </tr>)}</tbody>
    </table>
    {rows.length === 0 && <p className={styles.tableEmpty}>По этим фильтрам ничего не найдено.</p>}
  </div>;
}
