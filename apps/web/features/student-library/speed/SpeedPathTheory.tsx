import MathText from '@/components/interactive-lesson/authoring/LessonMath';
import LessonDefinition from '@/components/interactive-lesson/authoring/LessonDefinition';
import { LessonInlineMath as Math } from '@/components/interactive-lesson/authoring/LessonEquation';
import SpeedDemonstration from './SpeedDemonstration';
import { SpeedEquation as Equation, SpeedEquationReference as Ref, SpeedReferencedEquation, SpeedDemoReference } from './speed-equations';
import styles from '@/components/interactive-lesson/authoring/lesson-theory.module.css';

export default function SpeedPathTheory() {
  return <>
    <section id="kin02-path" data-lesson-section className={styles.theory} aria-labelledby="kin02-path-title">
      <h2 id="kin02-path-title">Средняя путевая скорость точки</h2>
      <p>Обозначим путь, пройденный точкой <Math tex="M" /> к моменту времени <Math tex="t" />, через <Math tex="L(t)" />. В течение следующего промежутка времени <Math tex={String.raw`\Delta t`} /> точка продолжает движение вдоль траектории, поэтому к моменту времени <Math tex={String.raw`t+\Delta t`} /> пройденный ею путь становится равным <Math tex={String.raw`L(t+\Delta t)`} /> (<SpeedDemoReference kind="path" />).</p>
      <SpeedDemonstration kind="path" />
      <MathText text={String.raw`Тогда путь $\Delta L$, пройденный за промежуток времени $\Delta t$, равен`} />
      <Equation number={17} parts={[String.raw`\Delta L=L(t+\Delta t)`, String.raw`-L(t).`]} />
      <p>Образуем разностное отношение</p>
      <Equation number={18} parts={[String.raw`\langle\upsilon\rangle_\text{путь}=\frac{\Delta L}{\Delta t},`]} />
      <MathText text={String.raw`которое характеризует быстроту прохождения траектории точкой за рассматриваемый промежуток времени и называется *средней путевой скоростью точки*.`} />
      <LessonDefinition id="kin02-path-definition" title="Средняя путевая скорость точки" notation={String.raw`\langle\upsilon\rangle_\text{путь}`} description="скалярная физическая величина, равная отношению пути, пройденного точкой за рассматриваемый промежуток времени, к величине этого промежутка времени">
        <Equation parts={[String.raw`\langle\upsilon\rangle_\text{путь}=\frac{\Delta L}{\Delta t}`]} />
      </LessonDefinition>
      <aside className={styles.remark}>
        <h4>Замечание</h4>
        <MathText text={String.raw`Средняя путевая скорость точки зависит от момента времени $t$, а также от промежутка времени $\Delta t$.`} />
      </aside>
      <p>Поскольку модуль перемещения точки не превосходит пройденного за то же время пути, имеем</p>
      <Equation number={19} parts={[String.raw`\lvert\Delta\vec r\,\rvert\leq\Delta L,`]} />
      <p>причем равенство достигается, если точка движется прямолинейно в одном направлении.</p>
      <MathText text={String.raw`Разделим обе части неравенства на один и тот же промежуток времени $\Delta t>0$:`} />
      <SpeedReferencedEquation number={20} parts={[
        String.raw`\frac{|\Delta\vec r\,|}{\Delta t}\leq\frac{\Delta L}{\Delta t}`,
        { tex: String.raw`\Longleftrightarrow`, above: [4, 18] },
        String.raw`\langle\upsilon\rangle\leq\langle\upsilon\rangle_\text{путь}.`,
      ]} />
      <aside className={styles.remark}>
        <h4>Замечание</h4>
        <p>Модуль средней по перемещению скорости точки не превосходит ее средней путевой скорости</p>
        <Equation parts={[String.raw`\langle\upsilon\rangle\leq\langle\upsilon\rangle_\text{путь},`]} />
        <p>причем равенство достигается, если точка движется прямолинейно в одном направлении.</p>
      </aside>
    </section>
    <section id="kin02-instantaneous-path" data-lesson-section className={styles.theory} aria-labelledby="kin02-instantaneous-path-title">
      <h2 id="kin02-instantaneous-path-title">Мгновенная путевая скорость</h2>
      <p>Рассмотрим предел разностного отошения <Ref number={18} /> при <Math tex={String.raw`\Delta t\to0`} /></p>
      <Equation number={21} parts={[
        String.raw`\upsilon_\text{путь}=\lim_{\Delta t\to0}\frac{\Delta L}{\Delta t}`,
        String.raw`=\dot L=\frac{dL}{dt},`,
      ]} />
      <MathText text={String.raw`который не зависит от промежутка времени $\Delta t$, а зависит только от момента времени $t$ и называется *мгновенной путевой скоростью точки*.`} />
      <p>Хотя мгновенная путевая скорость вводится как самостоятельная кинематическая величина, ниже будет показано, что она полностью определяется модулем мгновенной скорости точки и поэтому не содержит новой информации о ее движении.</p>
      <MathText text={String.raw`При уменьшении промежутка времени $\Delta t$, как уже было установлено нами раннее, положение точки в момент времени $t+\Delta t$ приближается к ее положению в момент времени $t$. Поэтому в пределе при $\Delta t\to0$ они «сливаются». Из геометрических соображений следует, что участок траектории между рассматриваемыми положениями точки стремится к бесконечно малому отрезку прямой, соединяющему эти точки. Значит модуль перемещения точки и ее путь при этом совпадают:`} />
      <Equation number={22} parts={[String.raw`\lim_{\Delta t\to0}|\Delta\vec r\,|`, String.raw`=\lim_{\Delta t\to0}\Delta L`]} />
      <MathText text={String.raw`Разделим обе части равенства на $\Delta t\to0$:`} />
      <SpeedReferencedEquation number={23} parts={[
        String.raw`\lim_{\Delta t\to0}\frac{|\Delta\vec r\,|}{\Delta t}`,
        String.raw`=\lim_{\Delta t\to0}\frac{\Delta L}{\Delta t}`,
        { tex: String.raw`\Longleftrightarrow`, above: [9, 21] },
        String.raw`\upsilon=\upsilon_\text{путь},`,
      ]} />
      <p>то есть модуль мгновенной скорости точки равен ее мгновенной путевой скорости. Следовательно, мгновенную путевую скорость следует рассматривать как модуль мгновенной скорости точки, а формулу <Ref number={21} /> — как способ его вычисления.</p>
      <aside className={styles.remark}>
        <h4>Замечание</h4>
        <p>Модуль мгновенной скорости точки равен отношению бесконечно малого пути, пройденного точкой, к соответствующему бесконечно малому времени / производной пути точки по времени:</p>
        <Equation parts={[String.raw`\upsilon=\dot L=\frac{dL}{dt}.`]} />
      </aside>
    </section>
  </>;
}
