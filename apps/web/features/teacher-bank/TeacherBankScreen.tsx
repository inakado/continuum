"use client";

import { useState, type RefObject } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Maximize2, Minimize2, Upload } from 'lucide-react';
import type { AssessmentBankQuery, AssessmentTaskView, GradeBand } from '@continuum/shared';
import TeacherChrome from '@/features/teacher-shell/TeacherChrome';
import { SelectionCheckbox } from '@/features/teacher-bulk-actions/BulkActionBar';
import { useBulkDelete } from '@/features/teacher-bulk-actions/use-bulk-delete';
import { teacherBankQueryKeys } from '@/lib/query/keys';
import BankTaskPreview from './BankTaskPreview';
import BankTaskDetails from './BankTaskDetails';
import { useTeacherBank, useTeacherBankTask } from './use-teacher-bank';
import { teacherBankApi } from './teacher-bank.api';
import { bankFilterParams, readBankFilters, useBankContextCorrection, useBankFilters } from './use-bank-filters';
import { pointsLabel, taskSourceLabel, taskTypeLabels } from './task-source';
import { uploadDateLabel } from './upload-date';
import BankWorkspaceFilters, { clearedFilters } from './BankWorkspaceFilters';
import BankTaskActions from './BankTaskActions';
import BankTaskCorrection from './BankTaskCorrection';
import BankImportPanel from './BankImportPanel';
import BankDeletionNotice, { type BankDeletion } from './BankDeletionNotice';
import styles from './bank-workspace.module.css';

const grades: { id: GradeBand; label: string; full: string }[] = [
  { id: 'grade_7', label: '7', full: '7 класс' }, { id: 'grade_8', label: '8', full: '8 класс' },
  { id: 'grade_9', label: '9', full: '9 класс' }, { id: 'grade_10_11', label: '10–11', full: '10–11 классы' },
];

