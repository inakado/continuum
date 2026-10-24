"use client";
import { useState } from 'react';
import type { AssessmentAnswer, AssessmentWorkAnswerCheck, AssessmentWorkDetail, PublicAssessmentItem } from '@continuum/shared';
import AssessmentQuestions from '@/components/assessment/AssessmentQuestions';
import { teacherWorksApi } from './teacher-works.api';
import { apiErrorMessage } from '@/lib/api/error-message';
import { usePreviewPhotos } from './use-preview-photos';
import WorkPreviewPhotos from './WorkPreviewPhotos';
import WorkPreviewAnswerCheck from './WorkPreviewAnswerCheck';
import styles from './teacher-works.module.css';

function previewItem(item: AssessmentWorkDetail['items'][number]): PublicAssessmentItem {
  const task = item.task;
  const base = { id: item.id, title: task.title, statement: item.statement, images: item.images, maxPoints: task.maxPoints };
  switch (task.type) {
    case 'short_number': return { ...base, type: task.type, unit: task.unit };
    case 'short_text': case 'extended': return { ...base, type: task.type };
    case 'single_choice': case 'multiple_choice': return { ...base, type: task.type, options: task.options };
    case 'matching': return { ...base, type: task.type, options: task.options, rows: task.rows };
  }
}

function TrialQuestions({ items, workId, source, dirty }: { items: AssessmentWorkDetail['items']; workId: string; source: AssessmentWorkAnswerCheck['source']; dirty: boolean }) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? '');
  const [answers, setAnswers] = useState<Record<string, AssessmentAnswer>>({});
  const photos = usePreviewPhotos();
  return <AssessmentQuestions items={items.map(previewItem)} answers={answers} activeId={activeId} onSelect={setActiveId} onChange={(id, answer) => setAnswers((previous) => ({ ...previous, [id]: answer }))} photoTaskIds={Object.keys(photos.photos).filter((id) => photos.photos[id].length > 0)} renderExtended={(id) => <WorkPreviewPhotos key={id} photos={photos.photos[id] ?? []} onAdd={(files) => photos.add(id, files)} onRemove={(photoId) => photos.remove(id, photoId)} />} renderFeedback={(taskId) => items.find((item) => item.id === taskId)?.task.type !== 'extended' ? <WorkPreviewAnswerCheck key={taskId} workId={workId} input={{ taskId, source, answer: answers[taskId] ?? null }} disabled={dirty} /> : null} />;
}

export default function WorkPreview({ id, revision, items, dirty, readOnly = false, versionNumber }: { id: string; revision: number; items: AssessmentWorkDetail['items']; dirty: boolean; readOnly?: boolean; versionNumber?: number }) {
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
  return <div className={styles.preview}>
    <p className={styles.previewNote}><strong>Предпросмотр</strong> · Пробные ответы не сохраняются и не влияют на результаты учеников.</p>
    <TrialQuestions key={`${id}:${versionNumber ?? 'draft'}:${items.map((item) => `${item.id}:${item.version}`).join('|')}`} items={items} workId={id} source={versionNumber ? { kind: 'version', number: versionNumber } : { kind: 'draft', expectedRevision: revision }} dirty={dirty} />
    {!readOnly && <div className={styles.versionBar}>
      <button className={styles.secondary} disabled={dirty || freezing || !items.length} onClick={() => void freeze()}>{freezing ? 'Сохраняем версию…' : 'Сохранить версию'}</button>
      <span>{version ? `Сохранена версия ${version}` : 'Фиксирует текущие условия и порядок заданий'}</span>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </div>}
  </div>;
}
