"use client";

import { useState } from 'react';
import { ArrowLeft, Upload } from 'lucide-react';
import type { AssessmentImportPreview, GradeBand } from '@continuum/shared';
import { teacherBankApi } from './teacher-bank.api';
import { useBankImportTask, useConfirmBankImport, usePreviewBankImport } from './use-teacher-bank';
import BankTaskPreview from './BankTaskPreview';
import { taskSourceLabel } from './task-source';
import styles from './teacher-bank.module.css';

const statusLabels = { new: 'Новое', changed: 'Новая версия', unchanged: 'Без изменений' };
export default function BankImportPanel({ onClose }: { onClose: (grade?: GradeBand) => void }) {
  const [preview, setPreview] = useState<AssessmentImportPreview | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filename, setFilename] = useState('');
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);
  const upload = usePreviewBankImport();
  const confirm = useConfirmBankImport();
  const view = useBankImportTask(preview?.id ?? null, selected);
  const busy = upload.isPending || confirm.isPending || closing;
  const counts = { new: 0, changed: 0, unchanged: 0 };
  preview?.items.forEach((item) => counts[item.status]++);
  async function choose(file?: File) {
    if (!file || busy) return;
    setError('');
    if (!/\.zip$/i.test(file.name) || file.size > 25 * 1024 * 1024) { setError('Выберите ZIP размером до 25 МБ.'); return; }
    try {
      if (preview?.id) await teacherBankApi.discard(preview.id);
      setPreview(null); setSelected(null); confirm.reset(); setFilename(file.name);
      const result = await upload.mutateAsync(file);
      setPreview(result); setSelected(result.items[0]?.stableId ?? null);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось проверить пакет.'); }
  }
  async function close() {
    if (busy) return;
    setClosing(true); setError('');
    try { if (preview?.id) await teacherBankApi.discard(preview.id); onClose(confirm.data ? view.data?.task.gradeBand : undefined); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось закрыть проверку.'); setClosing(false); }
  }
  async function commit() {
    if (!preview?.id) return;
    setError('');
    try { await confirm.mutateAsync(preview.id); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Результат не подтверждён. Повторите запрос: дубликатов не будет.'); }
  }
  return <section>
    <button className={styles.textButton} disabled={busy} onClick={() => void close()}><ArrowLeft size={17} />Банк заданий</button>
    <div className={styles.heading}><div><h1>Загрузить пакет</h1><p>Готовые задания, формулы и рисунки</p></div></div>
    <ol className={styles.steps} aria-label="Этапы импорта">{['Пакет', 'Проверка', 'Результат'].map((step, index) => <li key={step} aria-current={index === (confirm.data ? 2 : preview ? 1 : 0) ? 'step' : undefined}>{index + 1}. {step}</li>)}</ol>
    {confirm.data ? <div className={styles.importResult}><h2>Пакет добавлен</h2><p>Новых заданий: {confirm.data.added} · Новых версий: {confirm.data.updated} · Без изменений: {confirm.data.unchanged}</p><button className={styles.primary} disabled={busy} onClick={() => void close()}>В банк заданий</button></div> : <>
      <div className={styles.uploadArea} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void choose(event.dataTransfer.files[0]); }}>
        <Upload size={24} aria-hidden="true" /><div><strong>{upload.isPending ? 'Проверяем пакет…' : filename || 'Перетащите ZIP сюда'}</strong><p>manifest.json, условия Markdown и рисунки · до 25 МБ</p></div>
        <label className={styles.secondary}>{preview ? 'Заменить файл' : 'Выбрать файл'}<input type="file" accept=".zip,application/zip" disabled={busy} className={styles.fileInput} onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = ''; }} /></label>
      </div>
      {preview && <>
        {preview.issues.length > 0 ? <section role="alert" className={styles.issues}><h2>Пакет не добавлен</h2><p>Исправьте файлы локально и загрузите ZIP ещё раз.</p><ul>{preview.issues.map((issue, index) => <li key={index}><code>{issue.path || 'Архив'}</code><span>{issue.message}</span></li>)}</ul></section> : <>
          <div className={styles.importSummary}><div><h2>{preview.title}</h2><p>Новых: {counts.new} · Новых версий: {counts.changed} · Без изменений: {counts.unchanged}</p></div><button className={styles.primary} disabled={busy || !preview.id || counts.new + counts.changed === 0} onClick={() => void commit()}>{confirm.isPending ? 'Добавляем…' : confirm.isError ? 'Повторить добавление' : 'Добавить в банк'}</button></div>
          <p className={styles.muted}>{counts.new + counts.changed ? 'Проверьте условия и ответы. До подтверждения банк не изменится.' : 'Этот пакет уже есть в банке. Новые версии не создадутся.'}</p>
          <div className={styles.workspace}><ul className={styles.importList} aria-label="Задания пакета">{preview.items.map((item) => <li key={item.stableId}><button aria-pressed={selected === item.stableId} onClick={() => setSelected(item.stableId)}><strong>{item.title}</strong><span>{taskSourceLabel(item.source)}</span><small>{statusLabels[item.status]}{item.status === 'changed' ? ` · версия ${item.version}` : ''}</small></button></li>)}</ul>
            <div className={styles.previewColumn}>{view.isPending ? <p className={styles.muted}>Загружаем условие…</p> : view.error ? <p role="alert">{view.error.message}</p> : view.data && <BankTaskPreview data={view.data} />}</div></div>
        </>}
      </>}
    </>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </section>;
}
