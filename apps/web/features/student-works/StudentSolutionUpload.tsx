"use client";
import { useRef, useState } from 'react';
import { ImagePlus } from 'lucide-react';
import { solutionPhotoPolicy, type SolutionAnswer } from '@continuum/shared';
import SolutionPhotoList from '@/components/assessment/SolutionPhotoList';
import type { StudentSolutionPhotos } from './use-solution-photos';
import styles from './student-works.module.css';

export default function StudentSolutionUpload({ taskId, controller, disabled }: { taskId: string; controller: StudentSolutionPhotos; disabled: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const replaceId = useRef<string | undefined>(undefined);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const answer = controller.answers.find((item) => item.taskId === taskId);
  const blocked = disabled || controller.busy || controller.pending || controller.loading || !answer || answer.locked;
  function choose(files: File[], replacement?: string) {
    setError(''); setDragging(false);
    if (blocked || !files.length) return;
    if (files.some((file) => !solutionPhotoPolicy.contentTypes.some((type) => type === file.type))) { setError('Выберите фотографии в формате JPG, PNG или WebP.'); return; }
    if (files.some((file) => !file.size || file.size > solutionPhotoPolicy.maxBytes)) { setError('Каждая фотография должна быть не больше 10 МБ.'); return; }
    if ((answer?.photos.length ?? 0) + files.length - (replacement ? 1 : 0) > solutionPhotoPolicy.maxPhotos) { setError('Можно добавить не более 10 фотографий к задаче.'); return; }
    controller.add(taskId, files, replacement);
  }
  function picker(id?: string) { replaceId.current = id; if (input.current) { input.current.multiple = !id; input.current.click(); } }
  return <section className={styles.solutionUpload} aria-label="Фотографии решения">
    <div className={styles.solutionHeading}><h3>Ваше решение</h3><span>{answer?.locked ? 'Проверено' : answer?.photos.length ? 'Ожидает проверки' : 'Фото ещё не добавлены'}</span></div>
    <PublishedReview answer={answer} />
    {controller.loading && <p role="status">Загружаем фотографии…</p>}
    <input ref={input} type="file" aria-label="Выбрать фотографии решения" className={styles.srOnly} tabIndex={-1} accept="image/jpeg,image/png,image/webp" multiple disabled={blocked} onChange={(event) => { choose(Array.from(event.target.files ?? []), replaceId.current); event.target.value = ''; }} />
    {answer && <SolutionPhotoList photos={answer.photos} actions={answer.locked ? undefined : (id, index) => <>
      <button type="button" className={styles.textButton} disabled={blocked} aria-label={`Заменить фото ${index + 1}`} onClick={() => picker(id)}>Заменить</button>
      <button type="button" className={styles.textButton} disabled={blocked} aria-label={`Удалить фото ${index + 1}`} onClick={() => { if (window.confirm(`Удалить фото ${index + 1} из решения?`)) controller.remove(taskId, id); }}>Удалить</button>
    </>} />}
    {!answer?.locked && <>
      <div className={`${styles.photoDrop} ${dragging ? styles.photoDropActive : ''}`} aria-busy={controller.busy} onDragOver={(event) => { event.preventDefault(); if (!blocked) setDragging(true); }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={(event) => { event.preventDefault(); choose(Array.from(event.dataTransfer.files)); }}>
        <ImagePlus size={22} aria-hidden="true" /><div><button type="button" className={styles.textButton} disabled={blocked || answer?.photos.length === solutionPhotoPolicy.maxPhotos} onClick={() => picker()}>Добавить фото</button><span className={styles.dragHint}>или перетащите сюда</span><p>JPG, PNG или WebP · до 10 МБ · не более 10 фото</p></div>
      </div>
      <p className={styles.answerHint}>После загрузки фото сразу доступны преподавателю. До проверки их можно заменить.</p>
    </>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
  </section>;
}

function PublishedReview({ answer }: { answer: SolutionAnswer | undefined }) {
  if (!answer?.publishedReview) return null;
  return <div><p>{answer.publishedReview.points} из {answer.maxPoints} баллов</p><a className={styles.textButton} href={`${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000'}${answer.publishedReview.reportUrl}`} target="_blank" rel="noreferrer">Разбор решения · PDF</a></div>;
}
