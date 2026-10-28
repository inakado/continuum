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
import StudentSolutionUpload from './StudentSolutionUpload';
import { useSolutionPhotos } from './use-solution-photos';
import type { StudentSolutionPhotos } from './use-solution-photos';
import StudentPhotoFeedback from './StudentPhotoFeedback';
import StudentWorkUnavailable from './StudentWorkUnavailable';
import { isWorkUnavailable, useWorkAvailability } from './use-work-availability';
import styles from './student-works.module.css';
import { useConfirmation } from '@/components/ui/useConfirmation';

function SaveStatus({ attempt }: { attempt: ReturnType<typeof useStudentAttempt> }) {
  const text = !attempt.online ? 'Нет сети' : attempt.error ? 'Не сохранено' : attempt.saving ? 'Сохраняем…' : attempt.dirty ? 'Есть изменения' : 'Сохранено';
  return <span role="status" className={styles.muted}>{text}</span>;
}

function PlayerStatus({ attempt, photos, onPhotos }: { attempt: ReturnType<typeof useStudentAttempt>; photos: StudentSolutionPhotos; onPhotos: (id: string) => void }) {
  if (photos.error && photos.pendingTaskId) return <button className={styles.textButton} onClick={() => onPhotos(photos.pendingTaskId!)}>Решение не сохранено · К задаче</button>;
  if (photos.busy || photos.error || photos.readError) return <span role="status" className={styles.muted}>{photos.busy ? 'Загружаем фото…' : 'Не удалось обновить фото'}</span>;
  return attempt.state.status !== 'completed' ? <SaveStatus attempt={attempt} /> : null;
}

function FinishBar({ attempt, count, mixed, disabled, open }: { attempt: ReturnType<typeof useStudentAttempt>; count: number; mixed: boolean; disabled: boolean; open: () => void }) {
  if (!count || attempt.state.status === 'completed') return null;
  return <div className={styles.finishBar}><span>Сохранено ответов: {attempt.state.answeredCount} из {count}</span><button className={styles.secondary} disabled={disabled} onClick={open}>{attempt.finishing ? 'Завершаем…' : mixed ? 'Завершить тестовую часть' : 'Завершить работу'}</button></div>;
}

function SaveError({ error, onReload, retry }: { error: Error | null; onReload: () => Promise<void>; retry?: () => void }) {
  const confirmation = useConfirmation();
  if (!error) return null;
  const conflict = error instanceof ApiError && error.status === 409;
  return <div className={styles.error} role="alert"><p>{apiErrorMessage(error, 'Не удалось подтвердить сохранение. Проверьте соединение и повторите попытку.')}</p>
    {conflict ? <button className={styles.secondary} onClick={() => confirmation.ask({ title: 'Загрузить сохранённые ответы?', description: 'Несохранённые изменения этой вкладки будут заменены ответами с сервера.', confirmText: 'Загрузить ответы', destructive: true }, onReload)}>Загрузить сохранённую работу</button> : retry ? <button className={styles.secondary} onClick={retry}>Повторить сохранение</button> : null}
    {confirmation.dialog}
  </div>;
}

function WorkResult({ result, mixed = false }: { result: StudentWorkDetail['result']; mixed?: boolean }) {
  return <div className={styles.result}><h2>{mixed ? 'Тестовая часть завершена' : 'Работа завершена'}</h2>{!result?.partialCount && <p>Верно: {result?.correctCount} · Неверно: {result?.incorrectCount}</p>}{result?.points !== undefined && result.maxPoints !== undefined && <p data-score={result.points === result.maxPoints ? 'correct' : result.points > 0 ? 'partial' : 'incorrect'}>Баллы: {result.points} из {result.maxPoints}</p>}{!mixed && <Link className={styles.textButton} href="/student/works">К списку работ</Link>}</div>;
}

