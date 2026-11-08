import MathText from '@/components/interactive-lesson/authoring/LessonMath';
import SpeedAverageTheory from './SpeedAverageTheory';
import SpeedInstantaneousTheory from './SpeedInstantaneousTheory';
import SpeedClassificationTheory from './SpeedClassificationTheory';
import SpeedPathTheory from './SpeedPathTheory';
import SpeedDemonstration from './SpeedDemonstration';
import { SpeedEquation as Equation } from './speed-equations';
import textStyles from '../student-interactive-lesson-prototype.module.css';
import styles from '@/components/interactive-lesson/authoring/lesson-theory.module.css';

export default function SpeedLessonContent() {
  return <div className={textStyles.text}>
    <section className={styles.theory} aria-label="Повторение основных понятий">
      <MathText text={String.raw`Тело, размерами и формой которого можно пренебречь в условиях решаемой задачи, заменяют *материальной точки*.`} />
      <MathText text={String.raw`Положение материальной точки в выбранной системе отсчета можно задать ее координатами $x$, $y$, $z$, либо радиус-вектором $\vec r$.`} />
      <p>Основная задача механики точки заключается в определении ее положения в любой момент времени. Для этого необходимо найти закон движения точки — зависимость от времени ее координат</p>
      <Equation number={1} parts={['x=x(t),', 'y=y(t),', 'z=z(t),']} />
      <p>или зависимость ее радиус-вектора</p>
      <Equation number={2} parts={[String.raw`\vec r=\vec r(t).`]} />
      <MathText text={String.raw`Линия, вдоль которой с течением времени движется точка, называется *траекторией*. Длина траектории называется *путем*.`} />
      <MathText text={String.raw`Изменение радиус-вектора точки называется *перемещением*.`} />
      <MathText text={String.raw`В данном параграфе мы введем понятия *скорости* и *ускорения* точки — кинематических величин, необходимых для полного описания ее движения.`} />
      <h2>Скорость точки</h2>
      <MathText text={String.raw`Рассмотрим движение точки $M$ относительно выбранной системы отсчета. В каждый момент времени $t$ ее положение задается радиус-вектором $\vec r(t)$ или, что эквивалентно, координатами $x(t)$, $y(t)$, $z(t)$. С течением времени положение точки изменяется, а вместе с ним изменяются ее радиус-вектор и координаты.`} />
      <MathText text={String.raw`Для количественного описания быстроты этого изменения вводится кинематическая величина — *скорость точки*.`} />
      <MathText text={String.raw`В зависимости от способа определения различают *среднюю по перемещению скорость*, *мгновенную скорость* и *среднюю путевую скорость*.`} />
    </section>
    <SpeedAverageTheory />
    <SpeedInstantaneousTheory />
    <SpeedClassificationTheory />
    <SpeedPathTheory />
    <section id="kin02-return" data-lesson-section className={styles.theory} aria-labelledby="kin02-return-title">
      <h2 id="kin02-return-title">Движение туда и обратно</h2>
      <SpeedDemonstration kind="return" />
    </section>
  </div>;
}
