"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize2, Minimize2, Upload } from 'lucide-react';
import type { AssessmentBankQuery, GradeBand } from '@continuum/shared';
import ContinuumHeader from '@/components/ContinuumHeader';
import { useTeacherBank, useTeacherBankTask } from './use-teacher-bank';
import { teacherBankApi } from './teacher-bank.api';
import BankTaskPreview from './BankTaskPreview';
import BankImportPanel from './BankImportPanel';
import BankFilters from './BankFilters';
import BankTaskActions from './BankTaskActions';
import BankDeletionNotice, { type BankDeletion } from './BankDeletionNotice';
import { bankFilterParams, readBankFilters, useBankContextCorrection, useBankFilters } from './use-bank-filters';
import { pointsLabel, taskSourceLabel, taskTypeLabels } from './task-source';
import styles from './teacher-bank.module.css';

const grades: { code: GradeBand; label: string }[] = [{ code: 'grade_7', label: '7 класс' }, { code: 'grade_8', label: '8 класс' }, { code: 'grade_9', label: '9 класс' }, { code: 'grade_10_11', label: '10–11 классы' }];
export default function TeacherBankScreen() {
  const filters = useBankFilters();
  const { gradeBand, search, topic, type, exam, source, page, taskId } = filters;
  const [expanded, setExpanded] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [deletions, setDeletions] = useState<BankDeletion[]>([]);
  const query = { gradeBand, search, topic, type, exam, source, page };
  const filtered = Boolean(search || topic || type || exam || source);
  const bank = useTeacherBank(query);
  const tasks = bank.data?.tasks ?? [];
  useBankContextCorrection(filters, bank.data, bank.isFetching);
  const selected = tasks.find((task) => task.id === taskId) ?? tasks[0];
  const view = useTeacherBankTask(selected?.id ?? null);
  const index = tasks.findIndex((task) => task.id === selected?.id);
  function changeFilters(patch: Partial<AssessmentBankQuery>, replace = false) { filters.update({ ...patch, page: 1, taskId: null }, replace); }
  function dismissDeletion(deletion: BankDeletion) { setDeletions((items) => items.filter((item) => item !== deletion)); }
  async function exportBank() {
    setExporting(true); setError('');
    try { await teacherBankApi.export(query); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось экспортировать задания.'); }
    finally { setExporting(false); }
  }
  return <div className={styles.page}><ContinuumHeader homeHref="/teacher" />
    <nav aria-label="Разделы учителя" className={styles.teacherNav}><Link href="/teacher/materials">Материалы</Link><Link href="/teacher/students">Ученики и доступы</Link><Link href="/teacher/bank" aria-current="page">Банк заданий</Link><Link href="/teacher/works">Работы</Link><Link href="/teacher/statistics">Статистика</Link></nav>
    <main className={styles.main}>{importing ? <BankImportPanel onClose={(grade) => { setImporting(false); changeFilters({ gradeBand: grade ?? gradeBand, search: '', topic: '', type: undefined, exam: undefined, source: undefined }); }} /> : <>
      <div className={styles.heading}><div><h1>Банк заданий</h1><p>Задания для проверочных работ</p></div><div className={styles.actions}><button className={styles.primary} onClick={() => setImporting(true)}><Upload size={18} aria-hidden="true" />Загрузить пакет</button><button className={styles.textButton} title="Экспортировать задания по текущим фильтрам" disabled={exporting || !bank.data?.total} onClick={() => void exportBank()}>{exporting ? 'Экспортируем…' : 'Экспорт'}</button></div></div>
      <nav aria-label="Параллели" className={styles.grades}>{grades.map((grade) => <button key={grade.code} aria-current={gradeBand === grade.code ? 'page' : undefined} onClick={() => changeFilters({ gradeBand: grade.code, topic: '', source: undefined })}>{grade.label}</button>)}</nav>
      <BankFilters query={query} topics={bank.data?.topics ?? []} sources={bank.data?.sources ?? []} onChange={changeFilters} />
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {deletions.map((deletion) => <BankDeletionNotice key={`${deletion.id}:${deletion.deletionRevision}`} deletion={deletion} onDismiss={() => dismissDeletion(deletion)} onRestored={() => { filters.update({ ...readBankFilters(new URLSearchParams(deletion.query)), taskId: deletion.id }); dismissDeletion(deletion); }} />)}
      {bank.isPending ? <div className={styles.skeleton} role="status" aria-label="Загружаем банк заданий"><div /><div /><div /><div /></div> : bank.error ? <div className={styles.empty} role="alert"><h2>Не удалось загрузить задания</h2><p>{bank.error.message}</p><button className={styles.secondary} onClick={() => void bank.refetch()}>Повторить</button></div> : !tasks.length ? <div className={styles.empty}><h2>{filtered ? 'Ничего не найдено' : 'В этой параллели пока нет заданий'}</h2><p>{filtered ? 'Измените запрос или сбросьте фильтры.' : 'Загрузите подготовленный ZIP с условиями, ответами и рисунками.'}</p>{filtered ? <button className={styles.secondary} onClick={() => changeFilters({ search: '', topic: '', type: undefined, exam: undefined, source: undefined })}>Сбросить фильтры</button> : <button className={styles.primary} onClick={() => setImporting(true)}>Загрузить пакет</button>}</div> : <div className={`${styles.workspace} ${taskId ? styles.showPreview : ''} ${expanded ? styles.expanded : ''}`}>
        <section className={styles.listColumn}><div className={styles.sectionHeading}><h2>Задания</h2><span>Всего: {bank.data?.total}</span></div>
          <ul className={styles.taskList} aria-label="Задания банка">{tasks.map((task, row) => <li key={task.id}><button className={styles.taskRow} aria-pressed={selected?.id === task.id} onClick={() => filters.update({ taskId: task.id })}><span className={styles.number}>{(page - 1) * (bank.data?.pageSize ?? 50) + row + 1}</span><div className={styles.identity}><strong>{task.title}</strong><span className={styles.source}>{taskSourceLabel(task.source)}</span><span className={styles.excerpt}>{task.excerpt}</span></div><div className={styles.taskType}><span>{taskTypeLabels[task.type]}</span><span>{task.topicPath.at(-1)}</span></div><span className={styles.points}>{pointsLabel(task.maxPoints)}</span></button></li>)}</ul>
          {bank.data && bank.data.total > bank.data.pageSize && <div className={styles.pagination}><button className={styles.textButton} disabled={page === 1} onClick={() => filters.update({ page: page - 1, taskId: null })}>Назад</button><span>Страница {page} из {Math.ceil(bank.data.total / bank.data.pageSize)}</span><button className={styles.textButton} disabled={page * bank.data.pageSize >= bank.data.total} onClick={() => filters.update({ page: page + 1, taskId: null })}>Далее</button></div>}
        </section>
        <section className={styles.previewColumn} aria-label="Просмотр задания">
          <div className={styles.previewToolbar}><button className={`${styles.textButton} ${styles.mobileBack}`} onClick={() => filters.update({ taskId: null })}><ArrowLeft size={17} />К списку</button><button className={`${styles.textButton} ${styles.expandButton}`} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}{expanded ? 'Вернуть список' : 'Развернуть задание'}</button><BankTaskActions task={view.data} query={bankFilterParams(filters)} onDeleted={(deletion) => { setDeletions((items) => [...items, deletion]); filters.update({ page: Math.max(1, page - Number(tasks.length === 1)), taskId: null }, true); }} /></div>
          {view.isPending ? <p className={styles.muted}>Загружаем условие…</p> : view.error ? <div role="alert"><p>{view.error.message}</p><button type="button" className={styles.textButton} onClick={() => void view.refetch()}>Повторить загрузку условия</button></div> : view.data && <BankTaskPreview data={view.data} />}
          <div className={styles.previewFooter}><span>Версия {view.data?.version ?? selected.version}</span><div><button className={styles.textButton} disabled={index <= 0} onClick={() => filters.update({ taskId: tasks[index - 1].id })}><ChevronLeft size={19} />Предыдущая</button><button className={styles.textButton} disabled={index >= tasks.length - 1} onClick={() => filters.update({ taskId: tasks[index + 1].id })}>Следующая<ChevronRight size={19} /></button></div></div>
        </section>
      </div>}
    </>}</main>
  </div>;
}
