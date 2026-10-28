"use client";

import { useState } from 'react';
import type { AssessmentImportResult, GradeBand } from '@continuum/shared';
import { workGrades } from '@/features/teacher-works/work-labels';
import { apiErrorMessage } from '@/lib/api/error-message';
import { useImportWork } from './use-import-work';
import styles from './teacher-bank.module.css';

export default function BankImportResult({ importId, title, result, busy, onClose }: {
  importId: string; title: string; result: AssessmentImportResult; busy: boolean; onClose: () => void;
}) {
  const work = useImportWork(importId, title, result);
  const [grade, setGrade] = useState<GradeBand | ''>(result.gradeBands?.length === 1 ? result.gradeBands[0] : '');
  const pending = busy || work.pending;
  const items = result.items ?? [];
  const grades = result.gradeBands ?? [];
  const canCreate = items.length > 0 && grades.length > 0;
  const countForm = items.length % 10 === 1 && items.length % 100 !== 11 ? 'задания' : 'заданий';
  return <div className={styles.importResult}>
    <h2>{result.added || result.updated ? 'Пакет добавлен' : 'Пакет обработан'}</h2>
    <p>Новых заданий: {result.added} · Новых версий: {result.updated} · Без изменений: {result.unchanged}</p>
    {canCreate && <p>Все задачи пакета сохранены в банке. Из них можно сразу собрать работу.</p>}
    {canCreate && grades.length > 1 && <label className={styles.importWorkGrade}>Параллель работы<select value={grade} disabled={pending || Boolean(work.error)} onChange={(event) => setGrade(event.target.value as GradeBand | '')}><option value="">Выберите параллель</option>{Object.entries(workGrades).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
    <div className={styles.importResultActions}>
      <button type="button" className={styles.primary} disabled={pending} onClick={onClose}>В банк заданий</button>
      {canCreate && <button type="button" className={styles.secondary} disabled={pending || !grade} onClick={() => { if (grade) void work.createWork(grade); }}>{work.pending ? 'Создаём работу…' : work.error ? 'Повторить создание работы' : `Создать работу из ${items.length} ${countForm}`}</button>}
    </div>
    {work.error && <p className={styles.error} role="alert">Задачи сохранены в банке. {apiErrorMessage(work.error, 'Не удалось создать работу. Повторите попытку.')}</p>}
  </div>;
}
