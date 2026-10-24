import type { StatisticsCell } from '@continuum/shared';
import { scoreTone, statisticsStateLabels } from './statistics-table';
import styles from './teacher-statistics.module.css';

export function ScoreValue({ cell, max, compact = false }: { cell: StatisticsCell; max: number; compact?: boolean }) {
  return cell.state === 'scored' ? <span className={styles.scoreValue} data-tone={scoreTone(cell.points, max)}>{cell.points}<span className={styles.scoreMax}>/{max}</span></span> : <span className={styles.muted} title={statisticsStateLabels[cell.state]}>{compact ? '—' : statisticsStateLabels[cell.state]}</span>;
}
