"use client";

import { useRef, useState, type RefObject } from 'react';
import { useMutation } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { Upload } from 'lucide-react';
import type { AssessmentImportPreview, AssessmentTaskView } from '@continuum/shared';
import { ApiError } from '@/lib/api/client';
import { apiErrorMessage } from '@/lib/api/error-message';
import { teacherBankApi } from './teacher-bank.api';
import { useBankCorrectionImpact, useBankImportTask, useCorrectBankTask, usePreviewBankImport } from './use-teacher-bank';
import CorrectionGrading from './CorrectionGrading';
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
  const valid = preview?.id && preview.items.length === 1 && preview.items[0].stableId === task.task.id && !preview.issues.length;
  const impact = useBankCorrectionImpact(task.id, preview?.id ?? null, task.version, Boolean(valid && view.data));
  const regrading = Boolean(impact.data?.gradingChanged);
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
    try { await correction.mutateAsync({ id: task.id, importId: preview.id, expectedVersion: task.version, ...(regrading ? { expectedImpactHash: impact.data!.hash } : {}) }); }
    catch (reason) { setError(apiErrorMessage(reason)); }
    finally { flight.current = false; }
  }

  return <Dialog.Root open onOpenChange={(open) => { if (!open) void close(); }}>
    <Dialog.Portal><Dialog.Overlay className={styles.overlay} /><Dialog.Content className={styles.dialog} data-comparing={Boolean(valid && !correction.data)} onCloseAutoFocus={(event) => { event.preventDefault(); trigger.current?.focus(); }}>
      <header className={styles.header}><div className={styles.headerTop}><Dialog.Title>{correction.data ? 'Задача исправлена' : 'Исправить задачу'}</Dialog.Title><span className={styles.source} title={taskSourceLabel(task.task.source)}>{taskSourceLabel(task.task.source)}</span></div><Dialog.Description>{correction.data ? regrading ? 'Оценивание обновлено. Ответы и фотографии сохранены.' : 'Условие обновлено. Ответы и баллы сохранены.' : 'Исправление применяется в банке и связанных работах. Ответы и фотографии сохраняются.'}</Dialog.Description></header>
      {correction.data ? <div className={styles.success} role="status"><p>Ученику с открытой работой исправление загрузится автоматически.</p><button type="button" className={styles.primary} disabled={busy} onClick={() => void close()}>Готово</button></div> : <>
        <div className={styles.upload} data-ready={Boolean(valid)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void choose(event.dataTransfer.files[0]); }}>
          <Upload size={21} aria-hidden="true" /><div><strong title={filename || undefined}>{upload.isPending ? 'Проверяем исправление…' : filename || 'ZIP с исправленной задачей'}</strong>{!valid && <p>Одна задача · до 25 МБ</p>}</div><label className={styles.fileButton}>{preview ? 'Другой файл' : 'Выбрать ZIP'}<input type="file" accept=".zip,application/zip" disabled={busy} onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = ''; }} /></label>
        </div>
        {!valid && <p className={styles.download}><button type="button" disabled={busy || download.isPending} onClick={() => download.mutate()}>{download.isPending ? 'Скачиваем…' : 'Скачать эту задачу'}</button><span>Исправьте задачу в скачанном ZIP и загрузите обратно.</span></p>}
        {download.error && <p role="alert" className={styles.error}>{apiErrorMessage(download.error)}</p>}
        {preview?.issues.length ? <ul className={styles.issues} role="alert">{preview.issues.map((issue, index) => <li key={index}><code>{issue.path}</code> {issue.message}</li>)}</ul> : null}
        {valid && <div className={styles.reviewBody}>
          <div className={styles.tabs} role="group" aria-label="Сравнение условия"><button type="button" aria-pressed={side === 'before'} onClick={() => setSide('before')}>Сейчас</button><button type="button" aria-pressed={side === 'after'} onClick={() => setSide('after')}>Исправление</button></div>
          <div className={styles.comparison} data-side={side}><section className={styles.before} aria-label="Текущее условие"><h3>Сейчас</h3>{regrading && <CorrectionGrading task={task.task} />}<BankTaskPreview data={task} compact conditionOnly /></section><section className={styles.after} aria-label="Исправленное условие"><h3>Исправление</h3>{regrading && view.data && <CorrectionGrading task={view.data.task} />}{view.isPending ? <p role="status">Загружаем условие…</p> : view.error ? <p role="alert">{apiErrorMessage(view.error)} <button type="button" className={styles.secondary} onClick={() => void view.refetch()}>Повторить</button></p> : view.data && <BankTaskPreview data={view.data} compact conditionOnly />}</section></div>
          {impact.isFetching && <p role="status">Проверяем влияние исправления…</p>}
          {impact.error && <p role="alert">{apiErrorMessage(impact.error)} <button type="button" className={styles.secondary} onClick={() => { setConfirmed(false); void impact.refetch(); }}>Повторить проверку</button></p>}
          {regrading && impact.data && <section className={styles.impact} aria-label="Предварительный пересчёт"><h3>Пересчёт баллов</h3><p>Работ: {impact.data.workCount}. Завершённых результатов: {impact.data.completedCount}. Изменятся: {impact.data.changes.length}.</p><ul>{impact.data.changes.slice(0, 5).map(change => <li key={change.recipientId}>{change.name} · {change.workTitle}<br />За задачу: {change.taskBefore} → {change.taskAfter}. Итог: {change.before} → {change.after}.</li>)}</ul>{impact.data.changes.length > 5 && <p>И ещё {impact.data.changes.length - 5} результатов.</p>}<p>Незавершённые работы сохранят ответы и будут проверены по исправленной шкале.</p></section>}
        </div>}
        <footer className={styles.footer}>
          {valid && view.data && <label className={styles.confirm}><input type="checkbox" checked={confirmed} disabled={busy || !impact.data || impact.isFetching || correction.isError} onChange={(event) => setConfirmed(event.target.checked)} />{regrading ? 'Проверил исправление и изменения баллов' : 'Смысл задачи и правильный ответ не изменились'}</label>}
          <div className={styles.actions}><button type="button" className={styles.secondary} disabled={busy} onClick={() => void close()}>Отмена</button>{valid && <button type="button" className={styles.primary} disabled={busy || !valid || !view.data || Boolean(view.error) || !impact.data || impact.isFetching || Boolean(impact.error) || !confirmed} onClick={() => void commit()}>{correction.isPending ? 'Сохраняем…' : correction.isError ? 'Повторить сохранение' : regrading ? 'Сохранить и перепроверить' : 'Сохранить в банке и работах'}</button>}</div>
        </footer>
      </>}
      {correction.error instanceof ApiError && correction.error.status === 409 && regrading && <button type="button" className={styles.secondary} onClick={() => { setConfirmed(false); correction.reset(); void impact.refetch(); }}>Обновить пересчёт</button>}
      {error && <p className={styles.error} role="alert">{error}</p>}
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}
