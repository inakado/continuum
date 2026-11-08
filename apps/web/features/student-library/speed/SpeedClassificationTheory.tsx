import MathText from '@/components/interactive-lesson/authoring/LessonMath';
import LessonDefinition from '@/components/interactive-lesson/authoring/LessonDefinition';
import { LessonInlineMath as Math } from '@/components/interactive-lesson/authoring/LessonEquation';
import { SpeedEquation as Equation, SpeedReferencedEquation } from './speed-equations';
import styles from '@/components/interactive-lesson/authoring/lesson-theory.module.css';

export default function SpeedClassificationTheory() {
  return <>
    <section id="kin02-projections" data-lesson-section className={styles.theory} aria-label="Знак проекции скорости">
      <MathText text={String.raw`Знак проекции мгновенной скорости точки указывает, в каком направлении вдоль соответствующей координатной оси движется точка. Установим, как знак проекции $\upsilon_x$ связан с направлением движения точки вдоль оси $OX$.`} />
      <ol className={styles.list}>
        {(['>', '<', '='] as const).map((sign, i) => <li key={sign}>
          <MathText text={String.raw`Если $\upsilon_x${sign}0$, то`} />
          <SpeedReferencedEquation number={(12 + i) as 12 | 13 | 14} parts={[
            String.raw`\upsilon_x${sign}0`,
            { tex: String.raw`\overset{\text{(11)}}{\Longleftrightarrow}\frac{dx}{dt}${sign}0`, reference: 11 },
            String.raw`\overset{dt>0}{\Longleftrightarrow}dx${sign}0`,
            { terms: [String.raw`\Longleftrightarrow x(t+dt)`, String.raw`-x(t)${sign}0`] },
            String.raw`\Longleftrightarrow x(t+dt)${sign}x(t).`,
          ]} />
          <MathText text={[
            String.raw`То есть координата $x$ точки в данный момент времени возрастает. Следовательно, точка движется в положительном направлении оси $OX$.`,
            String.raw`То есть координата $x$ точки в данный момент времени убывает. Следовательно, точка движется в отрицательном направлении оси $OX$.`,
            String.raw`То есть координата $x$ точки в данный момент времени не изменяется. Следовательно, точка в этот момент не движется вдоль оси $OX$.`,
          ][i]} />
        </li>)}
      </ol>
      <MathText text={String.raw`Аналогичные рассуждения устанавливают связь между знаками проекций $\upsilon_y$, $\upsilon_z$ и направлением движения точки вдоль координатных осей $OY$ и $OZ$, соответственно.`} />
      <aside className={styles.remark}>
        <h4>Замечание</h4>
        <p>Направление движения точки вдоль координатных осей определяется знаком соответствующих проекций ее мгновенной скорости:</p>
        <ol className={styles.list}>
          <li><Math tex={String.raw`\upsilon_x>0\Longleftrightarrow`} /> точка движется в положительном направлении оси <Math tex="OX" />,</li>
          <li><Math tex={String.raw`\upsilon_x<0\Longleftrightarrow`} /> точка движется в отрицательном направлении оси <Math tex="OX" />,</li>
          <li><Math tex={String.raw`\upsilon_x=0\Longleftrightarrow`} /> точка не движется вдоль оси <Math tex="OX" />.</li>
        </ol>
        <MathText text={String.raw`Аналогичные утверждения справедливы для проекций $\upsilon_y$, $\upsilon_z$ и движения вдоль осей $OY$ и $OZ$, соответственно.`} />
      </aside>
    </section>
    <section id="kin02-classification" data-lesson-section className={styles.theory} aria-label="Классификация движения">
      <p>Как векторная величина, мгновенная скорость может изменяться по модулю, по направлению или одновременно по модулю и направлению. Поэтому ее рассматривают как функцию времени:</p>
      <Equation number={15} parts={[String.raw`\vec{\upsilon}=\vec{\upsilon}(t),`]} />
      <p>или в координатной форме:</p>
      <Equation number={16} parts={['x', 'y', 'z'].map((axis, i) => String.raw`\upsilon_${axis}=\upsilon_${axis}(t)${i < 2 ? ',' : '.'}`)} />
      <p>Характер изменения этой функции позволяет классифицировать движение точки.</p>
      <ol className={styles.list}>
        <li>
          <p>По характеру изменения модуля мгновенной скорости выделяют <em>равномерное</em> и <em>неравномерное</em> движение точки.</p>
          <LessonDefinition id="kin02-uniform-definition" title="Равномерное движение точки" description="движение, при котором модуль мгновенной скорости точки остается постоянным">
            <Equation parts={[String.raw`\upsilon(t)=const`]} />
          </LessonDefinition>
          <LessonDefinition id="kin02-nonuniform-definition" title="Неравномерное движение точки" description="движение, при котором модуль мгновенной скорости точки изменяется с течением времени">
            <Equation parts={[String.raw`\upsilon(t)\neq const`]} />
          </LessonDefinition>
        </li>
        <li>
          <p>Ранее мы классифицировали движение точки по траектории на прямолинейное и криволинейное. При этом мгновенная скорость точки направлена по касательной к траектории в ее точке. Таким образом, классификация движения по форме траектории эквивалентна классификации по характеру изменения направления вектора мгновенной скорости.</p>
          <aside className={styles.remark}>
            <h4>Замечание</h4>
            <p>Характер изменения направления вектора мгновенной скорости точки связан с формой траектории, по которой она движется:</p>
            <ol className={styles.list}>
              <li>направление <Math tex={String.raw`\vec{\upsilon}(t)`} /> постоянно <Math tex={String.raw`\Longleftrightarrow`} /> прямолинейное движение точки;</li>
              <li>направление <Math tex={String.raw`\vec{\upsilon}(t)`} /> изменяется <Math tex={String.raw`\Longleftrightarrow`} /> криволинейное движение точки;</li>
            </ol>
          </aside>
        </li>
      </ol>
      <p>Таким образом, движение точки классифицируют по двум независимым признакам: по характеру изменения модуля мгновенной скорости и по форме траектории. Поэтому прямолинейное движение может быть как равномерным, так и неравномерным, а равномерное — как прямолинейным, так и криволинейным.</p>
    </section>
  </>;
}
