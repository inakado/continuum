import MathText from '@/components/interactive-lesson/authoring/LessonMath';
import LessonDefinition from '@/components/interactive-lesson/authoring/LessonDefinition';
import { LessonInlineMath as Math } from '@/components/interactive-lesson/authoring/LessonEquation';
import SpeedDemonstration from './SpeedDemonstration';
import { SpeedEquation as Equation, SpeedEquationReference as Ref, SpeedNumberedEquation, SpeedDemoReference } from './speed-equations';
import styles from '@/components/interactive-lesson/authoring/lesson-theory.module.css';
import layout from './speed-content.module.css';

export default function SpeedAverageTheory() {
  return <section id="kin02-average" data-lesson-section className={styles.theory} aria-labelledby="kin02-average-title">
    <h2 id="kin02-average-title">Средняя по перемещению скорость точки</h2>
    <p>Зафиксируем произвольный момент времени <Math tex="t" />. В этот момент положение точки задается радиус-вектором <Math tex={String.raw`\vec r(t)`} /> (<SpeedDemoReference kind="average" />). Спустя промежуток времени <Math tex={String.raw`\Delta t`} />, то есть в момент <Math tex={String.raw`t+\Delta t`} />, точка окажется в новом положении, которому соответствует радиус-вектор <Math tex={String.raw`\vec r(t+\Delta t)`} />.</p>
    <MathText text={String.raw`Тогда перемещение $\Delta \vec{r}$ точки за рассматриваемый промежуток времени $\Delta t$ равно`} />
    <Equation number={3} parts={[String.raw`\Delta \vec r=\vec r(t+\Delta t)`, String.raw`-\vec r(t).`]} />
    <SpeedDemonstration kind="average" />
    <p>Образуем разностное отношение</p>
    <Equation number={4} parts={[String.raw`\langle\vec{\upsilon}\rangle=\frac{\Delta\vec r}{\Delta t},`]} />
    <MathText text={String.raw`которое характеризует быстроту изменения положения точки за рассматриваемый промежуток времени и называется *средней по перемещению скоростью точки*. Поскольку $\Delta t>0$, вектор средней по перемещению скорости $\langle\vec{\upsilon}\rangle$ сонаправлен с вектором перемещения $\Delta\vec r$.`} />
    <MathText text={String.raw`Чтобы получить координатную запись средней по перемещению скорости точки, разложим ее перемещение по базису $\vec i$, $\vec j$, $\vec k$:`} />
    <Equation number={5} parts={[String.raw`\Delta\vec r=\Delta x\cdot\vec i`, String.raw`+\Delta y\cdot\vec j`, String.raw`+\Delta z\cdot\vec k.`]} />
    <p>Теперь подставим разложение <Ref number={5} /> в формулу <Ref number={4} />:</p>
    <SpeedNumberedEquation number={6}><div className={layout.fractionExpansion}>
      <div className={layout.full}><Equation parts={[
        String.raw`\langle\vec{\upsilon}\rangle=\frac{\Delta x\cdot\vec i+\Delta y\cdot\vec j+\Delta z\cdot\vec k}{\Delta t}`,
        [String.raw`=\frac{\Delta x}{\Delta t}\cdot\vec i`, String.raw`+\frac{\Delta y}{\Delta t}\cdot\vec j`, String.raw`+\frac{\Delta z}{\Delta t}\cdot\vec k.`],
      ]} /></div>
      <div className={layout.stacked}><Equation parts={[
        String.raw`\langle\vec{\upsilon}\rangle`,
        String.raw`=\frac{\begin{gathered}\Delta x\cdot\vec i\\+\Delta y\cdot\vec j\\+\Delta z\cdot\vec k\end{gathered}}{\Delta t}`,
        [String.raw`=\frac{\Delta x}{\Delta t}\cdot\vec i`, String.raw`+\frac{\Delta y}{\Delta t}\cdot\vec j`, String.raw`+\frac{\Delta z}{\Delta t}\cdot\vec k.`],
      ]} /></div>
    </div></SpeedNumberedEquation>
    <MathText text={String.raw`С другой стороны, разложение по базису $\vec i$, $\vec j$, $\vec k$ средней по перемещению скорости точки имеет вид:`} />
    <Equation number={7} parts={[String.raw`\langle\vec{\upsilon}\rangle=\langle\upsilon_x\rangle\cdot\vec i`, String.raw`+\langle\upsilon_y\rangle\cdot\vec j`, String.raw`+\langle\upsilon_z\rangle\cdot\vec k.`]} />
    <p>Сравнивая формулы <Ref number={6} /> и <Ref number={7} />, приходим к координатной записи средней по перемещению скорости точки:</p>
    <Equation number={8} parts={['x', 'y', 'z'].map((axis, i) => String.raw`\langle\upsilon_${axis}\rangle=\frac{\Delta ${axis}}{\Delta t}${i < 2 ? ',' : '.'}`)} />
    <LessonDefinition id="kin02-average-definition" title="Средняя по перемещению скорость точки" notation={String.raw`\langle\vec{\upsilon}\rangle`} description="векторная физическая величина, равная отношению перемещения точки к соответствующему промежутку времени.">
      <div className={styles.representations}>
        <div>
          <h4>Векторная форма</h4>
          <MathText text={String.raw`$\displaystyle\langle\vec{\upsilon}\rangle=\frac{\Delta\vec r}{\Delta t}$`} />
          <MathText text={String.raw`$[\langle\upsilon\rangle]=\frac{\text{м}}{\text{с}}$`} />
        </div>
        <div>
          <h4>Координатная форма</h4>
          <div className={styles.compactEquations}>{['x', 'y', 'z'].map((axis, i) => <MathText key={axis} text={String.raw`$\displaystyle\langle\upsilon_${axis}\rangle=\frac{\Delta ${axis}}{\Delta t}${i < 2 ? ',' : ''}$`} />)}</div>
          <Equation parts={[String.raw`[\langle\upsilon_x\rangle]=[\langle\upsilon_y\rangle]`, String.raw`=[\langle\upsilon_z\rangle]=\frac{\text{м}}{\text{с}}`]} />
        </div>
      </div>
    </LessonDefinition>
    <aside className={styles.rule}>
      <h3>Свойство</h3>
      <p>Средняя по перемещению скорость точки сонаправлена с ее перемещением</p>
      <Equation parts={[String.raw`\langle\vec{\upsilon}\rangle\uparrow\uparrow\Delta\vec r`]} />
    </aside>
    <aside className={styles.remark}>
      <h4>Замечание</h4>
      <MathText text={String.raw`Средняя по перемещению скорость точки зависит от момента времени $t$, а также от промежутка времени $\Delta t$.`} />
    </aside>
  </section>;
}
