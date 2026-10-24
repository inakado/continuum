"use client";
import Link from 'next/link';
import WorksShell from '@/features/teacher-works/WorksShell';
import WorkSelect from '@/features/teacher-works/WorkSelect';
import SearchField from '@/components/ui/SearchField';
import { useAssignments } from '@/features/teacher-assignments/use-assignments';
import { apiErrorMessage } from '@/lib/api/error-message';
import { statisticsReportHref, useStatisticsListFilters } from './use-statistics-list-filters';
import ui from '@/features/teacher-works/teacher-works.module.css';
import styles from './teacher-statistics.module.css';

export default function StatisticsListScreen() {
  const query = useAssignments();
  const filters = useStatisticsListFilters();
  const { search, update } = filters;
  const classes = [...new Map(query.data?.flatMap((work) => work.classes.map((group) => [group.classId ?? group.id, group] as const))).values()];
  const classId = classes.some((group) => (group.classId ?? group.id) === filters.classId) ? filters.classId : '';
  const rows = query.data?.filter((work) => work.title.toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru')) && (!classId || work.classes.some((group) => (group.classId ?? group.id) === classId))) ?? [];
  return <WorksShell active="statistics"><div className={ui.heading}><div><h1>Статистика</h1><p>Результаты работ по заданиям, ученикам и классам</p></div></div>
    <div className={styles.filters}><label>Поиск<SearchField label="Поиск работы" value={search} onValueChange={(value) => update({ search: value, classId }, true)} placeholder="Название работы" maxLength={200} /></label><label>Класс<WorkSelect aria-label="Класс" value={classId} onChange={(event) => update({ classId: event.target.value })}><option value="">Все классы</option>{classes.map((group) => <option key={group.classId ?? group.id} value={group.classId ?? group.id}>{group.title} · {group.academicYear}–{group.academicYear + 1}</option>)}</WorkSelect></label></div>
    {query.isPending && <p role="status">Загружаем работы…</p>}
    {query.error && <div role="alert"><p>{apiErrorMessage(query.error)}</p><button className={ui.secondary} onClick={() => void query.refetch()}>Повторить</button></div>}
    {query.data && !query.error && (rows.length ? <ul className={styles.workList}>{rows.map((work) => <li key={work.versionId}><Link href={statisticsReportHref(work, { search, classId })}><div><strong>{work.title}</strong><p>Версия {work.versionNumber} · {work.classes.map((group) => group.title).join(', ')}</p></div><div className={styles.workProgress}>{work.automaticTaskCount > 0 && <span>Тест завершили: {work.completedCount} из {work.studentCount}</span>}{work.extendedTaskCount > 0 && <span>Все проверки опубликованы: у {work.allReviewsPublishedCount} из {work.studentCount}</span>}<span className={styles.link}>Открыть статистику →</span></div></Link></li>)}</ul> : <div className={styles.empty}><h2>{search || classId ? 'Работы не найдены' : 'Пока нет назначенных работ'}</h2>{search || classId ? <button className={ui.textButton} onClick={() => update({ search: '', classId: '' })}>Сбросить фильтры</button> : <Link href="/teacher/works" className={ui.textButton}>Перейти к работам</Link>}</div>)}
  </WorksShell>;
}
