"use client";

import { useRef, useState, type RefObject } from 'react';
import { useMutation } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { Upload } from 'lucide-react';
import type { AssessmentImportPreview, AssessmentTaskView } from '@continuum/shared';
import { apiErrorMessage } from '@/lib/api/error-message';
import { teacherBankApi } from './teacher-bank.api';
import { useBankImportTask, useCorrectBankTask, usePreviewBankImport } from './use-teacher-bank';
import BankTaskPreview from './BankTaskPreview';
import { taskSourceLabel } from './task-source';
import styles from './bank-task-correction.module.css';

export default function BankTaskCorrection({ task, onClose, trigger }: { task: AssessmentTaskView; onClose: () => void; trigger: RefObject<HTMLButtonElement | null> }) {
  const [preview, setPreview] = useState<AssessmentImportPreview | null>(null);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [side, setSide] = useState<'before' | 'after'>('after');
  const [filename, setFilename] = useState('');
  const [closing, setClosing] = useState(false);
  const flight = useRef(false);
  const upload = usePreviewBankImport();
  const correction = useCorrectBankTask();
  const download = useMutation({ mutationFn: () => teacherBankApi.exportTask(task.id), retry: false });
  const view = useBankImportTask(preview?.id ?? null, preview?.items[0]?.stableId ?? null);
  const busy = upload.isPending || correction.isPending || closing;
  async function choose(file?: File) {
    if (!file || flight.current) return;
    setError(''); setConfirmed(false);
    if (!/\.zip$/i.test(file.name) || file.size > 25 * 1024 * 1024) { setError('Выберите ZIP размером до 25 МБ.'); return; }
    flight.current = true;
    try {
      if (preview?.id) await teacherBankApi.discard(preview.id);
      setPreview(null); correction.reset(); setFilename(file.name);
      const result = await upload.mutateAsync(file);
      setPreview(result); setSide('after');
      if (!result.issues.length && (result.items.length !== 1 || result.items[0].stableId !== task.task.id)) setError(`В ZIP должна быть только задача ${task.task.id} с прежним ID.`);
    } catch (reason) { setError(apiErrorMessage(reason)); }
    finally { flight.current = false; }
  }
  async function close() {
    if (flight.current) return;
    setClosing(true); setError('');
    try { if (preview?.id) await teacherBankApi.discard(preview.id); onClose(); }
    catch (reason) { setError(apiErrorMessage(reason)); setClosing(false); }
  }
  async function commit() {
    if (flight.current || !preview?.id || !confirmed) return;
    flight.current = true; setError('');
    try { await correction.mutateAsync({ id: task.id, importId: preview.id, expectedVersion: task.version }); }
    catch (reason) { setError(apiErrorMessage(reason)); }
    finally { flight.current = false; }
  }
  const valid = preview?.id && preview.items.length === 1 && preview.items[0].stableId === task.task.id && !preview.issues.length;
  return <Dialog.Root open onOpenChange={(open) => { if (!open) void close(); }}>
    <Dialog.Portal><Dialog.Overlay className={styles.overlay} /><Dialog.Content className={styles.dialog} data-comparing={Boolean(valid && !correction.data)} onCloseAutoFocus={(event) => { event.preventDefault(); trigger.current?.focus(); }}>
      <header className={styles.header}><div className={styles.headerTop}><Dialog.Title>{correction.data ? 'Условие исправлено' : 'Исправить условие'}</Dialog.Title><span className={styles.source} title={taskSourceLabel(task.task.source)}>{taskSourceLabel(task.task.source)}</span></div><Dialog.Description>{correction.data ? 'Условие обновлено в банке и работах. Ответы и баллы сохранены.' : 'Обновится в банке и выданных работах. Ответы и баллы сохранятся.'}</Dialog.Description></header>
      {correction.data ? <div className={styles.success} role="status"><p>Ученику с открытой работой условие обновится автоматически.</p><button type="button" className={styles.primary} disabled={busy} onClick={() => void close()}>Готово</button></div> : <>
        <div className={styles.upload} data-ready={Boolean(valid)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void choose(event.dataTransfer.files[0]); }}>
          <Upload size={21} aria-hidden="true" /><div><strong title={filename || undefined}>{upload.isPending ? 'Проверяем исправление…' : filename || 'ZIP с исправленной задачей'}</strong>{!valid && <p>Одна задача · до 25 МБ</p>}</div><label className={styles.fileButton}>{preview ? 'Другой файл' : 'Выбрать ZIP'}<input type="file" accept=".zip,application/zip" disabled={busy} onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = ''; }} /></label>
        </div>
        {!valid && <p className={styles.download}><button type="button" disabled={busy || download.isPending} onClick={() => download.mutate()}>{download.isPending ? 'Скачиваем…' : 'Скачать эту задачу'}</button><span>Исправьте условие или рисунок в скачанном ZIP и загрузите обратно.</span></p>}
        {download.error && <p role="alert" className={styles.error}>{apiErrorMessage(download.error)}</p>}
        {preview?.issues.length ? <ul className={styles.issues} role="alert">{preview.issues.map((issue, index) => <li key={index}><code>{issue.path}</code> {issue.message}</li>)}</ul> : null}
        {valid && <>
          <div className={styles.tabs} role="group" aria-label="Сравнение условия"><button type="button" aria-pressed={side === 'before'} onClick={() => setSide('before')}>Сейчас</button><button type="button" aria-pressed={side === 'after'} onClick={() => setSide('after')}>Исправление</button></div>
          <div className={styles.comparison} data-side={side}><section className={styles.before} aria-label="Текущее условие"><h3>Сейчас</h3><BankTaskPreview data={task} compact conditionOnly /></section><section className={styles.after} aria-label="Исправленное условие"><h3>Исправление</h3>{view.isPending ? <p role="status">Загружаем условие…</p> : view.error ? <p role="alert">{apiErrorMessage(view.error)} <button type="button" className={styles.secondary} onClick={() => void view.refetch()}>Повторить</button></p> : view.data && <BankTaskPreview data={view.data} compact conditionOnly />}</section></div>
        </>}
        <footer className={styles.footer}>
          {valid && view.data && <label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={busy || correction.isError} onChange={(event) => setConfirmed(event.target.checked)} />Смысл задачи и правильный ответ не изменились</label>}
          <div className={styles.actions}><button type="button" className={styles.secondary} disabled={busy} onClick={() => void close()}>Отмена</button>{valid && <button type="button" className={styles.primary} disabled={busy || !valid || !view.data || Boolean(view.error) || !confirmed} onClick={() => void commit()}>{correction.isPending ? 'Сохраняем…' : correction.isError ? 'Повторить сохранение' : 'Сохранить в банке и работах'}</button>}</div>
        </footer>
      </>}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
