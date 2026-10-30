import { useState } from 'react';
import type { AssessmentStatistics, ScoreDistribution } from '@continuum/shared';
import StatisticsScoreTable from './StatisticsScoreTable';
import StatisticsTableToolbar from './StatisticsTableToolbar';
import type { StatisticsFilters } from './use-statistics-filters';
import type { StatisticsGroup } from './statistics-table';
import styles from './teacher-statistics.module.css';

type Props = { data: AssessmentStatistics; distributions: ScoreDistribution[]; filters: StatisticsFilters; onCondition: (taskId: string) => void; onGroup: (group: StatisticsGroup) => void };
export default function StatisticsTasks({ data, distributions, filters, onCondition, onGroup }: Props) {
  const [search, setSearch] = useState('');
  const query = search.trim().replace(/^№\s*/, '').toLocaleLowerCase('ru');
  const rows = data.tasks.map((task, index) => ({ id: task.id, title: task.title, order: index + 1, max: task.maxPoints, distribution: distributions[index] }))
    .filter((row) => /^\d+$/.test(query) ? row.order === Number(query) : row.title.toLocaleLowerCase('ru').includes(query));
  return <>
    <StatisticsTableToolbar filters={filters} search={search} onSearch={setSearch} label="Найти задание" count={`Заданий: ${rows.length}`} />
    {rows.length > 0 && <p className={styles.mobileHint}>Номер — условие · балл — ученики. Итоги — правее →</p>}
    <StatisticsScoreTable rows={rows} max={Math.max(...data.tasks.map((task) => task.maxPoints))} unit={filters.unit} sort={filters.sort} descending={filters.descending} onSort={filters.changeSort} onLabel={onCondition} onGroup={(taskId, bucket) => onGroup({ taskId, assignmentId: filters.classId, bucket })} />
    {!rows.length && search && <button className={styles.textAction} onClick={() => setSearch('')}>Сбросить поиск</button>}
    {rows.length > 0 && <div className={styles.tableFooter}><p>{filters.unit === 'percent' ? 'Проценты — среди учеников с результатом по заданию.' : 'Количество учеников с каждым баллом по заданию.'}</p><p>Непроверенные не считаются нулём · — балл неприменим или нет результатов</p></div>}
  </>;
}
