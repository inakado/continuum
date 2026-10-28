"use client";
import type { AssessmentImportPreview } from '@continuum/shared';
import type { useBankImportTask, useBankDuplicateHints } from './use-teacher-bank';
import BankDuplicateWarnings from './BankDuplicateWarnings';
import BankTaskPreview from './BankTaskPreview';
import { taskSourceLabel } from './task-source';
import styles from './teacher-bank.module.css';

const statusLabels = { new: 'Новое', changed: 'Новая версия', unchanged: 'Без изменений' };
export default function BankImportReview({ preview, selected, onSelect, view, duplicates }: { preview: AssessmentImportPreview; selected: string | null; onSelect: (id: string) => void; view: ReturnType<typeof useBankImportTask>; duplicates: ReturnType<typeof useBankDuplicateHints> }) {
  const duplicateIds = new Set(duplicates.data?.tasks.map((task) => task.stableId));
  return <>
    {preview.id && <BankDuplicateWarnings key={`${preview.id}:${selected}`} previewId={preview.id} stableId={selected} hints={duplicates.data} loading={duplicates.isPending} failed={Boolean(duplicates.error)} onRetry={() => void duplicates.refetch()} />}
    <div className={styles.importWorkspace}><ul className={styles.importList} aria-label="Задания пакета" tabIndex={0}>{preview.items.map((item) => <li key={item.stableId}><button aria-pressed={selected === item.stableId} onClick={() => onSelect(item.stableId)}><strong>{item.title}</strong><span>{taskSourceLabel(item.source)}</span><small>{statusLabels[item.status]}{item.status === 'changed' ? ` · версия ${item.version}` : ''}</small>{duplicateIds.has(item.stableId) && <small className={styles.duplicateBadge}>Возможно, дубликат</small>}</button></li>)}</ul>
      <div className={styles.previewColumn}><div key={selected} className={styles.condition} role="region" aria-label="Условие выбранного задания" aria-busy={view.isPending} tabIndex={0}>{view.isPending ? <p className={styles.muted}>Загружаем условие…</p> : view.error ? <div role="alert"><p>{view.error.message}</p><button type="button" className={styles.textButton} onClick={() => void view.refetch()}>Повторить загрузку условия</button></div> : view.data && <BankTaskPreview data={view.data} />}</div></div>
    </div>
  </>;
}
