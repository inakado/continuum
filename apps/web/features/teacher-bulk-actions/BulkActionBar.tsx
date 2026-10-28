"use client";
import { BULK_ACTION_LIMIT } from "@continuum/shared";
import { useEffect, useRef } from 'react';
import { Trash2, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiErrorMessage } from '@/lib/api/error-message';
import styles from './bulk-actions.module.css';

export function SelectionCheckbox({ label, checked, mixed = false, disabled = false, onChange }: { label: string; checked: boolean; mixed?: boolean; disabled?: boolean; onChange: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (input.current) input.current.indeterminate = mixed; }, [mixed]);
  return <label className={styles.checkbox}><input ref={input} type="checkbox" aria-label={label} checked={checked} disabled={disabled} onChange={onChange} /></label>;
}
export default function BulkActionBar({ count, total, busy, onAll, onClear, onDelete }: { count: number; total: number; busy: boolean; onAll: () => void; onClear: () => void; onDelete: (returnFocus: () => void) => void }) {
  const anchor = useRef<HTMLDivElement>(null);
  return <div ref={anchor} className={styles.bar} aria-label="Массовые действия">
    <div className={styles.selection}><SelectionCheckbox label={total > BULK_ACTION_LIMIT ? `Выбрать первые ${BULK_ACTION_LIMIT} записей` : 'Выбрать все на странице'} checked={count > 0 && count === Math.min(total, BULK_ACTION_LIMIT)} mixed={count > 0 && count < Math.min(total, BULK_ACTION_LIMIT)} disabled={busy || !total} onChange={onAll} /><span role="status">{count ? `Выбрано: ${count}` : total > BULK_ACTION_LIMIT ? `Первые ${BULK_ACTION_LIMIT}` : 'Выбрать все'}</span></div>
    {count > 0 && <div className={styles.actions}><button type="button" disabled={busy} onClick={onClear} aria-label="Снять выбор" title="Снять выбор"><X size={16} aria-hidden="true" /></button><button className={styles.danger} type="button" disabled={busy} onClick={() => { const fallback = anchor.current?.closest('main')?.querySelector<HTMLInputElement>('input[type=search]'); onDelete(() => (anchor.current?.querySelector('input') ?? fallback)?.focus()); }}><Trash2 size={15} aria-hidden="true" />Удалить</button></div>}
  </div>;
}
export function BulkUndoNotice({ count, onUndo, onDismiss }: { count: number; onUndo: () => Promise<unknown>; onDismiss: () => void }) {
  const anchor = useRef<HTMLElement>(null);
  const dismiss = () => { const fallback = anchor.current?.closest('main')?.querySelector<HTMLInputElement>('input[type=search]'); onDismiss(); fallback?.focus(); };
  const undo = useMutation({ mutationFn: onUndo, retry: false, onSuccess: dismiss });
  return <section ref={anchor} className={styles.notice} aria-label={`Удалено записей: ${count}`}>
    <div className={styles.message}><p role="status">Удалено: {count}</p>{undo.error && <p className={styles.error} role="alert">{apiErrorMessage(undo.error)}</p>}</div>
    <button type="button" disabled={undo.isPending} onClick={() => undo.mutate()}>{undo.isPending ? 'Восстанавливаем…' : 'Отменить'}</button>
    <button type="button" aria-label="Закрыть уведомление об удалении" disabled={undo.isPending} onClick={dismiss}><X size={18} aria-hidden="true" /></button>
  </section>;
}
