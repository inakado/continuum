import MathText from './LessonMath';
import DisplacementDemo from './DisplacementDemo';
import LessonEquation, { EquationReference, LessonInlineMath, NumberedEquation } from './LessonEquation';
import LessonDefinition from './LessonDefinition';
import { DemoReference } from './LessonDemonstration';
import styles from '@/components/interactive-lesson/authoring/lesson-theory.module.css';

export default function DisplacementTheory() {
  return <section id="displacement-theory" data-lesson-section className={styles.theory} aria-labelledby="displacement-title">
    <h2 id="displacement-title">Перемещение точки</h2>
    <p>Рассмотрим движение точки, изображённое в <DemoReference demo="displacement" />. Вектор <LessonInlineMath tex={String.raw`\vec S`} />, проведённый из начального положения <LessonInlineMath tex="M(0)" /> в конечное <LessonInlineMath tex="M(t)" />, называется <em>перемещением точки</em>. Модуль перемещения равен длине отрезка, соединяющего начальное и конечное положения точки, а его направление указывает, в какую сторону произошло смещение точки.</p>
    <MathText text={String.raw`Перемещение точки можно выразить через её радиус-векторы. Радиус-векторы $\vec r_0$, $\vec r(t)$ и перемещение $\vec S$ точки образуют векторный треугольник. Согласно правилу треугольника сложения векторов`} />
    <LessonEquation equation="vector-triangle" parts={[String.raw`\vec r(t)=\vec r_0+\vec S,`]} />
    <p>откуда следует:</p>
    <LessonEquation equation="displacement-difference" framed parts={[String.raw`\vec S=\vec r(t)-\vec r_0=\Delta\vec r.`]} />
    <p>Таким образом, перемещение точки представляет собой изменение её радиус-вектора за рассматриваемый промежуток времени.</p>
    <p>Из формулы <EquationReference equation="displacement-difference" /> видно, что перемещение зависит только от начального и конечного положений точки, но не зависит от формы траектории между ними. Поэтому разные движения с одинаковыми начальным и конечным положениями имеют одно и то же перемещение, хотя пройденные пути могут быть разными.</p>
    <DisplacementDemo />
    <p>Получим координатную форму записи перемещения. Для этого представим оба радиус-вектора в виде разложения по базису (формула <EquationReference equation="radius-vector-basis" />) и перепишем уравнение <EquationReference equation="displacement-difference" />:</p>
    <NumberedEquation equation="displacement-expansion"><div className={styles.derivation} aria-label="Вывод координатной формы перемещения">
      <div>
        <MathText text={String.raw`$\vec S=\vec r(t)-\vec r_0$`} />
        <div className={styles.derivationStep}>
          {[String.raw`=x(t)\vec i`, String.raw`+y(t)\vec j`, String.raw`+z(t)\vec k`, String.raw`-x_0\vec i`, String.raw`-y_0\vec j`, String.raw`-z_0\vec k`].map((tex) => <MathText key={tex} text={`$${tex}$`} />)}
        </div>
      </div>
      <div>
        <div className={styles.derivationStep}>
          <MathText text={String.raw`$=(x(t)-x_0)\vec i$`} /><MathText text={String.raw`$+(y(t)-y_0)\vec j$`} /><MathText text={String.raw`$+(z(t)-z_0)\vec k$`} />
        </div>
        <div className={styles.derivationStep}>
          <MathText text={String.raw`$=\Delta x\cdot\vec i$`} /><MathText text={String.raw`$+\Delta y\cdot\vec j$`} /><MathText text={String.raw`$+\Delta z\cdot\vec k.$`} />
        </div>
      </div>
    </div></NumberedEquation>
    <p>С другой стороны, разложение вектора перемещения по базису имеет вид:</p>
    <LessonEquation equation="displacement-basis" parts={[String.raw`\vec S=S_x\cdot\vec i`, String.raw`+S_y\cdot\vec j`, String.raw`+S_z\cdot\vec k.`]} />
    <p>Сравнивая полученные формулы <EquationReference equation="displacement-expansion" /> и <EquationReference equation="displacement-basis" />, приходим к координатной форме записи перемещения точки:</p>
    <LessonEquation equation="displacement-projections" parts={['x','y','z'].map((axis) => String.raw`S_${axis}=\Delta ${axis},`)} />
    <p>то есть проекция перемещения на каждую координатную ось равна изменению соответствующей координаты точки.</p>
    <LessonDefinition id="displacement-definition" title="Перемещение точки" notation={String.raw`\vec S,\,\varDelta\vec r`}
      description="векторная физическая величина; вектор, проведённый из начального в конечное положение материальной точки.">
      <div className={styles.representations}>
        <div><h4>Векторная форма</h4><MathText text={String.raw`$\vec S=\Delta\vec r$`} /><MathText text={String.raw`$[S]=\text{м}$`} /></div>
        <div>
          <h4>Координатная форма</h4>
          <div className={styles.compactEquations}>{['x','y','z'].map((axis, i) => <MathText key={axis} text={`$S_${axis}=\\Delta ${axis}${i < 2 ? ',' : ''}$`} />)}</div>
          <MathText text={String.raw`$[S_x]=\text{м}$`} />
        </div>
      </div>
    </LessonDefinition>
    <p>Кратчайшее расстояние между двумя точками равно длине отрезка, который их соединяет. Поэтому модуль перемещения не превышает путь, пройденный точкой между этими положениями.</p>
    <aside className={styles.remark}><div>
      <h4>Замечание</h4>
      <p>Модуль перемещения точки не больше пути</p>
      <LessonEquation parts={[String.raw`S\le L`]} />
      <p>Равенство достигается при прямолинейном движении точки в одном направлении без разворотов, а также если точка покоится.</p>
    </div></aside>
    <MathText text={String.raw`В процессе движения перемещение $\vec S$ точки изменяется, поэтому его можно задать как функцию времени:`} />
    <LessonEquation equation="displacement-time-law" framed parts={[String.raw`\vec S=\vec S(t).`]} />
    <p>Сама по себе зависимость <LessonInlineMath tex={String.raw`\vec S(t)`} /> описывает только изменение положения точки относительно её начального положения. Чтобы восстановить положение точки в выбранной системе отсчёта, нужно знать ещё начальный радиус-вектор <LessonInlineMath tex={String.raw`\vec r_0`} />. Тогда согласно уравнению <EquationReference equation="vector-triangle" /></p>
    <LessonEquation equation="position-from-displacement" framed parts={[String.raw`\vec r(t)=\vec r_0+\vec S(t),`]} />
    <MathText text={String.raw`то есть зависимость $\vec S(t)$ вместе с начальным положением точки позволяет определить её положение в любой момент времени.`} />
  </section>;
}
