"use client";
import type { ComponentProps } from 'react';
import { Check, Minus, X } from 'lucide-react';
import type { PublicAssessmentItem, StudentAnswerKey } from '@continuum/shared';
import AssessmentQuestion from '@/components/assessment/AssessmentQuestion';
import AssessmentAnswerInput from '@/components/assessment/AssessmentAnswerInput';
import AssessmentMarkdown from '@/components/assessment/AssessmentMarkdown';
import question from '@/components/assessment/assessment-questions.module.css';
import { matchingPositionLabel } from '@/lib/assessment/matching-position';
import styles from './student-reviewed-question.module.css';

type Props = ComponentProps<typeof AssessmentQuestion> & {
  answerKey: StudentAnswerKey;
  score: { points: number; maxPoints: number };
};
function correctAnswer(item: PublicAssessmentItem, key: StudentAnswerKey) {
  const position = (id: string) => 'options' in item ? String(item.options.findIndex(option => option.id === id) + 1) : '';
  switch (key.type) {
    case 'short_number': return key.value.replace('.', ',').replace(/^-/, '−');
    case 'short_text': return key.value;
    case 'single_choice': return position(key.optionId);
    case 'multiple_choice': return 'options' in item ? item.options.filter(option => key.optionIds.includes(option.id)).map(option => position(option.id)).join(', ') : '';
    case 'matching': return item.type === 'matching' ? item.rows.map((row, index) => `${matchingPositionLabel(index)} — ${position(key.matches[row.id])}`).join(', ') : '';
  }
}
function hasAnswer(answer: Props['answer']) {
  if (!answer) return false;
  switch (answer.type) {
    case 'short_number': case 'short_text': return Boolean(answer.value.trim());
    case 'single_choice': return Boolean(answer.optionId);
    case 'multiple_choice': return answer.optionIds.length > 0;
    case 'matching': return Object.keys(answer.matches).length > 0;
  }
}
export default function StudentReviewedQuestion(props: Props) {
  const { item, answer, answerKey, score, position, headingId, headingRef } = props;
  if (item.type !== answerKey.type) return <AssessmentQuestion {...props} disabled />;
  const tone = score.points === score.maxPoints ? 'correct' : score.points === 0 ? 'incorrect' : 'partial';
  const label = tone === 'correct' ? 'Верно' : tone === 'partial' ? 'Частично верно' : hasAnswer(answer) ? 'Неверно' : 'Нет ответа';
  const Icon = tone === 'correct' ? Check : tone === 'partial' ? Minus : X;
  const keys = answerKey.type === 'single_choice' ? [answerKey.optionId] : answerKey.type === 'multiple_choice' ? answerKey.optionIds : [];
  return <div className={styles.reviewed} data-tone={tone}>
    <fieldset className={question.questions} disabled><legend className={question.srOnly}>Ответ на задание {position}</legend>
      <article><h2 id={headingId} ref={headingRef} tabIndex={-1}>{item.title}</h2>
        <AssessmentMarkdown text={item.statement} images={item.images} />
        {item.type === 'single_choice' || item.type === 'multiple_choice' ? <div className={question.choices}>{item.options.map((option, index) => {
          const selected = answer?.type === 'single_choice' ? answer.optionId === option.id : answer?.type === 'multiple_choice' && answer.optionIds.includes(option.id);
          const correct = keys.includes(option.id);
          return <label key={option.id} className={styles.choice} data-choice={correct ? 'correct' : selected ? 'incorrect' : undefined}>
            <span className={question.choiceControl}><input type={item.type === 'single_choice' ? 'radio' : 'checkbox'} name={item.id} aria-label={`Вариант ${index + 1}: ${item.title}`} checked={Boolean(selected)} readOnly /></span>
            <span className={question.optionNumber}>{index + 1}</span><AssessmentMarkdown text={option.content} images={item.images} />
            {(correct || selected) && <span className={styles.choiceResult} role="img" aria-label={correct ? 'Верный вариант' : 'Неверный вариант'}>{correct ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}</span>}
          </label>;
        })}</div> : item.type === 'short_number' || item.type === 'short_text' ? <label className={question.shortAnswer}>Ответ<span className={question.answerValue}><input aria-label={`Ответ: ${item.title}`} value={answer?.type === item.type ? answer.value : ''} readOnly />{item.type === 'short_number' && item.unit && <span className={question.answerUnit}>{item.unit}</span>}</span></label> : <AssessmentAnswerInput item={item} answer={answer} onChange={props.onChange} />}
      </article>
    </fieldset>
    <div className={styles.feedback} role="group" aria-label={`Результат задания ${position}`}>
      <div className={styles.status}><span><Icon size={16} aria-hidden="true" />{label}</span><strong aria-label={`${score.points} из ${score.maxPoints} баллов`}>{score.points}<span> / {score.maxPoints}</span></strong></div>
      {tone !== 'correct' && <div className={styles.correctAnswer} data-stacked={(answerKey.type === 'short_text' && answerKey.value.length > 48) || (item.type === 'matching' && item.rows.length > 4)}><span>Правильный ответ</span><strong>{correctAnswer(item, answerKey)}{item.type === 'short_number' && item.unit && <small> {item.unit}</small>}</strong></div>}
    </div>
  </div>;
}