function StudentWorkPlayer({ initial, onReload, reloadError, onUnavailable, entry }: { initial: StudentWorkDetail; onReload: () => Promise<void>; reloadError: Error | null; onUnavailable: () => void; entry?: 'solutions' | 'result' }) {
  const attempt = useStudentAttempt(initial);
  const hasExtended = initial.items.some((item) => item.type === 'extended');
  const automaticCount = initial.items.filter((item) => item.type !== 'extended').length;
  const photos = useSolutionPhotos(initial.id, hasExtended);
  const [review, setReview] = useState(false);
  const [requestedTask, setRequestedTask] = useState<{ id: string; request: number }>();
  const session = useAuthSession();
  const [principal] = useState(() => session.data?.user ?? { id: '', login: '' });
  const draft = useAnswerDraft(principal.id, initial, attempt.answers, attempt.saved, attempt.state.status === 'completed');
  const leave = useStudentLeave(attempt.dirty || photos.dirty, async () => (await attempt.flush()) && (await photos.flush()), () => { draft.discard(); attempt.discard(); photos.discard(); });
  const { state } = attempt;
  const error = attempt.error ?? attempt.finishError ?? photos.error ?? photos.readError;
  useEffect(() => { if (isWorkUnavailable(error)) onUnavailable(); }, [error, onUnavailable]);
  const expired = (error instanceof ApiError && error.status === 401) || session.data === null;
  const blocked = attempt.finishing || leave.leaving || expired || Boolean(draft.candidate);
  return <StudentWorksShell beforeLeave={leave.request}>
    <StudentLeaveDialog open={leave.failed} decide={leave.decide} />
    {expired && principal.id && <StudentReauthenticate owner={principal.id} login={principal.login} onReady={() => { attempt.retry(); void photos.retry(); }} />}
    <Link className={styles.textButton} href="/student/works">К работам</Link>
    {reloadError && <p className={styles.error} role="alert">{apiErrorMessage(reloadError, 'Не удалось загрузить сохранённую работу. Изменения этой вкладки сохранены на экране.')}</p>}
    <div className={styles.heading}><div><h1>{initial.title}</h1><p>Версия {initial.versionNumber} · Заданий: {initial.taskCount}</p></div>
      <PlayerStatus attempt={attempt} photos={photos} onPhotos={(id) => setRequestedTask((previous) => ({ id, request: (previous?.request ?? 0) + 1 }))} />
    </div>
    {state.status === 'completed' && !hasExtended ? <WorkResult result={state.result} /> : <>
      {state.status === 'completed' && <WorkResult result={state.result} mixed />}
      {initial.instructions && <details className={styles.workInstructions}><summary>Инструкция к работе</summary><p>{initial.instructions}</p></details>}
      {draft.candidate && <StudentDraftNotice draft={draft.candidate} work={initial} compatible={draft.compatible} restore={() => draft.restore(attempt.change)} discard={draft.discard} />}
      <SaveError error={attempt.error ?? attempt.finishError} onReload={onReload} retry={attempt.error ? attempt.retry : undefined} />
      <StudentPhotoFeedback photos={photos} />
      <StudentWorkQuestions work={initial} answers={attempt.answers} disabled={blocked || photos.busy} onChange={attempt.change} requestedTask={requestedTask} solutions={photos.answers} entry={entry} solutionsLoading={!photos.ready} automaticCompleted={state.status === 'completed'} renderExtended={(id) => <StudentSolutionUpload key={id} taskId={id} controller={photos} disabled={blocked} />} />
      <FinishBar attempt={attempt} count={automaticCount} mixed={hasExtended} disabled={attempt.dirty || blocked || photos.dirty} open={() => setReview(true)} />
      <StudentFinishReview open={review} close={() => setReview(false)} work={initial} answers={attempt.answers} disabled={attempt.dirty || blocked} onTask={(id) => setRequestedTask((previous) => ({ id, request: (previous?.request ?? 0) + 1 }))} onFinish={() => void attempt.finish()} />
    </>}
  </StudentWorksShell>;
}

export default function StudentWorkScreen({ id, entry }: { id: string; entry?: 'solutions' | 'result' }) {
  return <StudentWorkSession key={id} id={id} entry={entry} />;
}

function StudentWorkSession({ id, entry }: { id: string; entry?: 'solutions' | 'result' }) {
  const availability = useWorkAvailability(id);
  const query = useQuery({ queryKey: studentWorkQueryKeys.detail(id), queryFn: () => studentWorksApi.detail(id), enabled: !availability.unavailable, staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: false, refetchOnReconnect: false });
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (query.isSuccess && query.isFetchedAfterMount && !query.isFetching) setReady(true);
  }, [query.isSuccess, query.isFetchedAfterMount, query.isFetching]);
  const [generation, setGeneration] = useState(0);
  const start = useMutation({ mutationFn: () => studentWorksApi.start(id), onSuccess: () => query.refetch() });
  useEffect(() => { if (isWorkUnavailable(query.error) || isWorkUnavailable(start.error)) availability.markUnavailable(); }, [query.error, start.error, availability.markUnavailable]);
  if (availability.unavailable || isWorkUnavailable(query.error) || isWorkUnavailable(start.error)) return <StudentWorkUnavailable id={id} />;
  if (ready && query.data && query.data.status !== 'not_started') return <StudentWorkPlayer key={`${id}-${generation}`} initial={query.data} entry={entry} reloadError={query.error} onUnavailable={availability.markUnavailable} onReload={async () => { const result = await query.refetch(); if (result.error) throw result.error; setGeneration((value) => value + 1); }} />;
  return <StudentWorksShell><Link href="/student/works" className={styles.textButton}>К работам</Link>
    {!ready && !query.error && <p role="status">Загружаем работу…</p>}
    {query.error && <div role="alert" className={styles.error}><p>{apiErrorMessage(query.error)}</p>{query.error instanceof ApiError && query.error.status === 401 ? <Link href={`/login?returnTo=${encodeURIComponent(`/student/works/${id}`)}`} className={styles.secondary}>Войти и вернуться</Link> : <button className={styles.secondary} onClick={() => void query.refetch()}>Повторить</button>}</div>}
    {ready && query.data && <section className={styles.intro} aria-labelledby="work-intro-title">
      <header className={styles.introHeading}><h1 id="work-intro-title">{query.data.title}</h1><p>Заданий: {query.data.taskCount}</p></header>
      <div className={styles.introBody}>
        {query.data.instructions && <p className={styles.introInstructions}>{query.data.instructions}</p>}
        <div className={styles.introNotes}><p id="work-start-note">Ответы сохраняются автоматически. Можно выйти и продолжить позже.</p><p>{query.data.items.some((item) => item.type === 'extended') ? 'Фотографии решений можно добавлять постепенно. До проверки их можно заменить.' : 'После завершения ответы изменить нельзя.'}</p></div>
        <div className={styles.introActions}><button className={styles.primary} aria-describedby="work-start-note" disabled={start.isPending} onClick={() => start.mutate()}>{start.isPending ? 'Начинаем…' : 'Начать работу'}</button></div>
      </div>
      {start.error && <p role="alert" className={styles.error}>{apiErrorMessage(start.error)}</p>}
    </section>}
  </StudentWorksShell>;
}
