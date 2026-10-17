"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { StudentWorkDetail } from '@continuum/shared';
import { ApiError } from '@/lib/api/client';
import { apiErrorMessage } from '@/lib/api/error-message';
import { studentWorkQueryKeys } from '@/lib/query/keys';
import StudentWorksShell from './StudentWorksShell';
import StudentWorkQuestions from './StudentWorkQuestions';
import { studentWorksApi } from './student-works.api';
import { useStudentAttempt } from './use-student-attempt';
import { useStudentLeave } from './use-student-leave';
import StudentLeaveDialog from './StudentLeaveDialog';
import { useAuthSession } from '@/features/auth/useAuthSession';
import { useAnswerDraft } from './use-answer-draft';
import StudentDraftNotice from './StudentDraftNotice';
import StudentReauthenticate from './StudentReauthenticate';
import StudentFinishReview from './StudentFinishReview';
import styles from './student-works.module.css';

function SaveStatus({ attempt }: { attempt: ReturnType<typeof useStudentAttempt> }) {
  const text = !attempt.online ? 'Нет сети' : attempt.error ? 'Не сохранено' : attempt.saving ? 'Сохраняем…' : attempt.dirty ? 'Есть изменения' : 'Сохранено';
  return <span role="status" className={styles.muted}>{text}</span>;
}

function SaveError({ error, onReload, retry }: { error: Error | null; onReload: () => void; retry?: () => void }) {
  if (!error) return null;
  const conflict = error instanceof ApiError && error.status === 409;
  return <div className={styles.error} role="alert"><p>{apiErrorMessage(error, 'Не удалось подтвердить сохранение. Проверьте соединение и повторите попытку.')}</p>
    {conflict ? <button className={styles.secondary} onClick={() => { if (window.confirm('Загрузить сохранённые ответы? Несохранённые изменения этой вкладки будут потеряны.')) onReload(); }}>Загрузить сохранённую работу</button> : retry ? <button className={styles.secondary} onClick={retry}>Повторить сохранение</button> : null}
  </div>;
}

function WorkResult({ result }: { result: StudentWorkDetail['result'] }) {
  return <div className={styles.result}><h2>Работа завершена</h2><p>Верно: {result?.correctCount} · Неверно: {result?.incorrectCount}</p><Link className={styles.textButton} href="/student/works">К списку работ</Link></div>;
}

function StudentWorkPlayer({ initial, onReload, reloadError }: { initial: StudentWorkDetail; onReload: () => void; reloadError: Error | null }) {
  const attempt = useStudentAttempt(initial);
  const [review, setReview] = useState(false);
  const [requestedTask, setRequestedTask] = useState<{ id: string; request: number }>();
  const session = useAuthSession();
  const [principal] = useState(() => session.data?.user ?? { id: '', login: '' });
  const draft = useAnswerDraft(principal.id, initial, attempt.answers, attempt.saved, attempt.state.status === 'completed');
  const leave = useStudentLeave(attempt.dirty, attempt.flush, () => { draft.discard(); attempt.discard(); });
  const { state } = attempt;
  const error = attempt.error ?? attempt.finishError;
  const expired = (error instanceof ApiError && error.status === 401) || session.data === null;
  const blocked = attempt.finishing || leave.leaving || expired || Boolean(draft.candidate);
  return <StudentWorksShell beforeLeave={leave.request}>
    <StudentLeaveDialog open={leave.failed} decide={leave.decide} />
    {expired && principal.id && <StudentReauthenticate owner={principal.id} login={principal.login} onReady={attempt.retry} />}
    <Link className={styles.textButton} href="/student/works">К работам</Link>
    {reloadError && <p className={styles.error} role="alert">{apiErrorMessage(reloadError, 'Не удалось загрузить сохранённую работу. Изменения этой вкладки сохранены на экране.')}</p>}
    <div className={styles.heading}><div><h1>{initial.title}</h1><p>Версия {initial.versionNumber} · Заданий: {initial.taskCount}</p></div>
      {state.status !== 'completed' && <SaveStatus attempt={attempt} />}
    </div>
    {state.status === 'completed' ? <WorkResult result={state.result} /> : <>
      {initial.instructions && <details className={styles.workInstructions}><summary>Инструкция к работе</summary><p>{initial.instructions}</p></details>}
      {draft.candidate && <StudentDraftNotice draft={draft.candidate} work={initial} compatible={draft.compatible} restore={() => draft.restore(attempt.change)} discard={draft.discard} />}
      <SaveError error={error} onReload={onReload} retry={attempt.error ? attempt.retry : undefined} />
      <StudentWorkQuestions work={initial} answers={attempt.answers} disabled={blocked} onChange={attempt.change} requestedTask={requestedTask} />
      <div className={styles.finishBar}><span>Сохранено ответов: {state.answeredCount} из {initial.taskCount}</span><button className={styles.secondary} disabled={attempt.dirty || blocked} onClick={() => setReview(true)}>{attempt.finishing ? 'Завершаем…' : 'Завершить работу'}</button></div>
      <StudentFinishReview open={review} close={() => setReview(false)} work={initial} answers={attempt.answers} disabled={attempt.dirty || blocked} onTask={(id) => setRequestedTask((previous) => ({ id, request: (previous?.request ?? 0) + 1 }))} onFinish={() => void attempt.finish()} />
    </>}
  </StudentWorksShell>;
}

