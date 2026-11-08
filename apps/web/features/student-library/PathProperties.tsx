import LessonEquation from './LessonEquation';
import styles from '@/components/interactive-lesson/authoring/lesson-theory.module.css';

export default function PathProperties() {
  return <>
    <p>Из определения пути как длины участка траектории следуют его свойства.</p>
    <section className={styles.rule} aria-labelledby="path-properties-title">
      <h3 id="path-properties-title">Свойства пути</h3>
      <ol className={styles.ruleList}>
        <li><p>В начальный момент путь равен нулю:</p><LessonEquation equation="initial-path" parts={['L(0)=0']} /></li>
        <li>
          <p>Путь в любой момент времени не бывает отрицательным:</p>
          <LessonEquation equation="path-nonnegative" parts={[String.raw`L(t)\ge0`, String.raw`\forall t\ge0.`]} />
          <p>Равенство достигается только в начальный момент или в случае, когда точка всё время покоилась с начала отсчёта.</p>
        </li>
        <li>
          <p>Путь с течением времени не убывает:</p>
          <LessonEquation equation="path-nondecreasing" parts={['t_2>t_1', String.raw`\Rightarrow\;L(t_2)\ge L(t_1).`]} />
          <p>Равенство достигается тогда и только тогда, когда на рассматриваемом промежутке времени точка находилась в покое.</p>
        </li>
      </ol>
    </section>
  </>;
}
