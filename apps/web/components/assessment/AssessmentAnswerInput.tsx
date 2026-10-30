"use client";
import type { AssessmentAnswer, PublicAssessmentItem } from '@continuum/shared';
import AssessmentMarkdown from '@/components/assessment/AssessmentMarkdown';
import { matchingPositionLabel, matchingPositionText } from '@/lib/assessment/matching-position';
import { ChevronDown } from 'lucide-react';
import styles from './assessment-questions.module.css';

export default function AssessmentAnswerInput({ item, answer, onChange }: { item: PublicAssessmentItem; answer?: AssessmentAnswer; onChange: (value: AssessmentAnswer) => void }) {
  if (item.type === 'extended') return null;
  if (item.type === 'short_number' || item.type === 'short_text') {
    const value = answer?.type === item.type ? answer.value : '';
    return <div><label className={styles.shortAnswer}>Ответ<span className={styles.answerValue}><input aria-label={`Ответ: ${item.title}`} aria-describedby={item.type === 'short_number' ? `number-format-${item.id}` : undefined} inputMode="text" autoCapitalize="off" autoComplete="off" spellCheck={false} maxLength={item.type === 'short_number' ? 64 : 5000} value={value} onChange={(event) => onChange({ type: item.type, value: event.target.value })} />{item.type === 'short_number' && item.unit && <span className={styles.answerUnit}>{item.unit}</span>}</span></label>{item.type === 'short_number' && <p id={`number-format-${item.id}`} className={styles.answerHint}>Можно использовать минус, запятую или точку.{item.unit ? ' Единицу измерения вводить не нужно.' : ''}</p>}</div>;
  }
  if (item.type === 'matching') {
    const matches = answer?.type === 'matching' ? answer.matches : {};
    return <div className={styles.matching}>
      <ol className={styles.options}>{item.options.map((option, index) => <li key={option.id}><span>{index + 1}</span><AssessmentMarkdown text={option.content} images={item.images} /></li>)}</ol>
      <div className={styles.matchingRows}>{item.rows.map((row, index) => <div key={row.id} className={styles.matchingRow}>
        <div><strong>{matchingPositionLabel(index)}</strong><AssessmentMarkdown text={matchingPositionText(row.content, index)} images={item.images} /></div>
        <label className={styles.matchingSelect}><span><select aria-label={`Ответ для ${matchingPositionLabel(index)}: ${item.title}`} value={matches[row.id] ?? ''} onChange={(event) => { const next = { ...matches }; if (event.target.value) next[row.id] = event.target.value; else delete next[row.id]; onChange({ type: 'matching', matches: next }); }}><option value="">Выберите</option>{item.options.map((option, optionIndex) => <option key={option.id} value={option.id}>{optionIndex + 1}</option>)}</select><ChevronDown size={16} aria-hidden="true" /></span></label>
      </div>)}</div>
    </div>;
  }
  return <div><div className={styles.choices}>{item.options.map((option, index) => {
    const checked = item.type === 'single_choice' ? answer?.type === 'single_choice' && answer.optionId === option.id : answer?.type === 'multiple_choice' && answer.optionIds.includes(option.id);
    return <label key={option.id}><span className={styles.choiceControl}><input type={item.type === 'single_choice' ? 'radio' : 'checkbox'} name={item.id} aria-label={`Вариант ${index + 1}: ${item.title}`} checked={checked} onChange={(event) => {
      if (item.type === 'single_choice') onChange({ type: 'single_choice', optionId: option.id });
      else { const current = answer?.type === 'multiple_choice' ? answer.optionIds : []; onChange({ type: 'multiple_choice', optionIds: event.target.checked ? [...current, option.id] : current.filter((id) => id !== option.id) }); }
    }} /></span><span className={styles.optionNumber}>{index + 1}</span><AssessmentMarkdown text={option.content} images={item.images} /></label>;
  })}</div>{item.type === 'single_choice' && answer?.type === 'single_choice' && answer.optionId && <button type="button" className={styles.textButton} onClick={() => onChange({ type: 'single_choice', optionId: null })}>Очистить ответ</button>}</div>;
}
