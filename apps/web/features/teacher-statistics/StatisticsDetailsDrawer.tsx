"use client";
import { useEffect, useRef, useState } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import type { AssessmentStatistics } from '@continuum/shared';
import Dialog from '@/components/ui/Dialog';
import { pointsLabel, taskSourceLabel, taskTypeLabels } from '@/features/teacher-bank/task-source';
import { statisticsGroupStudents, type StatisticsGroup, type StatisticsSelection } from './statistics-table';
import type { StatisticsFilters } from './use-statistics-filters';
import StatisticsAnswerContent from './StatisticsAnswerContent';
import StatisticsScoreTable from './StatisticsScoreTable';
import { ScoreValue } from './ScoreValue';
import styles from './teacher-statistics.module.css';

type Props = { data: AssessmentStatistics; selection: StatisticsSelection; filters: StatisticsFilters; onSelect: (selection: StatisticsSelection) => void; close: () => void };
function GroupContent({ data, group, filters, onSelect, close }: Omit<Props, 'selection'> & { group: StatisticsGroup }) {
  const [limit, setLimit] = useState(50);
  const index = data.tasks.findIndex((task) => task.id === group.taskId);
  const task = data.tasks[index];
  const students = statisticsGroupStudents(data.students, index, group);
  const population = data.students.filter((student) => !group.assignmentId || student.assignmentId === group.assignmentId);
  const scoredCount = population.filter((student) => student.scores[index]?.state === 'scored').length;
  const title = group.bucket === 'scored' ? 'Ученики с результатом' : group.bucket === 'pending' ? 'Без результата' : `${group.bucket} из ${task.maxPoints} баллов`;
  function openStudents() {
    filters.update({ view: 'students', class: group.assignmentId, task: group.taskId, score: typeof group.bucket === 'number' ? String(group.bucket) : '', result: typeof group.bucket === 'string' ? group.bucket : '', page: '1' });
    close();
  }
  return <>
    <h3 className={styles.drawerSectionTitle}>{title}</h3>
    <p className={styles.drawerNote}>Учеников: {students.length}{group.bucket !== 'pending' && scoredCount > 0 ? ` · ${(100 * students.length / scoredCount).toLocaleString('ru', { maximumFractionDigits: 1 })}% от полученных результатов` : ''}</p>
    {students.length ? <ul className={styles.groupStudents}>{students.slice(0, limit).map((student) => <li key={student.id}>
      <button onClick={() => onSelect({ kind: 'answer', taskId: task.id, recipient: student.id, back: group })}>
        <span>{student.name}<small>{data.classes.find((row) => row.id === student.assignmentId)?.title}</small></span><ScoreValue cell={student.scores[index]} max={task.maxPoints} />
      </button>
    </li>)}</ul> : <p>В этой группе пока нет учеников.</p>}
    {students.length > limit && <button className={styles.textAction} onClick={() => setLimit((value) => value + 50)}>Показать ещё 50</button>}
    <button className={styles.drawerPrimary} onClick={openStudents}>Открыть в таблице учеников</button>
  </>;
}
export default function StatisticsDetailsDrawer({ data, selection, filters, onSelect, close }: Props) {
  const restoreFocus = useRef(typeof document === 'undefined' ? null : document.activeElement);
  const heading = useRef<HTMLSpanElement>(null);
  const taskId = selection.kind === 'group' ? selection.group.taskId : selection.taskId;
  const index = data.tasks.findIndex((task) => task.id === taskId);
  const task = data.tasks[index];
  const student = selection.kind === 'answer' ? data.students.find((row) => row.id === selection.recipient) : undefined;
  const key = selection.kind === 'group' ? `${taskId}:${selection.group.assignmentId}:${selection.group.bucket}` : selection.kind === 'answer' ? `${taskId}:${selection.recipient}` : taskId;
  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [key]);
  if (!task) return null;
  return <Dialog open onOpenChange={(open) => { if (!open) close(); }} title={<span ref={heading} tabIndex={-1}>{student?.name ?? task.title}</span>} description={`Задание ${index + 1} · ${pointsLabel(task.maxPoints)}`} className={styles.drawer} overlayClassName={styles.answerOverlay}
    onCloseAutoFocus={(event) => { event.preventDefault(); if (restoreFocus.current instanceof HTMLElement && restoreFocus.current.isConnected) restoreFocus.current.focus(); }}>
    <button className={styles.drawerClose} aria-label="Закрыть подробности" onClick={close}><X size={20} aria-hidden="true" /></button>
    <div className={styles.drawerBody}>
      {selection.kind === 'answer' && selection.back && <button className={styles.textAction} onClick={() => onSelect({ kind: 'group', group: selection.back! })}><ArrowLeft size={16} />К списку учеников</button>}
      <p className={styles.drawerNote}>{taskTypeLabels[task.type]} · {taskSourceLabel(task.source)}</p>
      {selection.kind === 'group' ? <GroupContent key={key} data={data} group={selection.group} filters={filters} onSelect={onSelect} close={close} /> : <StatisticsAnswerContent key={key} id={data.versionId} taskId={taskId} recipient={selection.kind === 'answer' ? selection.recipient : undefined} />}
      {selection.kind === 'task' && data.classes.length > 1 && <section className={styles.drawerComparison}><h3 className={styles.drawerSectionTitle}>Распределение по классам</h3>
        <StatisticsScoreTable rows={data.classResults.map((row, n) => ({ id: row.assignmentId, title: data.classes.find((group) => group.id === row.assignmentId)?.title ?? '', order: n, max: task.maxPoints, distribution: row.distributions[index] }))} max={task.maxPoints} unit={filters.unit} label="Класс" showNumbers={false} compact onGroup={(assignmentId, bucket) => onSelect({ kind: 'group', group: { taskId, assignmentId, bucket } })} />
      </section>}
    </div>
  </Dialog>;
}
