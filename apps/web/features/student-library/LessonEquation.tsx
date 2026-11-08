import type { ComponentProps, ReactNode } from 'react';
import Equation, { EquationReference as Reference, NumberedEquation as Numbered } from '@/components/interactive-lesson/authoring/LessonEquation';
export { LessonInlineMath } from '@/components/interactive-lesson/authoring/LessonEquation';

// Нумерация относится к KIN-01; оформление формул — к общему authoring kit.
const equationNumbers = {
  'radius-vector-projections': 1,
  'radius-vector-basis': 2,
  'radius-vector-magnitude': 3,
  'radius-vector-cosines': 4,
  'coordinate-motion-law': 5,
  'vector-motion-law': 6,
  'initial-coordinates': 7,
  'initial-radius-vector': 8,
  'path-time-law': 9,
  'initial-path': 10,
  'path-nonnegative': 11,
  'path-nondecreasing': 12,
  'vector-triangle': 13,
  'displacement-difference': 14,
  'displacement-expansion': 15,
  'displacement-basis': 16,
  'displacement-projections': 17,
  'displacement-time-law': 18,
  'position-from-displacement': 19,
} as const;
type Equation = keyof typeof equationNumbers;

export function EquationReference({ equation }: { equation: Equation }) {
  return <Reference equation={equation} number={equationNumbers[equation]} />;
}
export function NumberedEquation({ equation, children }: { equation: Equation; children: ReactNode }) {
  return <Numbered equation={equation} number={equationNumbers[equation]}>{children}</Numbered>;
}
export default function LessonEquation(props: Omit<ComponentProps<typeof Equation>, 'equation' | 'number'> & { equation?: Equation }) {
  return <Equation {...props} number={props.equation ? equationNumbers[props.equation] : undefined} />;
}
