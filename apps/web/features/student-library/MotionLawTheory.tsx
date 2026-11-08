import MathText from './LessonMath';
import LessonEquation, { EquationReference, LessonInlineMath } from './LessonEquation';
import LessonDefinition from './LessonDefinition';
import styles from '@/components/interactive-lesson/authoring/lesson-theory.module.css';

export default function MotionLawTheory() {
  return <section id="motion-laws" data-lesson-section className={styles.theory} aria-labelledby="motion-law-title">
    <h2 id="motion-law-title">Закон движения</h2>
    <MathText text={String.raw`Движение точки относительно выбранной системы отсчёта означает, что её положение изменяется со временем. Следовательно, координаты точки $x$, $y$, $z$ являются функциями времени:`} />
    <LessonEquation equation="coordinate-motion-law" parts={['x=x(t),', 'y=y(t),', 'z=z(t)']} />
    <MathText text={String.raw`Поскольку положение точки можно также задать радиус-вектором $\vec r$, он тоже является функцией времени:`} />
    <LessonEquation equation="vector-motion-law" parts={[String.raw`\vec r=\vec r(t).`]} />
    <p>Поэтому движение точки можно понимать как изменение радиус-вектора во времени: у него может изменяться длина, направление или обе характеристики сразу.</p>
    <LessonDefinition id="motion-law-definition" title="Закон движения точки"
      description="зависимость положения точки от времени.">
      <div className={styles.representations}>
        <div><h4>Векторная форма</h4><MathText text={String.raw`$\vec r=\vec r(t)$`} /></div>
        <div><h4>Координатная форма</h4><div className={styles.compactEquations}>{['x','y','z'].map((axis, i) => <MathText key={axis} text={`$${axis}=${axis}(t)${i < 2 ? ',' : ''}$`} />)}</div></div>
      </div>
    </LessonDefinition>
    <MathText text={String.raw`Закон движения полностью описывает движение точки: зная зависимости $x(t)$, $y(t)$, $z(t)$ или $\vec r(t)$, можно определить её положение в любой момент времени.`} />
    <aside className={styles.remark}><div><h4>Замечание</h4><p>Основная задача механики точки — найти закон её движения.</p></div></aside>
    <p>Если за <em>начальный момент времени</em> принять <LessonInlineMath tex="t=0" />, то значения функций <EquationReference equation="coordinate-motion-law" /> и <EquationReference equation="vector-motion-law" /> определяют <em>начальное положение</em> точки:</p>
    <LessonEquation equation="initial-coordinates" framed parts={['x(0)=x_0,', 'y(0)=y_0,', 'z(0)=z_0,']} />
    <LessonEquation equation="initial-radius-vector" framed parts={[String.raw`\vec r(0)=\vec r_0.`]} />
    <MathText text={String.raw`Числа $x_0$, $y_0$, $z_0$ называют *начальными координатами*, а вектор $\vec r_0$ — *начальным радиус-вектором* точки.`} />
    <p>Вид закона движения зависит как от характера движения точки, так и от выбранной системы отсчёта. В одних случаях он записывается простой формулой, в других имеет более сложный вид.</p>
  </section>;
}
