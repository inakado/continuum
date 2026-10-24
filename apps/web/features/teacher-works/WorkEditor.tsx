"use client";
import { worksListHref } from './use-works-filters';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, Eye, Plus } from 'lucide-react';
import { ASSESSMENT_WORK_TASK_LIMIT, type AssessmentWorkDetail, type GradeBand } from '@continuum/shared';
import { pointsLabel } from '@/features/teacher-bank/task-source';
import { useWorkDraft } from './use-work-draft';
import { useWorkArrangement } from './use-work-arrangement';
import WorkPreview from './WorkPreview';
import { taskCountLabel, workGrades, workStateLabel } from './work-labels';
import WorksShell from './WorksShell';
import WorkTaskRow from './WorkTaskRow';
import WorkBankPicker from './WorkBankPicker';
import WorkSelect from './WorkSelect';
import { useSaveBeforeLeave } from '@/lib/navigation/use-save-before-leave';
import WorkSaveFeedback from './WorkSaveFeedback';
import styles from './teacher-works.module.css';

function CopyNotice({ count = 0 }: { count?: number }) {
  return count > 0 ? <p className={styles.copyNotice} role="note">При создании копии пропущено заданий: {count}. Они удалены из банка.</p> : null;
}
export default function WorkEditor({ initial, onReload }: { initial: AssessmentWorkDetail; onReload: () => Promise<void> }) {
  const editor = useWorkDraft(initial);
  const leave = useSaveBeforeLeave(editor.dirty, editor.flush, editor.discard);
  const { draft } = editor;
  const router = useRouter();
  const [picking, setPicking] = useState(false); const [preview, setPreview] = useState(false);
  const [opened, setOpened] = useState<string | null>(null);
  const [instructionsOpen, setInstructions] = useState(Boolean(draft.instructions));
  const { drop, announcement, removed, move, remove, undo, dragOver, dropItem, startDrag, endDrag } = useWorkArrangement(draft.items, (items) => editor.change({ items }));
  const total = draft.items.reduce((sum, item) => sum + item.task.maxPoints, 0);
  const extended = draft.items.filter((item) => item.task.type === 'extended');
  return <WorksShell beforeLeave={leave.request}>
    <WorkSaveFeedback editor={editor} leave={leave} onReload={onReload} />
    {picking ? <WorkBankPicker existing={draft.items} grade={draft.gradeBand} onClose={() => setPicking(false)} onAdd={(items) => { editor.change({ items: [...draft.items, ...items.filter((item) => !draft.items.some((current) => current.id === item.id))] }); setPicking(false); }} /> : <>
      <button className={styles.textButton} onClick={() => { void leave.request().then((allowed) => { if (allowed) router.push(worksListHref(new URLSearchParams(window.location.search))); }); }}><ArrowLeft size={17} />К работам</button>
      <CopyNotice count={initial.copySkippedTaskCount} />
      <div className={styles.editorHeading}><div>{preview ? <h1>{draft.title}</h1> : <input className={styles.titleInput} aria-label="Название работы" maxLength={200} value={draft.title} onChange={(event) => { editor.change({ title: event.target.value }); }} />}
        <div className={styles.meta}>{preview ? workGrades[draft.gradeBand] : <WorkSelect aria-label="Параллель работы" value={draft.gradeBand} onChange={(event) => { editor.change({ gradeBand: event.target.value as GradeBand }); }}>{Object.entries(workGrades).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</WorkSelect>}<span>· {workStateLabel(initial.isArchived)}</span>{!preview && <button className={styles.textButton} onClick={() => setInstructions(!instructionsOpen)}>{instructionsOpen ? 'Скрыть инструкцию' : draft.instructions ? 'Инструкция' : 'Добавить инструкцию'}</button>}</div>
      </div><span className={styles.saveStatus} role="status">{editor.saving ? 'Сохраняем…' : editor.error ? 'Не сохранено' : !draft.title.trim() ? 'Введите название' : editor.dirty ? 'Есть изменения' : <><Check size={17} />Сохранено</>}</span></div>
      {instructionsOpen && !preview && <label className={styles.instructionField}>Инструкция ученику<textarea maxLength={10000} value={draft.instructions} onChange={(event) => { editor.change({ instructions: event.target.value }); }} /></label>}
      {preview && draft.instructions && <p className={styles.instructions}>{draft.instructions}</p>}
      <div className={styles.sectionHeading}><div><h2>{extended.length ? 'Задания работы' : 'Тестовая часть'}</h2><span>{taskCountLabel(draft.items.length)} · {pointsLabel(total)}</span>{extended.length > 0 && <p>Тестовая часть: {draft.items.length - extended.length} · Развёрнутые задачи: {extended.length} ({pointsLabel(extended.reduce((sum, item) => sum + item.task.maxPoints, 0))})</p>}</div><div className={styles.actions}><button className={styles.secondary} disabled={editor.dirty || !draft.items.length} onClick={() => router.push(`/teacher/works/${initial.id}/assign`)}>Назначить классам</button>{!preview && <button className={styles.primary} onClick={() => setPicking(true)}><Plus size={18} />Добавить из банка</button>}<button className={styles.secondary} disabled={!draft.items.length} onClick={() => setPreview(!preview)}><Eye size={17} />{preview ? 'К редактированию' : 'Просмотр работы'}</button></div></div>
      {preview ? <WorkPreview id={initial.id} revision={editor.revision} items={draft.items} dirty={editor.dirty} /> : draft.items.length ? <ol className={styles.tasks} aria-label="Задания работы" onKeyDown={(event) => { if (event.key === 'Escape') { endDrag(); } }}>{draft.items.map((item, index) => <WorkTaskRow key={item.id} item={item} index={index} count={draft.items.length} open={opened === item.id} drop={drop?.index === index ? drop.after ? 'after' : 'before' : null} onToggle={() => setOpened(opened === item.id ? null : item.id)} onMove={(position) => move(item.id, position)} onRemove={() => remove(item, index)} onDragStart={startDrag} onDragEnd={endDrag} onDragOver={dragOver} onDrop={dropItem} />)}</ol> : <div className={styles.empty}><h2>В работе пока нет заданий</h2><p>Добавьте задания из банка. Их порядок можно будет изменить.</p></div>}
      {removed && !preview && <div className={styles.undo} role="status">{draft.items.length >= ASSESSMENT_WORK_TASK_LIMIT ? 'Лимит заданий достигнут. Уберите одно, чтобы восстановить удалённое.' : 'Задание убрано из работы.'}<button className={styles.textButton} disabled={draft.items.length >= ASSESSMENT_WORK_TASK_LIMIT} onClick={undo}>Отменить</button></div>}
      <p className={styles.total}>Итого: {taskCountLabel(draft.items.length)} · {pointsLabel(total)}</p>
    </>}
    <span className={styles.srOnly} aria-live="polite">{announcement}</span>
  </WorksShell>;
}
