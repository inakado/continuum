"use client";
import type { StudentWorkDetail } from '@continuum/shared';
import type { AnswerDraft } from '@/lib/assessment/answer-draft';
import { matchingPositionLabel } from '@/lib/assessment/matching-position';
import styles from './student-works.module.css';

export default function StudentDraftNotice({ draft, work, compatible, restore, discard }: { draft: AnswerDraft; work: StudentWorkDetail; compatible: boolean; restore: () => void; discard: () => void }) {
  return <section className={styles.draftNotice} aria-label="Локальный черновик">
    <p>{compatible ? 'На этом устройстве остались несохранённые ответы.' : 'Ответы на сервере изменились. Черновик не будет применён автоматически.'}</p>
    <details><summary>Показать черновик</summary><ol>{work.items.map((item, index) => {
      if (!(item.id in draft.answers) && !(item.id in draft.base)) return null;
      const answer = draft.answers[item.id];
      const optionNumber = (id: string) => 'options' in item ? item.options.findIndex((option) => option.id === id) + 1 : id;
      let value = 'Без ответа';
      if (answer?.type === 'short_number' || answer?.type === 'short_text') value = answer.value || value;
      if (answer?.type === 'single_choice' && answer.optionId) value = `Вариант ${optionNumber(answer.optionId)}`;
      if (answer?.type === 'multiple_choice' && answer.optionIds.length) value = `Варианты: ${answer.optionIds.map(optionNumber).join(', ')}`;
      if (answer?.type === 'matching' && item.type === 'matching') value = item.rows.map((row, number) => `${matchingPositionLabel(number)} — ${answer.matches[row.id] ? optionNumber(answer.matches[row.id]) : 'нет ответа'}`).join('; ');
      return <li key={item.id} value={index + 1}>{item.title}: {value}</li>;
    })}</ol></details>
    <div className={styles.dialogActions}>{compatible && <button className={styles.secondary} onClick={restore}>Восстановить ответы</button>}<button className={styles.textButton} onClick={discard}>Удалить черновик</button></div>
  </section>;
}
