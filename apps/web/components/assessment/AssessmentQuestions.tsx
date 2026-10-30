"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react';
import type { AssessmentAnswer, PublicAssessmentItem } from '@continuum/shared';
import AssessmentQuestion from './AssessmentQuestion';
import styles from './assessment-questions.module.css';

export function assessmentAnswerState(item: PublicAssessmentItem, answer?: AssessmentAnswer): 'empty' | 'partial' | 'filled' {
  if (!answer || answer.type !== item.type) return 'empty';
  switch (answer.type) {
    case 'short_number': case 'short_text': return answer.value.trim() ? 'filled' : 'empty';
    case 'single_choice': return answer.optionId ? 'filled' : 'empty';
    case 'multiple_choice': return answer.optionIds.length ? 'filled' : 'empty';
    case 'matching': {
      if (item.type !== 'matching') return 'empty';
      const count = item.rows.filter((row) => Boolean(answer.matches[row.id])).length;
      return count === item.rows.length ? 'filled' : count ? 'partial' : 'empty';
    }
  }
}
const stateLabels = { empty: 'без ответа', partial: 'частично', filled: 'есть ответ' };

export default function AssessmentQuestions({ items, answers, activeId, onSelect, onChange, disabled = false, automaticCompleted = false, photoTaskIds = [], renderExtended, renderFeedback, focusRequest }: {
  items: PublicAssessmentItem[]; answers: Record<string, AssessmentAnswer>; activeId: string;
  onSelect: (id: string) => void; onChange: (id: string, answer: AssessmentAnswer) => void;
  disabled?: boolean; automaticCompleted?: boolean; photoTaskIds?: string[];
  renderExtended?: (id: string) => ReactNode; renderFeedback?: (id: string) => ReactNode; focusRequest?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const numbers = useRef<HTMLElement>(null);
  const uid = useId();
  const index = Math.max(0, items.findIndex((item) => item.id === activeId));
  const item = items[index];
  useEffect(() => {
    setExpanded(false);
    title.current?.focus();
    numbers.current?.querySelector<HTMLElement>('[aria-current]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [activeId, focusRequest]);
  function select(id: string) { setExpanded(false); onSelect(id); }
  if (!item) return <p role="alert">В работе нет заданий.</p>;
  return <div className={styles.workspace}>
    <aside className={styles.taskNavigator} aria-label="Навигация по заданиям">
      <h2 className={styles.navigatorTitle}>Задания</h2>
      <button className={styles.navigatorToggle} aria-expanded={expanded} aria-controls={`task-numbers-${uid}`} onClick={() => setExpanded(!expanded)}>Задания · {index + 1} из {items.length}<ChevronDown size={18} aria-hidden="true" /></button>
      <div id={`task-numbers-${uid}`} className={`${styles.navigatorBody} ${expanded ? styles.navigatorExpanded : ''}`}>
        <nav ref={numbers} aria-label="Номера заданий" className={styles.taskNumbers}>{items.map((task, number) => {
          const state = task.type === 'extended' ? photoTaskIds.includes(task.id) ? 'filled' : 'empty' : assessmentAnswerState(task, answers[task.id]);
          return <button key={task.id} disabled={disabled} data-state={state} aria-label={`Задание ${number + 1}: ${stateLabels[state]}`} aria-current={task.id === item.id ? 'step' : undefined} onClick={() => select(task.id)}>{number + 1}</button>;
        })}</nav>
        <div className={styles.numberLegend}><span><i data-state="filled" />Есть ответ</span><span><i data-state="empty" />Без ответа</span><span><i data-state="partial" />Частично</span></div>
      </div>
    </aside>
    <section className={styles.questionPane} aria-labelledby={`question-title-${uid}`}>
      <p className={styles.questionPosition}>Задание {index + 1} из {items.length}</p>
      <AssessmentQuestion item={item} answer={answers[item.id]} position={index + 1} headingId={`question-title-${uid}`} headingRef={title} disabled={disabled || (automaticCompleted && item.type !== 'extended')} onChange={answer => onChange(item.id, answer)} renderExtended={renderExtended} />
      {renderFeedback?.(item.id)}
      <div className={styles.questionActions}>
        <button className={styles.secondary} disabled={disabled || index === 0} onClick={() => select(items[index - 1].id)}><ArrowLeft size={16} aria-hidden="true" />Назад</button>
        <button className={styles.primary} disabled={disabled || index === items.length - 1} onClick={() => select(items[index + 1].id)}>Далее<ArrowRight size={16} aria-hidden="true" /></button>
      </div>
    </section>
  </div>;
}
