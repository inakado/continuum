"use client";
import { useEffect, useRef, useState, type RefObject } from 'react';
import { ArrowLeft, ArrowRight, Grid2X2, X } from 'lucide-react';
import type { AssessmentAnswer, PublicAssessmentItem, StudentWorkDetail } from '@continuum/shared';
import Dialog from '@/components/ui/Dialog';
import { assessmentAnswerState } from '@/components/assessment/AssessmentQuestions';
import question from '@/components/assessment/assessment-questions.module.css';
import styles from './student-works.module.css';

type Props = { taskResults?: StudentWorkDetail['taskResults']; mobile: boolean; instructions?: string | null; items: PublicAssessmentItem[]; answers: Record<string, AssessmentAnswer>; index: number; photoTaskIds: string[]; disabled: boolean; select: (id: string) => void; heading: RefObject<HTMLHeadingElement | null> };
const labels = { empty: 'без ответа', partial: 'частично', filled: 'есть ответ' };
export default function StudentTaskNavigation({ items, answers, index, photoTaskIds, disabled, select, heading, mobile, instructions, taskResults }: Props) {
  const [open, setOpen] = useState(false);
  const chosen = useRef(false);
  const list = useRef<HTMLElement>(null);
  useEffect(() => { setOpen(false); }, [mobile]);
  useEffect(() => { list.current?.querySelector<HTMLElement>('[aria-current]')?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }, [index, mobile, open]);
  const trigger = useRef<HTMLButtonElement>(null);
  function choose(id: string) { chosen.current = true; setOpen(false); select(id); }
  const numbers = <nav ref={list} aria-label="Номера заданий" className={`${question.taskNumbers} ${styles.numberGrid}`}>{items.map((item, number) => {
    const state = item.type === 'extended' ? photoTaskIds.includes(item.id) ? 'filled' : 'empty' : assessmentAnswerState(item, answers[item.id]);
    const label = item.type === 'extended' ? state === 'filled' ? 'есть фото' : 'без фото' : labels[state];
    const score = taskResults?.[item.id];
    const tone = score ? score.points === 0 ? 'incorrect' : score.points === score.maxPoints ? 'correct' : 'partial' : undefined;
    const resultLabel = score ? `${score.points} из ${score.maxPoints} баллов` : label;
    return <button type="button" key={item.id} disabled={disabled} data-state={state} data-score={tone} aria-label={`Задание ${number + 1}: ${resultLabel}`} aria-current={number === index ? 'step' : undefined} onClick={() => choose(item.id)}><span>{number + 1}</span>{score && <small aria-hidden="true">{score.points}/{score.maxPoints}</small>}</button>;
  })}</nav>;
  if (!mobile) return <aside className={question.taskNavigator} aria-label="Навигация по заданиям"><h2 className={question.navigatorTitle}>Задания</h2>{numbers}</aside>;
  return <>
    <nav className={styles.mobileTaskBar} aria-label="Переключение заданий">
      <button className={styles.textButton} type="button" disabled={disabled || index === 0} onClick={() => select(items[index - 1].id)}><ArrowLeft size={18} aria-hidden="true" />Назад</button>
      <button ref={trigger} className={styles.textButton} type="button" aria-label={`Задания · ${index + 1} из ${items.length}`} aria-haspopup="dialog" aria-expanded={open} onClick={() => { chosen.current = false; setOpen(true); }}><Grid2X2 size={18} aria-hidden="true" />{index + 1} из {items.length}</button>
      <button className={styles.textButton} type="button" disabled={disabled || index === items.length - 1} onClick={() => select(items[index + 1].id)}>Далее<ArrowRight size={18} aria-hidden="true" /></button>
    </nav>
    <Dialog open={open} onOpenChange={setOpen} title="Задания" className={styles.taskSheet} onCloseAutoFocus={event => { event.preventDefault(); if (chosen.current) { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView?.({ block: 'start' }); } else trigger.current?.focus({ preventScroll: true }); }}>
      <button className={styles.sheetClose} type="button" aria-label="Закрыть список заданий" onClick={() => setOpen(false)}><X size={22} aria-hidden="true" /></button>
      <div className={styles.taskMapBody}>{numbers}
      {instructions && <details className={styles.workInstructions}><summary>Инструкция к работе</summary><p>{instructions}</p></details>}</div>
    </Dialog>
  </>;
}
