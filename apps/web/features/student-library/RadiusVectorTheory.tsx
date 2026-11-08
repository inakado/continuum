import MathText from './LessonMath';
import LessonEquation, { LessonInlineMath } from './LessonEquation';
import LessonDefinition from './LessonDefinition';
import { DemoReference } from './LessonDemonstration';
import styles from '@/components/interactive-lesson/authoring/lesson-theory.module.css';

export default function RadiusVectorTheory() {
  return (
    <section id="radius-vector-theory" data-lesson-section className={styles.theory} aria-label="Радиус-вектор: определение и соотношения">
      <MathText text={String.raw`Начало радиус-вектора $\vec r$ находится в начале $O(0,0,0)$ системы координат, а конец — в точке $M(x,y,z)$, а потому`} />
      <LessonEquation equation="radius-vector-projections" parts={['r_x=x-x_O=x,', 'r_y=y-y_O=y,', 'r_z=z-z_O=z.']} />
      <MathText text={String.raw`Таким образом, координаты $x$, $y$, $z$ точки являются проекциями $r_x$, $r_y$, $r_z$ её радиус-вектора на соответствующие оси.`} />

      <LessonDefinition id="radius-vector-definition" title="Радиус-вектор точки" notation={String.raw`\vec r`}
        description="вектор, проведённый из начала координат системы отсчёта в точку.">
        <div className={styles.representations}>
          <div>
            <h4>Геометрическое представление</h4>
            <MathText text={String.raw`Модуль $r$ и углы $\alpha_x$, $\alpha_y$, $\alpha_z$`} />
            <MathText text={String.raw`$[r]=\text{м}$`} />
          </div>
          <div>
            <h4>Координатное представление</h4>
            <div className={styles.compactEquations}>{['x', 'y', 'z'].map((axis, i) => <MathText key={axis} text={`$r_${axis}=${axis}${i < 2 ? ',' : ''}$`} />)}</div>
            <MathText text={String.raw`$[r_x]=[x]=\text{м}$`} />
          </div>
        </div>
      </LessonDefinition>

      <aside className={styles.remark} aria-labelledby="radius-vector-remark">
        <h4 id="radius-vector-remark">Замечание</h4>
        <p>Модуль радиус-вектора точки имеет смысл расстояния от начала координат до этой точки: <LessonInlineMath tex="r=OM" /></p>
      </aside>

      <p>С радиус-вектором можно выполнять те же математические операции, что и с любым другим вектором. Некоторые соотношения, которые понадобятся при дальнейшем изучении кинематики, приведены ниже и проиллюстрированы в <DemoReference demo="coordinates" /> и <DemoReference demo="vector" />.</p>
      <MathText text={String.raw`Разложение радиус-вектора по базису $\vec i$, $\vec j$, $\vec k$ имеет вид:`} />
      <LessonEquation equation="radius-vector-basis" label="Разложение радиус-вектора по базису" framed parts={[
        [String.raw`\vec r=r_x\cdot\vec i`, String.raw`+r_y\cdot\vec j`, String.raw`+r_z\cdot\vec k`],
        [String.raw`=x\cdot\vec i`, String.raw`+y\cdot\vec j`, String.raw`+z\cdot\vec k,`],
      ]} />
      <MathText text={String.raw`где $\vec i$, $\vec j$, $\vec k$ — единичные орты, то есть векторы единичной длины, направленные вдоль координатных осей $OX$, $OY$, $OZ$ соответственно.`} />

      <p>Модуль радиус-вектора выражается по теореме Пифагора:</p>
      <LessonEquation equation="radius-vector-magnitude" label="Модуль радиус-вектора" framed parts={[
        String.raw`r=\sqrt{r_x^2+r_y^2+r_z^2}`, String.raw`=\sqrt{x^2+y^2+z^2}`,
      ]} />

      <p>Направление радиус-вектора задаётся направляющими косинусами:</p>
      <LessonEquation equation="radius-vector-cosines" label="Направляющие косинусы" framed parts={['x', 'y', 'z'].map((axis, i) => String.raw`\cos\alpha_${axis}=\frac{r_${axis}}{r}=\frac{${axis}}{r}${i < 2 ? ',' : ''}`)} />
    </section>
  );
}
