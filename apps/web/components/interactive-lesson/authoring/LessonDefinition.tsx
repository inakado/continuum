import type { ReactNode } from 'react';
import { LessonInlineMath } from './LessonEquation';
import styles from './lesson-theory.module.css';

export default function LessonDefinition({ id, title, notation = '', description, children }: {
  id: string; title: string; notation?: string; description: ReactNode; children?: ReactNode;
}) {
  return <section className={styles.definition} aria-labelledby={id}>
    <div className={styles.definitionLead}>
      <h3 id={id}>{title}</h3>{' '}
      {notation && <><LessonInlineMath tex={String.raw`\equiv ${notation}`} />{' '}</>}— {description}
    </div>
    {children}
  </section>;
}
