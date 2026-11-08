import type { ReactNode } from 'react';
import Equation, { EquationReference, LessonInlineMath, NumberedEquation } from '@/components/interactive-lesson/authoring/LessonEquation';
import styles from '@/components/interactive-lesson/authoring/lesson-theory.module.css';
import layout from './speed-content.module.css';

export type SpeedEquationNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23;
export const speedEquationId = (number: SpeedEquationNumber) => `kin02-equation-${number}`;

export function SpeedEquation({ number, parts, framed = false }: { number?: SpeedEquationNumber; parts: readonly (string | readonly string[])[]; framed?: boolean }) {
  return <Equation parts={parts} framed={framed} equation={number ? speedEquationId(number) : undefined} number={number} />;
}

export function SpeedNumberedEquation({ number, children }: { number: SpeedEquationNumber; children: ReactNode }) {
  return <NumberedEquation equation={speedEquationId(number)} number={number}>{children}</NumberedEquation>;
}

export function SpeedEquationReference({ number }: { number: SpeedEquationNumber }) {
  return <EquationReference equation={speedEquationId(number)} number={number} />;
}

type ReferencedPart = string | { terms: readonly string[] } | { tex: string; reference: SpeedEquationNumber } | { tex: string; above: readonly SpeedEquationNumber[] };

export function SpeedReferencedEquation({ number, parts }: { number: SpeedEquationNumber; parts: readonly ReferencedPart[] }) {
  return <SpeedNumberedEquation number={number}><div className={styles.equations}>
    {parts.map((part, index) => <span key={index} className={styles.equationPart}><span className={styles.equationTerm}>
      {typeof part === 'string' ? <LessonInlineMath tex={String.raw`\displaystyle ${part}`} />
        : 'terms' in part ? <span className={styles.equationPart}>{part.terms.map((tex, i) => <span key={i} className={styles.equationTerm}><LessonInlineMath tex={String.raw`\displaystyle ${tex}`} /></span>)}</span>
        : 'reference' in part ? <a className={layout.formulaLink} href={`#${speedEquationId(part.reference)}`} aria-label={`По формуле ${part.reference}`}><LessonInlineMath tex={String.raw`\displaystyle ${part.tex}`} /></a>
          : <span className={layout.annotatedTerm}>
            <span className={layout.annotations}>{part.above.map((reference, i) => <span key={reference}>{i > 0 && ', '}<a className={layout.formulaLink} href={`#${speedEquationId(reference)}`} aria-label={`По формуле ${reference}`}><LessonInlineMath tex={`(${reference})`} /></a></span>)}</span>
            <LessonInlineMath tex={String.raw`\displaystyle ${part.tex}`} />
          </span>}
    </span></span>)}
  </div></SpeedNumberedEquation>;
}

const demos = { average: 1, tangent: 2, path: 3, return: 4 } as const;
export function SpeedDemoReference({ kind }: { kind: keyof typeof demos }) {
  return <a href={`#kin02-${kind}-demo`} className={styles.reference}>дем. {demos[kind]}</a>;
}
