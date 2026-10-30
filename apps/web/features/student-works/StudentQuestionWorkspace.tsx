"use client";
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { AssessmentAnswer, StudentWorkDetail } from '@continuum/shared';
import AssessmentQuestion from '@/components/assessment/AssessmentQuestion';
import question from '@/components/assessment/assessment-questions.module.css';
import StudentTaskNavigation from './StudentTaskNavigation';
import { useStudentMobile } from './use-student-mobile';
import styles from './student-works.module.css';

export default function StudentQuestionWorkspace({ work, answers, activeId, onSelect, onChange, disabled, automaticCompleted, photoTaskIds, renderExtended, focusRequest }: {
  work: StudentWorkDetail; answers: StudentWorkDetail['answers']; activeId: string; onSelect: (id: string) => void; onChange: (id: string, answer: AssessmentAnswer) => void; disabled: boolean;
  automaticCompleted: boolean; photoTaskIds: string[]; renderExtended?: (id: string) => ReactNode; focusRequest?: number;
}) {
  const mobile = useStudentMobile();
  const index = Math.max(0, work.items.findIndex(item => item.id === activeId));
  const item = work.items[index];
  const title = useRef<HTMLHeadingElement>(null);
  const uid = useId();
  useEffect(() => { title.current?.focus({ preventScroll: true }); title.current?.scrollIntoView?.({ block: 'start' }); }, [activeId, focusRequest]);
  if (!item) return <p role="alert">В работе нет заданий.</p>;
  const navigation = <StudentTaskNavigation mobile={mobile} items={work.items} answers={answers} index={index} photoTaskIds={photoTaskIds} disabled={disabled} select={onSelect} heading={title} instructions={work.instructions} />;
  return <div className={`${question.workspace} ${styles.questionWorkspace}`}>
    {!mobile && navigation}
    <section className={question.questionPane} aria-labelledby={`question-title-${uid}`}>
      {!mobile && <p className={question.questionPosition}>Задание {index + 1} из {work.items.length}</p>}
      <AssessmentQuestion item={item} answer={answers[item.id]} position={index + 1} headingId={`question-title-${uid}`} headingRef={title} disabled={disabled || (automaticCompleted && item.type !== 'extended')} onChange={answer => onChange(item.id, answer)} renderExtended={renderExtended} />
      {!mobile && <div className={`${question.questionActions} ${styles.desktopQuestionActions}`}>
        <button className={styles.secondary} type="button" disabled={disabled || index === 0} onClick={() => onSelect(work.items[index - 1].id)}><ArrowLeft size={16} aria-hidden="true" />Назад</button>
        <button className={styles.primary} type="button" disabled={disabled || index === work.items.length - 1} onClick={() => onSelect(work.items[index + 1].id)}>Далее<ArrowRight size={16} aria-hidden="true" /></button>
      </div>}
    </section>
    {mobile && navigation}
  </div>;
}
