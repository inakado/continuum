"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { AssessmentStatistics } from '@continuum/shared';
import WorksShell from '@/features/teacher-works/WorksShell';
import WorkSelect from '@/features/teacher-works/WorkSelect';
import { apiErrorMessage } from '@/lib/api/error-message';
import ui from '@/features/teacher-works/teacher-works.module.css';
import { useStatistics } from './use-statistics';
import { useStatisticsFilters } from './use-statistics-filters';
import type { StatisticsGroup, StatisticsSelection } from './statistics-table';
import StatisticsTasks from './StatisticsTasks';
import StatisticsStudents from './StatisticsStudents';
import StatisticsClasses from './StatisticsClasses';
import StatisticsDetailsDrawer from './StatisticsDetailsDrawer';
import styles from './teacher-statistics.module.css';

const views = [{ id: 'tasks', label: 'По заданиям' }, { id: 'students', label: 'По ученикам' }, { id: 'classes', label: 'Сравнение классов' }] as const;
export function StatisticsReportView({ data }: { data: AssessmentStatistics }) {
  const context = useStatisticsFilters();
  const classId = data.classes.some((group) => group.id === context.classId) ? context.classId : '';
  const task = data.tasks.find((task) => task.id === context.taskId);
  const filters = { ...context, classId, taskId: task?.id ?? '', score: task && context.score <= task.maxPoints ? context.score : -1 };
  const scope = data.classResults.find((group) => group.assignmentId === classId) ?? data;
  const students = data.students.filter((student) => !classId || student.assignmentId === classId);
  const [detail, setDetail] = useState<StatisticsSelection | null>(null);
  const body = useRef<HTMLElement>(null), navigation = useRef<HTMLElement>(null);
  const previousView = useRef(filters.view);
  useEffect(() => {
    if (previousView.current !== filters.view) {
      body.current?.focus({ preventScroll: true });
      if (navigation.current && navigation.current.getBoundingClientRect().top < 0) navigation.current.scrollIntoView?.({ block: 'start' });
      previousView.current = filters.view;
    }
  }, [filters.view]);
  const openGroup = (group: StatisticsGroup) => setDetail({ kind: 'group', group });
  return <div className={styles.report}>
    <Link href={filters.listHref} className={styles.breadcrumb}>← Статистика работ</Link>
    <div className={styles.heading}><div><h1>{data.title}</h1><p>Версия {data.versionNumber} · Заданий: {data.tasks.length} · Учеников: {scope.summary.studentCount}<span> · Итог готов у {scope.summary.finalCount} из {scope.summary.studentCount}</span></p></div><Link href={`/teacher/works/assignments/${data.versionId}${classId ? `?class=${classId}` : ''}`} className={styles.textAction}>Выполнение работы →</Link></div>
    <div className={styles.controls}>
      <nav ref={navigation} aria-label="Представление статистики" className={styles.views}>{views.map((view) => <button key={view.id} aria-current={filters.view === view.id ? 'page' : undefined} onClick={() => {
        if (filters.view !== view.id) filters.update({ view: view.id, score: '', result: '', page: '1', ...(view.id === 'classes' && !task ? { task: data.tasks[0]?.id } : {}) });
      }}>{view.label}</button>)}</nav>
      <label className={styles.classFilter}>Класс<WorkSelect aria-label="Класс" value={classId} onChange={(event) => filters.update({ class: event.target.value, page: '1' })}><option value="">Все назначенные классы</option>{data.classes.map((group) => <option key={group.id} value={group.id}>{group.title} · {group.academicYear}–{group.academicYear + 1}</option>)}</WorkSelect></label>
    </div>
    <section ref={body} tabIndex={-1} aria-label={views.find((view) => view.id === filters.view)?.label}>
      {filters.view === 'tasks' && <StatisticsTasks data={data} distributions={scope.distributions} filters={filters} onCondition={(taskId) => setDetail({ kind: 'task', taskId })} onGroup={openGroup} />}
      {filters.view === 'students' && <StatisticsStudents data={data} students={students} summary={scope.summary} filters={filters} onCondition={(taskId) => setDetail({ kind: 'task', taskId })} onAnswer={(taskId, recipient) => setDetail({ kind: 'answer', taskId, recipient })} />}
      {filters.view === 'classes' && <StatisticsClasses data={data} filters={filters} onGroup={openGroup} />}
    </section>
    {detail && <StatisticsDetailsDrawer data={data} selection={detail} filters={filters} onSelect={setDetail} close={() => setDetail(null)} />}
  </div>;
}
export default function StatisticsReportScreen({ id }: { id: string }) {
  const query = useStatistics(id);
  return <WorksShell active="statistics" mainClassName={styles.reportMain}>
    {query.isPending && <p role="status">Загружаем статистику…</p>}
    {query.error && <div role="alert"><p>{apiErrorMessage(query.error)}</p><button className={ui.secondary} onClick={() => void query.refetch()}>Повторить</button></div>}
    {query.data && !query.error && <StatisticsReportView data={query.data} />}
  </WorksShell>;
}
