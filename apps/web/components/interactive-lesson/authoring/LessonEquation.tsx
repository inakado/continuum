import type { ReactNode } from 'react';
import { AssessmentFormula } from '@/components/assessment/AssessmentMarkdown';
import styles from './lesson-theory.module.css';

export function EquationReference({ equation, number }: { equation: string; number: number }) {
  return <a className={styles.reference} href={`#${equation}`}>({number})</a>;
}

export function NumberedEquation({ equation, number, children }: { equation: string; number: number; children: ReactNode }) {
  return <div id={equation} className={styles.numberedEquation} data-equation-number={number}>
    <div className={styles.equationContent}>{children}</div>
    <span className={styles.equationNumber} aria-label={`Формула ${number}`}>({number})</span>
  </div>;
}

export function LessonInlineMath({ tex }: { tex: string }) {
  return <AssessmentFormula value={tex} display={false} />;
}

export default function LessonEquation({ parts, framed = false, equation, number, label }: {
  parts: readonly (string | readonly string[])[]; framed?: boolean; equation?: string; number?: number; label?: string;
}) {
  const content = <div className={`${styles.equations}${framed ? ` ${styles.important}` : ''}`} aria-label={label}>
    {parts.map((part, i) => <span className={styles.equationPart} key={`${i}-${part}`}>
      {(typeof part === 'string' ? [part] : part).map((tex, j) => <span className={styles.equationTerm} key={`${j}-${tex}`}><AssessmentFormula value={String.raw`\displaystyle ${tex}`} display={false} /></span>)}
    </span>)}
  </div>;
  if (equation) {
    if (typeof number !== 'number' || !Number.isInteger(number) || number < 1) throw new Error(`Не задан номер формулы ${equation}`);
    return <NumberedEquation equation={equation} number={number}>{content}</NumberedEquation>;
  }
  return content;
}
