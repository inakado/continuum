"use client";
import { useMutation } from '@tanstack/react-query';
import type { AssessmentWorkAnswerCheck } from '@continuum/shared';
import { teacherWorksApi } from './teacher-works.api';
import { apiErrorMessage } from '@/lib/api/error-message';
import styles from './teacher-works.module.css';

export default function WorkPreviewAnswerCheck({ workId, input, disabled }: { workId: string; input: AssessmentWorkAnswerCheck; disabled: boolean }) {
  const check = useMutation({ mutationFn: (body: AssessmentWorkAnswerCheck) => teacherWorksApi.checkAnswer(workId, body), retry: false, networkMode: 'always' });
  const current = JSON.stringify(check.variables) === JSON.stringify(input);
  return <div className={styles.trialCheck}>
    <button type="button" className={styles.secondary} disabled={disabled || check.isPending} onClick={() => check.mutate(input)}>{check.isPending ? 'Проверяем…' : 'Проверить ответ'}</button>
    {disabled && <p className={styles.previewNote}>Дождитесь сохранения работы, чтобы проверить ответ.</p>}
    {!disabled && current && check.isSuccess && <p role="status" data-score={check.data.points === check.data.maxPoints ? 'correct' : check.data.points > 0 ? 'partial' : 'incorrect'}>Баллы: {check.data.points} из {check.data.maxPoints}</p>}
    {!disabled && current && check.isError && <p role="alert" className={styles.error}>{apiErrorMessage(check.error, 'Не удалось проверить ответ. Повторите попытку.')}</p>}
  </div>;
}
