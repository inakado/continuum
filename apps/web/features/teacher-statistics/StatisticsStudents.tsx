import { useState } from 'react';
import { Download } from 'lucide-react';
import type { AssessmentStatistics, StatisticsStudent, StatisticsSummary } from '@continuum/shared';
import SearchField from '@/components/ui/SearchField';
import WorkSelect from '@/features/teacher-works/WorkSelect';
import { ScoreValue } from './ScoreValue';
import { statisticsGroupStudents, statisticsStateLabels } from './statistics-table';
import { downloadStatisticsCsv } from './statistics-csv';
import type { StatisticsFilters } from './use-statistics-filters';
import styles from './teacher-statistics.module.css';

const value = (points: number | null, max: number) => points === null ? '—' : `${points} / ${max}`;
type Props = { data: AssessmentStatistics; students: StatisticsStudent[]; summary: StatisticsSummary; filters: StatisticsFilters; onCondition: (taskId: string) => void; onAnswer: (task: string, recipient: string) => void };
export default function StatisticsStudents({ data, students, summary, filters, onCondition, onAnswer }: Props) {
  const [search, setSearch] = useState('');
  const taskIndex = data.tasks.findIndex((task) => task.id === filters.taskId);
  const task = data.tasks[taskIndex];
  const bucket = filters.score >= 0 ? filters.score : filters.result === 'all' ? null : filters.result;
  const scoped = task && bucket !== null ? statisticsGroupStudents(students, taskIndex, { taskId: task.id, assignmentId: '', bucket }) : students;
  const rows = scoped.filter((student) => `${student.name} ${student.displayName ?? ''} ${student.login}`.toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru')))
    .sort((a, b) => (a.displayName ?? a.name).localeCompare(b.displayName ?? b.name, 'ru') || a.id.localeCompare(b.id));
  const columns = data.tasks.map((item, index) => ({ item, index })).filter(({ item }) => !task || item.id === task.id);
  const totals: { label: string; title: string; key: 'automaticPoints' | 'extendedPoints' | 'totalPoints'; max: number }[] = [
    ...(summary.automatic.maxPoints > 0 ? [{ label: 'Тест', title: 'Тестовая часть', key: 'automaticPoints' as const, max: summary.automatic.maxPoints }] : []),
    ...(summary.extended.maxPoints > 0 ? [{ label: 'Решения', title: 'Развёрнутые задачи', key: 'extendedPoints' as const, max: summary.extended.maxPoints }] : []),
    { label: 'Итог', title: 'Общий итог', key: 'totalPoints', max: summary.total.maxPoints },
  ];
  const page = Math.min(filters.page, Math.max(1, Math.ceil(rows.length / 20)));
  const shown = rows.slice((page - 1) * 20, page * 20);
  function changeResult(next: string) { filters.update({ score: /^\d+$/.test(next) ? next : '', result: next === 'pending' || next === 'scored' ? next : '', page: '1' }); }
  return <>
    <div className={`${styles.toolbar} ${styles.studentToolbar}`}>
      <SearchField label="Поиск ученика" placeholder="Найти ученика" value={search} onValueChange={(text) => { setSearch(text); filters.update({ page: '1' }); }} maxLength={200} />
      <div className={styles.toolbarRight}>
        <WorkSelect aria-label="Задание" value={task?.id ?? ''} onChange={(event) => filters.update({ task: event.target.value, score: '', result: '', page: '1' })}><option value="">Все задания</option>{data.tasks.map((item, index) => <option key={item.id} value={item.id}>{index + 1}. {item.title}</option>)}</WorkSelect>
        {task && <WorkSelect aria-label="Полученный балл" value={bucket === null ? '' : String(bucket)} onChange={(event) => changeResult(event.target.value)}><option value="">Все результаты</option><option value="scored">Есть результат</option><option value="pending">Без результата</option>{Array.from({ length: task.maxPoints + 1 }, (_, points) => <option value={points} key={points}>{points} из {task.maxPoints}</option>)}</WorkSelect>}
      </div>
    </div>
    {shown.length > 0 && <p className={styles.mobileHint}>Прокрутите таблицу вправо, чтобы увидеть остальные задания →</p>}
    {shown.length ? <div className={`${styles.tableScroll} ${styles.matrixScroll}`} tabIndex={0} role="region" aria-label="Баллы учеников по заданиям">
      <table className={styles.matrix} style={{ width: `calc(var(--matrix-name-width) + ${80 + columns.length * 56 + totals.length * 84}px)` }}>
        <colgroup><col className={styles.matrixNameColumn} /><col style={{ width: 80 }} />{columns.map(({ item }) => <col key={item.id} style={{ width: 56 }} />)}{totals.map(({ key }) => <col key={key} style={{ width: 84 }} />)}</colgroup>
        <thead><tr><th scope="col">Ученик</th><th scope="col">Класс</th>{columns.map(({ item, index }) => <th key={item.id} scope="col" className={styles.matrixTaskCell}><button className={styles.matrixTaskButton} title={`${item.title} · Максимум: ${item.maxPoints}`} aria-label={`Условие задания ${index + 1}: ${item.title}`} onClick={() => onCondition(item.id)}>{index + 1}</button></th>)}{totals.map(({ key, label, title }, index) => <th scope="col" key={key} title={title} className={styles.matrixTotal} style={{ right: (totals.length - index - 1) * 84 }}>{label}</th>)}</tr></thead><tbody>{shown.map((student) => <tr key={student.id}>
        <th scope="row"><span title={student.name}>{student.displayName ?? student.name}</span></th><td><span className={styles.matrixClass} title={data.classes.find((group) => group.id === student.assignmentId)?.title}>{data.classes.find((group) => group.id === student.assignmentId)?.title}</span></td>
        {columns.map(({ item, index }) => <td key={item.id} className={styles.matrixTaskCell}><button className={styles.scoreButton} onClick={() => onAnswer(item.id, student.id)} aria-label={`${student.name}, задание ${index + 1}: ${student.scores[index].state === 'scored' ? `${student.scores[index].points} из ${item.maxPoints}` : statisticsStateLabels[student.scores[index].state]}`}><ScoreValue cell={student.scores[index]} max={item.maxPoints} compact /></button></td>)}
        {totals.map(({ key, max }, index) => <td key={key} className={styles.matrixTotal} style={{ right: (totals.length - index - 1) * 84 }}>{value(student[key], max)}</td>)}
      </tr>)}</tbody></table>
    </div> : <div className={styles.empty}><p>По этим фильтрам учеников нет.</p><button className={styles.textAction} onClick={() => { setSearch(''); filters.update({ task: '', score: '', result: '', page: '1' }); }}>Сбросить поиск и баллы</button></div>}
    <div className={styles.tableFooter}><p>«—» — нет окончательного результата. Нажмите на балл, чтобы посмотреть ответ.</p>
      <button className={styles.exportButton} disabled={rows.length === 0} title="Все ученики по выбранным фильтрам, включая другие страницы" onClick={() => downloadStatisticsCsv(data, rows, task?.id)}><Download size={16} aria-hidden="true" />Скачать CSV<span className={styles.exportCount}>· {rows.length}</span></button>
    </div>
    <div className={styles.pagination}><span>{rows.length ? `${(page - 1) * 20 + 1}–${Math.min(page * 20, rows.length)} из ${rows.length}` : '0 учеников'}</span><div><button disabled={page === 1} onClick={() => filters.update({ page: String(page - 1) })}>Назад</button><button disabled={page * 20 >= rows.length} onClick={() => filters.update({ page: String(page + 1) })}>Далее</button></div></div>
  </>;
}
