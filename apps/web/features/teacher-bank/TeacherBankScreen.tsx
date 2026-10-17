"use client";

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, ChevronLeft, ChevronRight, Maximize2, Minimize2, Search, Upload } from 'lucide-react';
import type { AssessmentBankQuery, GradeBand } from '@continuum/shared';
import ContinuumHeader from '@/components/ContinuumHeader';
import { useTeacherBank, useTeacherBankTask } from './use-teacher-bank';
import { teacherBankApi } from './teacher-bank.api';
import BankTaskPreview from './BankTaskPreview';
import BankImportPanel from './BankImportPanel';
import { pointsLabel, taskSourceLabel, taskTypeLabels } from './task-source';
import styles from './teacher-bank.module.css';

const grades: { code: GradeBand; label: string }[] = [{ code: 'grade_7', label: '7 класс' }, { code: 'grade_8', label: '8 класс' }, { code: 'grade_9', label: '9 класс' }, { code: 'grade_10_11', label: '10–11 классы' }];
export default function TeacherBankScreen() {
  const [gradeBand, setGrade] = useState<GradeBand>('grade_10_11');
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('');
  const [type, setType] = useState<AssessmentBankQuery['type']>();
  const [page, setPage] = useState(1);
  const [selectedId, setSelected] = useState<string | null>(null);
  const [mobilePreview, setMobilePreview] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const query = { gradeBand, search, topic, type, page };
  const bank = useTeacherBank(query);
  const tasks = bank.data?.tasks ?? [];
  const selected = tasks.find((task) => task.id === selectedId) ?? tasks[0];
  const view = useTeacherBankTask(selected?.id ?? null);
  const index = tasks.findIndex((task) => task.id === selected?.id);
  function resetSelection() { setPage(1); setSelected(null); setMobilePreview(false); }
  async function exportBank() {
    setExporting(true); setError('');
    try { await teacherBankApi.export(query); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось экспортировать задания.'); }
    finally { setExporting(false); }
  }
  return <div className={styles.page}><ContinuumHeader homeHref="/teacher" />
    <nav aria-label="Разделы учителя" className={styles.teacherNav}><Link href="/teacher/materials">Материалы</Link><Link href="/teacher/students">Ученики и доступы</Link><Link href="/teacher/bank" aria-current="page">Банк заданий</Link><Link href="/teacher/works">Работы</Link></nav>
    <main className={styles.main}>{importing ? <BankImportPanel onClose={(grade) => { setImporting(false); if (grade) setGrade(grade); setSearch(''); setTopic(''); setType(undefined); resetSelection(); }} /> : <>
      <div className={styles.heading}><div><h1>Банк заданий</h1><p>Задания для проверочных работ</p></div><div className={styles.actions}><button className={styles.primary} onClick={() => setImporting(true)}><Upload size={18} aria-hidden="true" />Загрузить пакет</button><button className={styles.textButton} title="Экспортировать задания по текущим фильтрам" disabled={exporting || !bank.data?.total} onClick={() => void exportBank()}>{exporting ? 'Экспортируем…' : 'Экспорт'}</button></div></div>
      <nav aria-label="Параллели" className={styles.grades}>{grades.map((grade) => <button key={grade.code} aria-current={gradeBand === grade.code ? 'page' : undefined} onClick={() => { setGrade(grade.code); setTopic(''); resetSelection(); }}>{grade.label}</button>)}</nav>
      <div className={styles.filters}><label className={styles.search}><Search size={19} aria-hidden="true" /><input type="search" aria-label="Поиск по условию или названию" placeholder="Поиск по условию или названию" maxLength={200} value={search} onChange={(event) => { setSearch(event.target.value); resetSelection(); }} /></label>
        <label className={styles.select}><span className={styles.srOnly}>Тема</span><select value={topic} onChange={(event) => { setTopic(event.target.value); resetSelection(); }}><option value="">Все темы</option>{bank.data?.topics.map((value) => <option key={value} value={value}>{value}</option>)}</select><ChevronDown size={17} aria-hidden="true" /></label>
        <label className={styles.select}><span className={styles.srOnly}>Тип задания</span><select value={type ?? ''} onChange={(event) => { setType(event.target.value as AssessmentBankQuery['type'] || undefined); resetSelection(); }}><option value="">Все типы</option>{Object.entries(taskTypeLabels).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select><ChevronDown size={17} aria-hidden="true" /></label>
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
      {bank.isPending ? <div className={styles.skeleton} role="status" aria-label="Загружаем банк заданий"><div /><div /><div /><div /></div> : bank.error ? <div className={styles.empty} role="alert"><h2>Не удалось загрузить задания</h2><p>{bank.error.message}</p><button className={styles.secondary} onClick={() => void bank.refetch()}>Повторить</button></div> : !tasks.length ? <div className={styles.empty}><h2>{search || topic || type ? 'Ничего не найдено' : 'В этой параллели пока нет заданий'}</h2><p>{search || topic || type ? 'Измените запрос или сбросьте фильтры.' : 'Загрузите подготовленный ZIP с условиями, ответами и рисунками.'}</p>{search || topic || type ? <button className={styles.secondary} onClick={() => { setSearch(''); setTopic(''); setType(undefined); resetSelection(); }}>Сбросить фильтры</button> : <button className={styles.primary} onClick={() => setImporting(true)}>Загрузить пакет</button>}</div> : <div className={`${styles.workspace} ${mobilePreview ? styles.showPreview : ''} ${expanded ? styles.expanded : ''}`}>
        <section className={styles.listColumn}><div className={styles.sectionHeading}><h2>Задания</h2><span>Всего: {bank.data?.total}</span></div>
          <ul className={styles.taskList} aria-label="Задания банка">{tasks.map((task, row) => <li key={task.id}><button className={styles.taskRow} aria-pressed={selected?.id === task.id} onClick={() => { setSelected(task.id); setMobilePreview(true); }}><span className={styles.number}>{(page - 1) * (bank.data?.pageSize ?? 50) + row + 1}</span><div className={styles.identity}><strong>{task.title}</strong><span className={styles.source}>{taskSourceLabel(task.source)}</span><span className={styles.excerpt}>{task.excerpt}</span></div><div className={styles.taskType}><span>{taskTypeLabels[task.type]}</span><span>{task.topicPath.at(-1)}</span></div><span className={styles.points}>{pointsLabel(task.maxPoints)}</span></button></li>)}</ul>
          {bank.data && bank.data.total > bank.data.pageSize && <div className={styles.pagination}><button className={styles.textButton} disabled={page === 1} onClick={() => { setPage(page - 1); setSelected(null); }}>Назад</button><span>Страница {page} из {Math.ceil(bank.data.total / bank.data.pageSize)}</span><button className={styles.textButton} disabled={page * bank.data.pageSize >= bank.data.total} onClick={() => { setPage(page + 1); setSelected(null); }}>Далее</button></div>}
        </section>
        <section className={styles.previewColumn} aria-label="Просмотр задания"><button className={`${styles.textButton} ${styles.mobileBack}`} onClick={() => setMobilePreview(false)}><ArrowLeft size={17} />К списку</button>
          <div className={styles.previewToolbar}><button className={styles.textButton} aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? <Minimize2 size={16} aria-hidden="true" /> : <Maximize2 size={16} aria-hidden="true" />}{expanded ? 'Вернуть список' : 'Развернуть задание'}</button></div>
          {view.isPending ? <p className={styles.muted}>Загружаем условие…</p> : view.error ? <p role="alert">{view.error.message}</p> : view.data && <BankTaskPreview data={view.data} />}
          <div className={styles.previewFooter}><span>Версия {view.data?.version ?? selected.version}</span><div><button className={styles.textButton} disabled={index <= 0} onClick={() => setSelected(tasks[index - 1].id)}><ChevronLeft size={19} />Предыдущая</button><button className={styles.textButton} disabled={index >= tasks.length - 1} onClick={() => setSelected(tasks[index + 1].id)}>Следующая<ChevronRight size={19} /></button></div></div>
        </section>
      </div>}
    </>}</main>
  </div>;
}
