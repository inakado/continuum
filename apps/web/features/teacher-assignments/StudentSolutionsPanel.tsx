"use client";
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { solutionsApi } from '@/lib/assessment/solutions.api';
import { solutionQueryKeys } from '@/lib/query/keys';
import { apiErrorMessage } from '@/lib/api/error-message';
import SolutionPhotoList from '@/components/assessment/SolutionPhotoList';
import ui from '@/features/teacher-works/teacher-works.module.css';
import styles from './teacher-assignments.module.css';

export default function StudentSolutionsPanel({ id, name, close }: { id: string; name: string; close: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [id]);
  const query = useQuery({ queryKey: solutionQueryKeys.answers(id), queryFn: () => solutionsApi.list(id), refetchInterval: 10000, refetchIntervalInBackground: false, refetchOnMount: 'always', refetchOnWindowFocus: 'always' });
  return <section aria-label={`Решения: ${name}`} className={ui.reading}>
    <div className={ui.sectionHeading}><h2 ref={heading} tabIndex={-1}>{name} · Решения</h2><div className={styles.actions}><button className={ui.textButton} disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? 'Обновляем…' : 'Обновить решения'}</button><button className={ui.textButton} onClick={close}>Закрыть</button></div></div>
    {query.isError && query.data && <p className={styles.muted}>Не удалось обновить решения. Показаны последние полученные данные.</p>}
    {query.isPending && <p role="status">Загружаем решения…</p>}
    {query.error && <p role="alert" className={ui.error}>{apiErrorMessage(query.error)}</p>}
    {query.data?.map((answer) => <article key={answer.taskId}><h3>{answer.title}</h3><p>{answer.publishedReview ? `Проверено · ${answer.publishedReview.points} из ${answer.maxPoints} баллов` : `${answer.locked ? 'На проверке' : answer.photos.length ? 'Ожидает проверки' : 'Решение не добавлено'} · Максимум: ${answer.maxPoints}`}</p>{answer.publishedReview && <a className={ui.textButton} href={`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'}${answer.publishedReview.reportUrl}`} target="_blank" rel="noreferrer">Разбор решения · PDF</a>}<SolutionPhotoList photos={answer.photos} /></article>)}
  </section>;
}