export default function StudentWorkScreen({ id }: { id: string }) {
  return <StudentWorkSession key={id} id={id} />;
}

function StudentWorkSession({ id }: { id: string }) {
  const query = useQuery({ queryKey: studentWorkQueryKeys.detail(id), queryFn: () => studentWorksApi.detail(id), staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: false, refetchOnReconnect: false });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (query.isSuccess && query.isFetchedAfterMount && !query.isFetching) setReady(true);
  }, [query.isSuccess, query.isFetchedAfterMount, query.isFetching]);
  const [generation, setGeneration] = useState(0);
  const start = useMutation({ mutationFn: () => studentWorksApi.start(id), onSuccess: () => query.refetch() });
  if (ready && query.data && query.data.status !== 'not_started') return <StudentWorkPlayer key={`${id}-${generation}`} initial={query.data} reloadError={query.error} onReload={() => { void query.refetch().then((result) => { if (!result.error) setGeneration((value) => value + 1); }); }} />;
  return <StudentWorksShell><Link href="/student/works" className={styles.textButton}>К работам</Link>
    {!ready && !query.error && <p role="status">Загружаем работу…</p>}
    {query.error && <div role="alert" className={styles.error}><p>{apiErrorMessage(query.error)}</p>{query.error instanceof ApiError && query.error.status === 401 ? <Link href={`/login?returnTo=${encodeURIComponent(`/student/works/${id}`)}`} className={styles.secondary}>Войти и вернуться</Link> : <button className={styles.secondary} onClick={() => void query.refetch()}>Повторить</button>}</div>}
    {ready && query.data && <section className={styles.intro} aria-labelledby="work-intro-title">
      <header className={styles.introHeading}><h1 id="work-intro-title">{query.data.title}</h1><p>Заданий: {query.data.taskCount}</p></header>
      <div className={styles.introBody}>
        {query.data.instructions && <p className={styles.introInstructions}>{query.data.instructions}</p>}
        <div className={styles.introNotes}><p id="work-start-note">Ответы сохраняются автоматически. Можно выйти и продолжить позже.</p><p>После завершения ответы изменить нельзя.</p></div>
        <div className={styles.introActions}><button className={styles.primary} aria-describedby="work-start-note" disabled={start.isPending} onClick={() => start.mutate()}>{start.isPending ? 'Начинаем…' : 'Начать работу'}</button></div>
      </div>
      {start.error && <p role="alert" className={styles.error}>{apiErrorMessage(start.error)}</p>}
    </section>}
  </StudentWorksShell>;
}
