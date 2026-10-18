"use client";
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AssessmentAnswer, PublicAssessmentItem, StudentWorkDetail, SolutionAnswer } from '@continuum/shared';
import AssessmentMarkdown from '@/components/assessment/AssessmentMarkdown';
import StudentAnswerInput from './StudentAnswerInput';
import styles from './student-works.module.css';

export function studentAnswerState(item: PublicAssessmentItem, answer?: AssessmentAnswer): 'empty' | 'partial' | 'filled' {
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

export default function StudentWorkQuestions({ work, answers, disabled, onChange, requestedTask, solutions = [], renderExtended, automaticCompleted = false }: {
  work: StudentWorkDetail; answers: StudentWorkDetail['answers']; disabled: boolean;
  onChange: (id: string, answer: AssessmentAnswer) => void;
  requestedTask?: { id: string; request: number };
  solutions?: SolutionAnswer[]; renderExtended?: (id: string) => ReactNode; automaticCompleted?: boolean;
}) {
  const [activeId, setActiveId] = useState(work.items[0]?.id ?? '');
  const [expanded, setExpanded] = useState(false);
  const title = useRef<HTMLHeadingElement>(null);
  const numbers = useRef<HTMLElement>(null);
  const positionKey = `continuum:work-position:${work.id}`;
  useEffect(() => {
    try {
      const id = sessionStorage.getItem(positionKey);
      if (work.items.some((item) => item.id === id)) setActiveId(id!);
    } catch { /* Navigation still works when browser storage is unavailable. */ }
  }, [positionKey, work.items]);
  useEffect(() => {
    if (!requestedTask || !work.items.some((item) => item.id === requestedTask.id)) return;
    setActiveId(requestedTask.id); setExpanded(false);
    try { sessionStorage.setItem(positionKey, requestedTask.id); } catch { /* Position is optional. */ }
    const frame = requestAnimationFrame(() => title.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [positionKey, requestedTask, work.items]);
  useEffect(() => {
    title.current?.focus();
    numbers.current?.querySelector<HTMLElement>('[aria-current]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [activeId]);
  function select(id: string) {
    setActiveId(id); setExpanded(false);
    try { sessionStorage.setItem(positionKey, id); } catch { /* Position is optional; answers are saved by the attempt hook. */ }
  }
  const index = Math.max(0, work.items.findIndex((item) => item.id === activeId));
  const item = work.items[index];
  if (!item) return <p role="alert">В работе нет заданий.</p>;
  return <div className={styles.workspace}>
    <aside className={styles.taskNavigator} aria-label="Навигация по заданиям">
      <h2 className={styles.navigatorTitle}>Задания</h2>
      <button className={styles.navigatorToggle} aria-expanded={expanded} aria-controls="student-task-numbers" onClick={() => setExpanded(!expanded)}>Задания · {index + 1} из {work.taskCount}<ChevronDown size={18} aria-hidden="true" /></button>
      <div id="student-task-numbers" className={`${styles.navigatorBody} ${expanded ? styles.navigatorExpanded : ''}`}>
        <nav ref={numbers} aria-label="Номера заданий" className={styles.taskNumbers}>{work.items.map((task, number) => {
          const state = task.type === 'extended' ? solutions.find((answer) => answer.taskId === task.id)?.photos.length ? 'filled' : 'empty' : studentAnswerState(task, answers[task.id]);
          return <button key={task.id} disabled={disabled} data-state={state} aria-label={`Задание ${number + 1}: ${stateLabels[state]}`} aria-current={task.id === item.id ? 'step' : undefined} onClick={() => select(task.id)}>{number + 1}</button>;
        })}</nav>
        <div className={styles.numberLegend}><span><i data-state="filled" />Есть ответ</span><span><i data-state="empty" />Без ответа</span><span><i data-state="partial" />Частично</span></div>
      </div>
    </aside>
    <section className={styles.questionPane} aria-labelledby="student-question-title">
      <p className={styles.questionPosition}>Задание {index + 1} из {work.taskCount}</p>
      <fieldset className={styles.questions} disabled={disabled || (automaticCompleted && item.type !== 'extended')}>
        <legend className={styles.srOnly}>Ответ на задание {index + 1}</legend>
        <article><h2 id="student-question-title" ref={title} tabIndex={-1}>{item.title}</h2>
          <AssessmentMarkdown text={item.statement} images={item.images} />
          {item.type === 'extended' ? renderExtended?.(item.id) : <StudentAnswerInput item={item} answer={answers[item.id]} onChange={(answer) => onChange(item.id, answer)} />}
        </article>
      </fieldset>
      <div className={styles.questionActions}>
        <button className={styles.secondary} disabled={disabled || index === 0} onClick={() => select(work.items[index - 1].id)}><ArrowLeft size={16} aria-hidden="true" />Назад</button>
        <button className={styles.primary} disabled={disabled || index === work.items.length - 1} onClick={() => select(work.items[index + 1].id)}>Далее<ArrowRight size={16} aria-hidden="true" /></button>
      </div>
    </section>
  </div>;
}
