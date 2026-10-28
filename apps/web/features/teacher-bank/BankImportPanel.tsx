"use client";

import { useState } from 'react';
import { ArrowLeft, Upload } from 'lucide-react';
import type { AssessmentImportPreview, GradeBand } from '@continuum/shared';
import { teacherBankApi } from './teacher-bank.api';
import { useBankImportTask, useConfirmBankImport, usePreviewBankImport, useBankDuplicateHints } from './use-teacher-bank';
import BankImportReview from './BankImportReview';
import BankImportResult from './BankImportResult';
import styles from './teacher-bank.module.css';

export default function BankImportPanel({ onClose }: { onClose: (grade?: GradeBand) => void }) {
  const [preview, setPreview] = useState<AssessmentImportPreview | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [filename, setFilename] = useState('');
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);
  const upload = usePreviewBankImport();
  const confirm = useConfirmBankImport();
  const view = useBankImportTask(preview?.id ?? null, selected);
  const duplicates = useBankDuplicateHints(preview?.issues.length === 0 && !confirm.data ? preview.id : null);
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
    try { if (preview?.id) await teacherBankApi.discard(preview.id); onClose(confirm.data?.gradeBands?.length === 1 ? confirm.data.gradeBands[0] : undefined); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Не удалось закрыть проверку.'); setClosing(false); }
  }
  async function commit() {
    if (!preview?.id) return;
    setError('');
    try { await confirm.mutateAsync(preview.id); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Результат не подтверждён. Повторите запрос: дубликатов не будет.'); }
  }
  return <section>
    {!confirm.data && <button className={styles.textButton} disabled={busy} onClick={() => void close()}><ArrowLeft size={17} />Банк заданий</button>}
    <div className={styles.heading}><div><h1>Загрузить пакет</h1><p>Готовые задания, формулы и рисунки</p></div></div>
    <ol className={styles.steps} aria-label="Этапы импорта">{['Пакет', 'Проверка', 'Результат'].map((step, index) => <li key={step} aria-current={index === (confirm.data ? 2 : preview ? 1 : 0) ? 'step' : undefined}>{index + 1}. {step}</li>)}</ol>
    {confirm.data && preview?.id ? <BankImportResult importId={preview.id} title={preview.title} result={confirm.data} busy={busy} onClose={() => void close()} /> : <>
      <div className={styles.uploadArea} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); void choose(event.dataTransfer.files[0]); }}>
        <Upload size={24} aria-hidden="true" /><div><strong>{upload.isPending ? 'Проверяем пакет…' : filename || 'Перетащите ZIP сюда'}</strong><p>manifest.json, условия Markdown и рисунки · до 25 МБ</p></div>
        <label className={styles.secondary}>{preview ? 'Заменить файл' : 'Выбрать файл'}<input type="file" accept=".zip,application/zip" disabled={busy} className={styles.fileInput} onChange={(event) => { void choose(event.target.files?.[0]); event.target.value = ''; }} /></label>
      </div>
      {preview && <>
        {preview.issues.length > 0 ? <section role="alert" className={styles.issues}><h2>Пакет не добавлен</h2><p>Исправьте файлы локально и загрузите ZIP ещё раз.</p><ul>{preview.issues.map((issue, index) => <li key={index}><code>{issue.path || 'Архив'}</code><span>{issue.message}</span></li>)}</ul></section> : <>
          <div className={styles.importSummary}><div><h2>{preview.title}</h2><p>Новых: {counts.new} · Новых версий: {counts.changed} · Без изменений: {counts.unchanged}</p></div><button className={styles.primary} disabled={busy || !preview.id} onClick={() => void commit()}>{confirm.isPending ? 'Добавляем…' : confirm.isError ? 'Повторить добавление' : counts.new + counts.changed ? 'Добавить в банк' : 'Продолжить'}</button></div>
          <p className={styles.muted}>{counts.new + counts.changed ? 'Проверьте условия и ответы. До подтверждения банк не изменится.' : 'Этот пакет уже есть в банке. Новые версии не создадутся.'}</p>
          <BankImportReview preview={preview} selected={selected} onSelect={setSelected} view={view} duplicates={duplicates} />
        </>}
      </>}
    </>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </section>;
}