export default function TeacherBankScreen() {
  const filters = useBankFilters();
  const { gradeBand, search, topic, topicPath, type, exam, source, uploadedFrom, uploadedBefore, page, taskId } = filters;
  const query = { gradeBand, search, topic, topicPath, type, exam, source, uploadedFrom, uploadedBefore, page };
  const bank = useTeacherBank(query);
  useBankContextCorrection(filters, bank.data, bank.isFetching);
  const tasks = bank.data?.tasks ?? [];
  const current = tasks.find(task => task.id === taskId) ?? tasks[0];
  const view = useTeacherBankTask(current?.id ?? null);
  const index = tasks.findIndex(task => task.id === current?.id);
  const [expanded, setExpanded] = useState(false);
  const [importing, setImporting] = useState(false);
  const [correction, setCorrection] = useState<{ task: AssessmentTaskView; trigger: RefObject<HTMLButtonElement | null> } | null>(null);
  const [deletions, setDeletions] = useState<BankDeletion[]>([]);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const bulk = useBulkDelete({ scope: JSON.stringify(query), items: tasks, queryKey: teacherBankQueryKeys.all(), label: task => task.title,
    title: 'Удалить выбранные задания?', description: 'Задания исчезнут из банка и подбора. В собранных работах останутся. После удаления можно отменить всю операцию.',
    remove: items => teacherBankApi.removeMany({ items: items.map(task => ({ id: task.id, expectedVersion: task.version, expectedLifecycleRevision: task.lifecycleRevision ?? 1 })) }),
    restore: receipt => teacherBankApi.restoreMany({ items: receipt.items.map(item => ({ id: item.id, expectedVersion: item.version, expectedDeletionRevision: item.deletionRevision })) }),
  });
  const focused = expanded && Boolean(current) && !importing;
  function dismissDeletion(deletion: BankDeletion) { setDeletions(items => items.filter(item => item !== deletion)); }
  const changed = Boolean(search || topic || topicPath?.length || type || exam || source || uploadedFrom || uploadedBefore);
  function change(patch: Partial<AssessmentBankQuery>, replace = false) { filters.update({ ...patch, page: 1, taskId: null }, replace); }
  async function exportTasks() {
    setExporting(true); setError('');
    try { await teacherBankApi.export(query); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось скачать пакет.'); }
    finally { setExporting(false); }
  }
  const controls = <>
    <div className={styles.collectionHeading}><h1>Банк заданий</h1></div>
    <div className={styles.collectionActions}><button className={styles.uploadButton} onClick={() => { setExpanded(false); setImporting(true); }}><Upload size={15} aria-hidden="true" />Загрузить пакет</button><button title="Экспортировать задания по текущим фильтрам" disabled={exporting || !bank.data?.total} onClick={() => void exportTasks()}>{exporting ? 'Экспортируем…' : 'Экспорт'}</button></div>
    <nav className={styles.grades} aria-label="Параллели">{grades.map(grade => <button key={grade.id} aria-label={grade.full} aria-current={gradeBand === grade.id ? 'page' : undefined} onClick={() => change({ gradeBand: grade.id, topic: '', topicPath: undefined, source: undefined })}>{grade.label}<span> класс{grade.id === 'grade_10_11' ? 'ы' : ''}</span></button>)}</nav>
    <BankWorkspaceFilters query={query} paths={bank.data?.topicPaths ?? []} sources={bank.data?.sources ?? []} onChange={change} />
  </>;
  return <div className={`${styles.page} ${importing ? styles.importing : ''} ${taskId && !importing ? styles.viewing : ''} ${focused ? styles.expanded : ''}`}>
    <TeacherChrome active="bank" />
    <main className={importing ? styles.importPage : styles.workspace}>{importing ? <BankImportPanel onClose={grade => { setImporting(false); change({ ...clearedFilters, gradeBand: grade ?? gradeBand }); }} /> : <>
      <aside className={styles.sidebar} aria-label="Банк и фильтры" aria-hidden={focused || undefined} inert={focused}>
        {controls}
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.notices}>{bulk.notices}{deletions.map(deletion => <BankDeletionNotice key={`${deletion.id}:${deletion.deletionRevision}`} deletion={deletion} onDismiss={() => dismissDeletion(deletion)} onRestored={() => { filters.update({ ...readBankFilters(new URLSearchParams(deletion.query)), taskId: deletion.id }); dismissDeletion(deletion); }} />)}</div>
        <div className={styles.listHeading}>{bulk.bar}<span className={styles.total}>Всего: {bank.data?.total ?? '…'}</span></div>
        {bank.isPending ? <p role="status" className={styles.message}>Загружаем задачи…</p> : bank.error ? <div role="alert" className={styles.message}><p>{bank.error.message}</p><button onClick={() => void bank.refetch()}>Повторить</button></div> : !tasks.length ? <div className={styles.message}><h2>{changed ? 'Ничего не найдено' : 'Задач пока нет'}</h2>{changed && <button onClick={() => change(clearedFilters)}>Сбросить фильтры</button>}</div> : <ul className={styles.taskList} aria-label="Задания банка" tabIndex={0}>{tasks.map(task => <li key={task.id}>
          <SelectionCheckbox label={`Выбрать задание: ${task.title}`} checked={bulk.ids.has(task.id)} disabled={!bulk.canSelect(task.id)} onChange={() => bulk.toggle(task.id)} />
          <button className={styles.taskRow} aria-pressed={taskId === task.id} data-current={task.id === current?.id} onClick={() => filters.update({ taskId: task.id })}><span className={styles.rowTitle}><strong title={task.title}>{task.title}</strong><span>{pointsLabel(task.maxPoints)}</span></span><span className={styles.rowMeta}><span title={taskSourceLabel(task.source)}>{taskSourceLabel(task.source)}</span>{task.createdAt && <time dateTime={task.createdAt} title="Дата загрузки" aria-label={`Загружено ${uploadDateLabel(task.createdAt)}`}>{uploadDateLabel(task.createdAt)}</time>}</span><span className={styles.rowClassification}><span>{taskTypeLabels[task.type]}</span><span>{task.topicPath.at(-1)}</span></span></button>
        </li>)}</ul>}
        {bank.data && bank.data.total > bank.data.pageSize && <div className={styles.pagination}><button disabled={page === 1} onClick={() => filters.update({ page: page - 1, taskId: null })}>Назад</button><span>{page} / {Math.ceil(bank.data.total / bank.data.pageSize)}</span><button disabled={page * bank.data.pageSize >= bank.data.total} onClick={() => filters.update({ page: page + 1, taskId: null })}>Далее</button></div>}
      </aside>
      <section className={styles.reader} aria-label="Просмотр задания">
        {current ? <>
          <header className={styles.readerHeader}>
            <button className={`${styles.iconButton} ${styles.mobileBack}`} aria-label="К списку" title="К списку" onClick={() => { setExpanded(false); filters.update({ taskId: null }); }}><ArrowLeft size={18} /></button>
            <div className={styles.readerIdentity}><h2>{view.data?.task.title ?? current.title}</h2><p title={current.topicPath.join(' → ')}>{taskSourceLabel(current.source)}<span> · </span>{current.topicPath.at(-1)}</p></div>
            <div className={styles.readerActions}><span className={styles.position}>{(page - 1) * (bank.data?.pageSize ?? 50) + index + 1} / {bank.data?.total}</span><button className={styles.iconButton} aria-label="Предыдущая задача" title="Предыдущая задача" disabled={index <= 0} onClick={() => filters.update({ taskId: tasks[index - 1].id })}><ChevronLeft size={19} /></button><button className={styles.iconButton} aria-label="Следующая задача" title="Следующая задача" disabled={index >= tasks.length - 1} onClick={() => filters.update({ taskId: tasks[index + 1].id })}><ChevronRight size={19} /></button><button className={styles.iconButton} aria-label={focused ? 'Свернуть задание' : 'Развернуть задание'} title={focused ? 'Свернуть задание' : 'Развернуть задание'} aria-expanded={focused} onClick={() => setExpanded(!focused)}>{focused ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>{!focused && <BankTaskActions task={view.data} query={bankFilterParams(filters)} onCorrect={(task, trigger) => setCorrection({ task, trigger })} onDeleted={deletion => { setDeletions(items => [...items, deletion]); filters.update({ page: Math.max(1, page - Number(tasks.length === 1)), taskId: null }, true); }} />}</div>
          </header>
          <div className={styles.readerBody} key={current.id} role="region" aria-label="Условие выбранного задания" aria-busy={view.isPending} tabIndex={0}>{view.isPending ? <p role="status">Загружаем условие…</p> : view.error ? <div role="alert"><p>{view.error.message}</p><button onClick={() => void view.refetch()}>Повторить загрузку условия</button></div> : view.data && <BankTaskPreview data={view.data} compact renderDetails={sections => <BankTaskDetails {...sections} hasSolution={Boolean(view.data?.solution)} />} />}</div>
        </> : <div className={styles.readerEmpty}><h2>Выберите задачу слева</h2><p>Здесь появятся условие, рисунки и ответ.</p></div>}
      </section>
    </>}</main>{bulk.dialog}{correction && <BankTaskCorrection task={correction.task} trigger={correction.trigger} onClose={() => setCorrection(null)} />}
  </div>;
}
