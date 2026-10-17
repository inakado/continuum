"use client";
import { useState } from 'react';
import type { AssessmentWorkDetail } from '@continuum/shared';
import BankTaskPreview from '@/features/teacher-bank/BankTaskPreview';
import { pointsLabel, taskSourceLabel } from '@/features/teacher-bank/task-source';
import { teacherWorksApi } from './teacher-works.api';
import { apiErrorMessage } from '@/lib/api/error-message';
import styles from './teacher-works.module.css';

export default function WorkPreview({ id, revision, items, dirty, readOnly = false }: { id: string; revision: number; items: AssessmentWorkDetail['items']; dirty: boolean; readOnly?: boolean }) {
  const [version, setVersion] = useState<number | null>(null);
  const [freezing, setFreezing] = useState(false);
  const [error, setError] = useState('');

  async function freeze() {
    setFreezing(true); setError('');
    try {
      const result = await teacherWorksApi.freeze(id, revision);
      setVersion(result.number);
    } catch (reason) {
      setError(apiErrorMessage(reason, 'Не удалось сохранить версию. Повторите попытку.'));
    } finally { setFreezing(false); }
  }
  return <div className={styles.reading}>
    {items.map((item, index) => <article key={item.id}>
      <h2>{index + 1}. {item.task.title}</h2>
      <p className={styles.source}>{taskSourceLabel(item.task.source)} · {pointsLabel(item.task.maxPoints)}</p>
      <BankTaskPreview data={item} compact hideAnswers />
    </article>)}
    {!readOnly && <div className={styles.versionBar}>
      <button className={styles.secondary} disabled={dirty || freezing || !items.length} onClick={() => void freeze()}>{freezing ? 'Сохраняем версию…' : 'Сохранить версию'}</button>
      <span>{version ? `Сохранена версия ${version}` : 'Фиксирует текущие условия и порядок заданий'}</span>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </div>}
  </div>;
}
