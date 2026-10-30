"use client";
import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { AssignmentReport } from '@continuum/shared';
import Dialog from '@/components/ui/Dialog';
import { MobileAssignmentSummary } from './MobileAssignmentList';
import { solutionsApi } from '@/lib/assessment/solutions.api';
import { solutionQueryKeys } from '@/lib/query/keys';
import { apiErrorMessage } from '@/lib/api/error-message';
import SolutionPhotoList from '@/components/assessment/SolutionPhotoList';
import ui from '@/features/teacher-works/teacher-works.module.css';
import styles from './teacher-assignments.module.css';

export default function StudentSolutionsPanel({ item, data, mobile, close }: { item: AssignmentReport['recipients'][number]; data: Pick<AssignmentReport, 'automaticTaskCount' | 'extendedTaskCount'>; mobile: boolean; close: () => void }) {
  const { id, name } = item;
  const hasSolutions = data.extendedTaskCount > 0;
  const origin = useRef(typeof document === 'undefined' ? null : document.activeElement);
  const heading = useRef<HTMLElement>(null);
  useEffect(() => { heading.current?.focus({ preventScroll: mobile }); }, [id, mobile]);
  const query = useQuery({ queryKey: solutionQueryKeys.answers(id), queryFn: () => solutionsApi.list(id), enabled: hasSolutions, refetchInterval: 10000, refetchIntervalInBackground: false, refetchOnMount: 'always', refetchOnWindowFocus: 'always' });
  const refresh = hasSolutions && <button className={ui.textButton} disabled={query.isFetching} onClick={() => void query.refetch()}>{query.isFetching ? 'Обновляем…' : 'Обновить решения'}</button>;
  const content = <>
    {!hasSolutions && <p className={styles.muted}>В работе только тестовая часть.</p>}
    {query.isError && query.data && <p className={styles.muted}>Не удалось обновить решения. Показаны последние полученные данные.</p>}
    {hasSolutions && query.isPending && <p role="status">Загружаем решения…</p>}
    {query.error && <p role="alert" className={ui.error}>{apiErrorMessage(query.error)}</p>}
    {query.data?.map((answer) => <article key={answer.taskId}><h3>{answer.title}</h3><p>{answer.publishedReview ? `Проверено · ${answer.publishedReview.points} из ${answer.maxPoints} баллов` : `${answer.locked ? 'На проверке' : answer.photos.length ? 'Ожидает проверки' : 'Решение не добавлено'} · Максимум: ${answer.maxPoints}`}</p>{answer.publishedReview && <a className={ui.textButton} href={`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'}${answer.publishedReview.reportUrl}`} target="_blank" rel="noreferrer">Разбор решения · PDF</a>}<SolutionPhotoList photos={answer.photos} /></article>)}
  </>;
  if (mobile) return <Dialog open onOpenChange={open => { if (!open) close(); }} title={<span ref={element => { heading.current = element; }} tabIndex={-1}>{name}</span>} description={<span className={styles.srOnly}>Выполнение ученика</span>} className={styles.mobileSolutions} onCloseAutoFocus={event => { event.preventDefault(); if (origin.current instanceof HTMLElement && origin.current.isConnected) origin.current.focus({ preventScroll: true }); }}>
    <button type="button" className={styles.mobileClose} aria-label="Закрыть выполнение" onClick={close}><X size={22} aria-hidden="true" /></button>
    <div className={styles.mobileSolutionsBody}><MobileAssignmentSummary item={item} data={data} />{refresh}{content}</div>
  </Dialog>;
  return <section aria-label={`Решения: ${name}`} className={ui.reading}>
    <div className={ui.sectionHeading}><h2 ref={element => { heading.current = element; }} tabIndex={-1}>{name} · Решения</h2><div className={styles.actions}>{refresh}<button className={ui.textButton} onClick={close}>Закрыть</button></div></div>{content}
  </section>;
}
