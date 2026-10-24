"use client";
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { ASSESSMENT_WORK_TASK_LIMIT, type AssessmentTaskSummary, type AssessmentTaskView, type AssessmentBankQuery, type GradeBand } from '@continuum/shared';
import { useTeacherBank, useTeacherBankTask } from '@/features/teacher-bank/use-teacher-bank';
import { teacherBankApi } from '@/features/teacher-bank/teacher-bank.api';
import BankTaskPreview from '@/features/teacher-bank/BankTaskPreview';
import { pointsLabel, taskSourceLabel } from '@/features/teacher-bank/task-source';
import WorkBankFilters from './WorkBankFilters';
import { taskCountLabel } from './work-labels';
import { apiErrorMessage } from '@/lib/api/error-message';
import styles from './teacher-works.module.css';

export default function WorkBankPicker({ existing, grade, onClose, onAdd }: { existing: AssessmentTaskView[]; grade: GradeBand; onClose: () => void; onAdd: (items: AssessmentTaskView[]) => void }) {
  const [query, setQuery] = useState<AssessmentBankQuery>({ gradeBand: grade, search: '', topic: '', page: 1 });
  const { page } = query;
  const [mode, setMode] = useState<'bank' | 'selected'>('bank');
  const heading = useRef<HTMLHeadingElement>(null);
  const [selected, setSelected] = useState<Map<string, AssessmentTaskSummary>>(() => new Map());
  const [viewId, setView] = useState<string | null>(null); const [mobileView, setMobileView] = useState(false);
  const [adding, setAdding] = useState(false); const [error, setError] = useState('');
  const bank = useTeacherBank(query);
  const data = bank.data ?? { total: 0, tasks: [], topics: [], sources: [] };
  const total = data.total;
  const tasks = mode === 'selected' ? [...selected.values()] : data.tasks.map((task) => selected.get(task.id) ?? task);
  const currentTask = tasks.find((task) => task.id === viewId) ?? tasks[0];
  const used = new Set(existing.map((item) => item.id));
  useEffect(() => { heading.current?.focus(); }, [mode]);
  function changeMode(next: typeof mode) { setMode(next); setMobileView(false); }
  function clearSelection() { setSelected(new Map()); setError(''); }
  function toggle(task: AssessmentTaskSummary) {
    setError('');
    setSelected((previous) => {
      const next = new Map(previous);
      if (next.has(task.id)) next.delete(task.id); else next.set(task.id, task);
      return next;
    });
  }
  async function add() {
    setAdding(true); setError('');
    try {
      const entries = [...selected];
      const items: AssessmentTaskView[] = [];
      for (let offset = 0; offset < entries.length; offset += 6) {
        const batch = entries.slice(offset, offset + 6);
        items.push(...await Promise.all(batch.map(([id, item]) => teacherBankApi.view(id, item.version))));
      }
      onAdd(items);
    }
    catch (reason) { setError(apiErrorMessage(reason, 'Не удалось добавить задания. Повторите попытку.')); }
    finally { setAdding(false); }
  }
  return <section><button className={styles.textButton} disabled={adding} onClick={() => { if (mode === 'selected') changeMode('bank'); else onClose(); }}><ArrowLeft size={17} />{mode === 'selected' ? 'К банку' : 'К работе'}</button>
    <div className={styles.heading}><div><h1 ref={heading} tabIndex={-1}>{mode === 'selected' ? 'Выбранные задания' : 'Добавить из банка'}</h1></div>
      {mode === 'selected' && selected.size > 0 && <button className={styles.textButton} disabled={adding} onClick={clearSelection}>Сбросить выбор</button>}
    </div>
    {mode === 'bank' && <WorkBankFilters query={query} topics={data.topics} sources={data.sources} onChange={(patch) => { setQuery((previous) => ({ ...previous, ...patch, page: 1 })); setView(null); setMobileView(false); }} />}
    {mode === 'bank' && bank.isPending ? <p role="status">Загружаем банк…</p> : mode === 'bank' && bank.error ? <div role="alert"><p>{apiErrorMessage(bank.error)}</p><button className={styles.secondary} onClick={() => void bank.refetch()}>Повторить</button></div> : !tasks.length ? <PickerEmpty reviewing={mode === 'selected'} query={query} onReset={() => { setQuery({ gradeBand: query.gradeBand, search: '', topic: '', page: 1 }); setView(null); setMobileView(false); }} /> : <div className={`${styles.picker} ${mobileView ? styles.pickerViewing : ''}`}>
      <div className={styles.pickerList}><PickerList tasks={tasks} currentId={currentTask.id} selected={selected} used={used} adding={adding} atLimit={selected.size + existing.length >= ASSESSMENT_WORK_TASK_LIMIT} onToggle={toggle} onPreview={(id) => { setView(id); setMobileView(true); }} />
        {mode === 'bank' && <div className={styles.pagination}><button className={styles.textButton} disabled={page === 1} onClick={() => setQuery({ ...query, page: page - 1 })}>Назад</button><span>{page} / {Math.max(1, Math.ceil(total / 50))}</span><button className={styles.textButton} disabled={page * 50 >= total} onClick={() => setQuery({ ...query, page: page + 1 })}>Далее</button></div>}
      </div>
      <PickerPreview task={currentTask} onBack={() => setMobileView(false)} />
    </div>}
    <PickerSelectionBar selected={selected} reviewing={mode === 'selected'} adding={adding} error={error} onReview={() => changeMode('selected')} onAdd={() => void add()} />
  </section>;
}

