"use client";
import type { ReactNode, RefObject } from 'react';
import type { AssessmentAnswer, PublicAssessmentItem } from '@continuum/shared';
import AssessmentMarkdown from './AssessmentMarkdown';
import AssessmentAnswerInput from './AssessmentAnswerInput';
import styles from './assessment-questions.module.css';

export default function AssessmentQuestion({ item, answer, position, headingId, headingRef, disabled, onChange, renderExtended }: {
  item: PublicAssessmentItem; answer?: AssessmentAnswer; position: number; headingId: string; headingRef: RefObject<HTMLHeadingElement | null>; disabled: boolean;
  onChange: (answer: AssessmentAnswer) => void; renderExtended?: (id: string) => ReactNode;
}) {
  return <fieldset className={styles.questions} disabled={disabled}>
    <legend className={styles.srOnly}>Ответ на задание {position}</legend>
    <article><h2 id={headingId} ref={headingRef} tabIndex={-1}>{item.title}</h2>
      <AssessmentMarkdown text={item.statement} images={item.images} />
      {item.type === 'extended' ? renderExtended?.(item.id) : <AssessmentAnswerInput item={item} answer={answer} onChange={onChange} />}
    </article>
  </fieldset>;
}
