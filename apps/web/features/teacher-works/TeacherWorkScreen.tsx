"use client";
import { useState } from 'react';
import { useTeacherWork } from './use-teacher-works';
import WorkEditor from './WorkEditor';
import WorksShell from './WorksShell';
import { apiErrorMessage } from '@/lib/api/error-message';
import styles from './teacher-works.module.css';

export default function TeacherWorkScreen({ id }: { id: string }) {
  const work = useTeacherWork(id);
  const [generation, setGeneration] = useState(0);
  const [reloadError, setReloadError] = useState('');
  if (work.isPending) return <WorksShell><p role="status">Загружаем работу…</p></WorksShell>;
  if (!work.data) return <WorksShell><p role="alert">{apiErrorMessage(work.error, 'Не удалось загрузить работу.')}</p><button className={styles.secondary} onClick={() => void work.refetch()}>Повторить</button></WorksShell>;
  return <>{reloadError && <p role="alert">{reloadError}</p>}<WorkEditor key={`${id}-${generation}`} initial={work.data} onReload={() => { void work.refetch().then((result) => { if (result.error) setReloadError(apiErrorMessage(result.error)); else { setReloadError(''); setGeneration((value) => value + 1); } }); }} /></>;
}