function PickerEmpty({ reviewing, query, onReset }: { reviewing: boolean; query: AssessmentBankQuery; onReset: () => void }) {
  const filtered = Boolean(query.search || query.topic || query.type || query.exam || query.source);
  return <div className={styles.empty}>{reviewing ? <h2>Ничего не выбрано</h2> : <><p>По этим фильтрам заданий нет.</p>{filtered && <button type="button" className={styles.secondary} onClick={onReset}>Сбросить фильтры</button>}</>}</div>;
}

function PickerSelectionBar({ selected, reviewing, adding, error, onReview, onAdd }: {
  selected: ReadonlyMap<string, AssessmentTaskSummary>; reviewing: boolean; adding: boolean; error: string; onReview: () => void; onAdd: () => void;
}) {
  if (!selected.size) return null;
  const points = [...selected.values()].reduce((sum, item) => sum + item.maxPoints, 0);
  return <div className={styles.selectionFooter}>
    <span className={styles.selectionSummary} role="status">Выбрано {taskCountLabel(selected.size)} · {pointsLabel(points)}</span>
    <div className={styles.selectionActions}>{!reviewing && <button className={styles.secondary} disabled={adding} onClick={onReview}>Посмотреть</button>}<button className={styles.primary} disabled={adding} onClick={onAdd}>{adding ? 'Добавляем…' : 'Добавить в работу'}</button></div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </div>;
}

function PickerPreview({ task, onBack }: { task: AssessmentTaskSummary; onBack: () => void }) {
  const detail = useTeacherBankTask(task.id, task.version);
  return <div className={styles.pickerDetail}>
    <button className={`${styles.textButton} ${styles.mobileBack}`} onClick={onBack}><ArrowLeft size={16} />К списку</button>
    {detail.isPending ? <p role="status">Загружаем условие…</p> : detail.error ? <div role="alert"><p>{apiErrorMessage(detail.error)}</p><button className={styles.textButton} onClick={() => void detail.refetch()}>Повторить загрузку условия</button></div> : detail.data && <BankTaskPreview data={detail.data} />}
  </div>;
}

function PickerList({ tasks, currentId, selected, used, adding, atLimit, onToggle, onPreview }: {
  tasks: AssessmentTaskSummary[]; currentId: string; selected: ReadonlyMap<string, AssessmentTaskSummary>; used: ReadonlySet<string>;
  adding: boolean; atLimit: boolean; onToggle: (task: AssessmentTaskSummary) => void; onPreview: (id: string) => void;
}) {
  return <ul aria-label="Выбор заданий из банка">{tasks.map((task) => {
    const inWork = used.has(task.id);
    const checked = inWork || selected.has(task.id);
    return <li key={task.id} className={currentId === task.id ? styles.pickerActive : ''}>
      <label className={styles.checkTask}><input type="checkbox" aria-label={`Выбрать: ${task.title}`} disabled={adding || inWork || (!checked && atLimit)} checked={checked} onChange={() => onToggle(task)} /></label>
      <button className={styles.pickTask} onClick={() => onPreview(task.id)}><strong>{task.title}</strong><span>{task.topicPath.join(' / ')}</span><span>{taskSourceLabel(task.source)}</span><small>{inWork ? 'В работе' : pointsLabel(task.maxPoints)}</small></button>
    </li>;
  })}</ul>;
}
