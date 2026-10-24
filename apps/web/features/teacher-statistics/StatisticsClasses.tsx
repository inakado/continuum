import { useState } from 'react';
import type { AssessmentStatistics, StatisticsSummary } from '@continuum/shared';
import WorkSelect from '@/features/teacher-works/WorkSelect';
import type { StatisticsFilters } from './use-statistics-filters';
import type { StatisticsGroup } from './statistics-table';
import StatisticsScoreTable from './StatisticsScoreTable';
import StatisticsTableToolbar from './StatisticsTableToolbar';
import styles from './teacher-statistics.module.css';

function PartAverage({ part, count }: { part: StatisticsSummary['total']; count: number }) {
  return <>{part.averagePoints === null ? '—' : `${part.averagePoints.toLocaleString('ru')} / ${part.maxPoints}`}<small>Учтено {part.scoredCount} из {count}</small></>;
}
export default function StatisticsClasses({ data, filters, onGroup }: { data: AssessmentStatistics; filters: StatisticsFilters; onGroup: (group: StatisticsGroup) => void }) {
  const [search, setSearch] = useState('');
  const taskIndex = data.tasks.findIndex((task) => task.id === filters.taskId);
  const task = data.tasks[taskIndex];
  const rows = data.classResults.filter((row) => (!filters.classId || row.assignmentId === filters.classId) && (data.classes.find((group) => group.id === row.assignmentId)?.title ?? '').toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru')));
  return <>
    <label className={styles.comparisonSelect}>Показать<WorkSelect aria-label="Сравнение классов" value={task?.id ?? ''} onChange={(event) => { setSearch(''); filters.update({ task: event.target.value, score: '', result: '' }); }}><option value="">Итоги двух частей</option>{data.tasks.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.title}</option>)}</WorkSelect></label>
    {task ? <>
      <StatisticsTableToolbar filters={filters} search={search} onSearch={setSearch} label="Найти класс" count={`Классов: ${rows.length}`} />
      <StatisticsScoreTable rows={rows.map((row, index) => ({ id: row.assignmentId, title: data.classes.find((group) => group.id === row.assignmentId)?.title ?? '', order: index, max: task.maxPoints, distribution: row.distributions[taskIndex] }))} max={task.maxPoints} unit={filters.unit} label="Класс" showNumbers={false} sort={filters.sort} descending={filters.descending} onSort={filters.changeSort} onGroup={(assignmentId, bucket) => onGroup({ taskId: task.id, assignmentId, bucket })} />
      <p className={styles.tableNote}>Одна версия работы · одно задание · одинаковые правила оценивания.</p>
    </> : <>
      <p className={styles.tableNote}>Средние баллы по готовым результатам каждой части. Общий итог — только по полностью завершённым и проверенным работам.</p>
      <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Сравнение результатов классов"><table className={styles.classesTable}><thead><tr><th scope="col">Класс</th><th scope="col">Учеников</th>{data.summary.automatic.maxPoints > 0 && <th scope="col">Тестовая часть</th>}{data.summary.extended.maxPoints > 0 && <th scope="col">Развёрнутые задачи</th>}<th scope="col">Общий итог</th></tr></thead><tbody>{rows.map(({ assignmentId, summary }) => <tr key={assignmentId}><th scope="row">{data.classes.find((group) => group.id === assignmentId)?.title}</th><td>{summary.studentCount}</td>{summary.automatic.maxPoints > 0 && <td><PartAverage part={summary.automatic} count={summary.studentCount} /></td>}{summary.extended.maxPoints > 0 && <td><PartAverage part={summary.extended} count={summary.studentCount} /></td>}<td><PartAverage part={summary.total} count={summary.studentCount} /></td></tr>)}</tbody></table></div>
    </>}
  </>;
}
