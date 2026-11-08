import MathText from '@/components/interactive-lesson/authoring/LessonMath';
import LessonDefinition from '@/components/interactive-lesson/authoring/LessonDefinition';
import { LessonInlineMath as Math } from '@/components/interactive-lesson/authoring/LessonEquation';
import SpeedDemonstration from './SpeedDemonstration';
import { SpeedEquation as Equation, SpeedEquationReference as Ref, SpeedDemoReference } from './speed-equations';
import styles from '@/components/interactive-lesson/authoring/lesson-theory.module.css';

export default function SpeedInstantaneousTheory() {
  return <section id="kin02-instantaneous" data-lesson-section className={styles.theory} aria-labelledby="kin02-instantaneous-title">
    <h2 id="kin02-instantaneous-title">Мгновенная скорость точки</h2>
    <MathText text={String.raw`Оставим момент времени $t$ зафиксированным и станем брать промежуток времени $\Delta t$ все меньше и меньше, устремляя его к нулю. Соответствующее перемещение точки $\Delta\vec r$ станет также стремиться к нулю.`} />
    <p>Разностное отношение <Ref number={4} /> при этом будет стремиться к определенному пределу, который зависит от момента времени <Math tex="t" />, но уже не зависит от промежутка времени <Math tex={String.raw`\Delta t`} />, и называется <em>мгновенной скоростью точки</em> <Math tex={String.raw`\vec{\upsilon}`} />. Сказанное выше записывается следующим образом:</p>
    <Equation number={9} parts={[String.raw`\vec{\upsilon}=\lim_{\Delta t\rightarrow0}\frac{\Delta\vec r}{\Delta t}.`]} />
    <p>Напомним, в математике предел разностного отношения вида <Ref number={9} /> называется производной функции. Следовательно, мгновенная скорость точки равна производной ее радиус-вектора по времени:</p>
    <Equation number={10} parts={[String.raw`\vec{\upsilon}=\dot{\vec r}=\frac{d\vec r}{dt},`]} />
    <MathText text={String.raw`где точка над радиус-вектором обозначает ее производную по времени, а $d\vec r$ и $dt$ — бесконечно малые перемещения точки и промежуток времени, соответственно.`} />
    <p>Мгновенную скорость точки можно понимать как среднюю по перемещению скорость за бесконечно малый промежуток времени. Выполнив в уравнениях <Ref number={8} /> предельный переход при <Math tex={String.raw`\Delta t\to0`} />, получим координатную форму ее записи:</p>
    <Equation number={11} parts={['x', 'y', 'z'].map(axis => [
      String.raw`\upsilon_${axis}=\lim_{\Delta t\rightarrow0}\frac{\Delta ${axis}}{\Delta t}`,
      String.raw`=\dot{${axis}}=\frac{d${axis}}{dt},`,
    ])} />
    <MathText text={String.raw`где $\dot x$, $\dot y$, $\dot z$ — производные координат точки по времени, а $dx$, $dy$, $dz$ — бесконечно малые изменения соответствующих координат.`} />
    <LessonDefinition id="kin02-instantaneous-definition" title="Мгновенная скорость точки" notation={String.raw`\vec{\upsilon}`} description="векторная физическая величина, равная отношению бесконечно малого перемещения точки к соответствующему бесконечно малому промежутку времени / производной радиус-вектора точки по времени.">
      <div className={styles.representations}>
        <div>
          <h4>Векторная форма</h4>
          <MathText text={String.raw`$\displaystyle\vec{\upsilon}=\dot{\vec r}=\frac{d\vec r}{dt}$`} />
          <MathText text={String.raw`$[\upsilon]=\frac{\text{м}}{\text{с}}$`} />
        </div>
        <div>
          <h4>Координатная форма</h4>
          <div className={styles.compactEquations}>{['x', 'y', 'z'].map(axis => <MathText key={axis} text={String.raw`$\displaystyle\upsilon_${axis}=\dot{${axis}}=\frac{d${axis}}{dt}$`} />)}</div>
          <Equation parts={[String.raw`[\upsilon_x]=[\upsilon_y]`, String.raw`=[\upsilon_z]=\frac{\text{м}}{\text{с}}`]} />
        </div>
      </div>
    </LessonDefinition>
    <p>Чтобы определить направление вектора мгновенной скорости точки <Math tex={String.raw`\vec{\upsilon}`} />, воспользуемся геометрическим смыслом предела <Ref number={9} />. При уменьшении <Math tex={String.raw`\Delta t_i`} /> точки <Math tex={String.raw`M(t+\Delta t_i)`} /> приближаются к <Math tex="M(t)" /> (<SpeedDemoReference kind="tangent" /> <Math tex={String.raw`\Delta t_1>\Delta t_2>\Delta t_3`} />); в пределе при <Math tex={String.raw`\Delta t_i\to0`} /> они «сливаются» с ней.</p>
    <SpeedDemonstration kind="tangent" />
    <p>При этом каждая секущая, проходящая через точки <Math tex="M(t)" /> и <Math tex={String.raw`M(t+\Delta t_i)`} />, по мере уменьшения <Math tex={String.raw`\Delta t_i`} /> приближается к касательной к траектории в точке <Math tex="M(t)" />. Следовательно, направление вектора перемещения <Math tex={String.raw`\Delta\vec r_i`} />, а вместе с ним, согласно формуле <Ref number={9} /> (<Math tex={String.raw`\Delta t_i>0`} />), и направление вектора мгновенной скорости <Math tex={String.raw`\vec{\upsilon}`} /> стремится к направлению этой касательной. Таким образом, вектор мгновенной скорости <Math tex={String.raw`\vec{\upsilon}`} /> в каждой точке траектории направлен по касательной к ней.</p>
    <aside className={styles.rule}>
      <h3>Свойство</h3>
      <MathText text={String.raw`Вектор мгновенной скорости точки $\vec{\upsilon}$ направлен по касательной к траектории в каждой ее точке.`} />
    </aside>
  </section>;
}
