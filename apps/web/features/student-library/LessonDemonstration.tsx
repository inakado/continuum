import styles from '@/components/interactive-lesson/authoring/lesson-theory.module.css';

export const lessonDemonstrations = {
  reference: { number: 1, id: 'reference-frame-demo' },
  material: { number: 2, id: 'material-point-demo' },
  coordinates: { number: 3, id: 'coordinates-demo' },
  vector: { number: 4, id: 'radius-vector-demo' },
  trajectory: { number: 5, id: 'trajectory-demo' },
  moon: { number: 6, id: 'moon-trajectory-demo' },
  displacement: { number: 7, id: 'displacement-demo' },
} as const;
export type Demonstration = keyof typeof lessonDemonstrations;

export function DemoReference({ demo }: { demo: Demonstration }) {
  const { id, number } = lessonDemonstrations[demo];
  return <a className={styles.reference} href={`#${id}`}>дем. {number}</a>;
}

export function DemoNumber({ demo }: { demo: Demonstration }) {
  return <span className={styles.demoNumber} aria-label={`Демонстрация ${lessonDemonstrations[demo].number}`}>№ {lessonDemonstrations[demo].number}</span>;
}
