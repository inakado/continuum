import MathText from './LessonMath';
import TrajectoryDemo from './TrajectoryDemo';
import OrbitDemo from './OrbitDemo';
import PathProperties from './PathProperties';
import LessonEquation, { LessonInlineMath } from './LessonEquation';
import LessonDefinition from './LessonDefinition';
import { DemoReference } from './LessonDemonstration';
import styles from '@/components/interactive-lesson/authoring/lesson-theory.module.css';

export default function TrajectoryTheory() {
  return <section id="trajectory-theory" data-lesson-section className={styles.theory} aria-labelledby="trajectory-title">
    <h2 id="trajectory-title">Траектория и путь</h2>
    <p>При движении точки конец радиус-вектора проходит через все её положения. Линия, которую при этом описывает конец радиус-вектора, называется <em>траекторией</em> точки (в <DemoReference demo="trajectory" /> — синяя линия). Иначе говоря, траектория — это линия, вдоль которой движется точка.</p>
    <TrajectoryDemo />
    <LessonDefinition id="trajectory-definition" title="Траектория точки"
      description="линия в пространстве, вдоль которой движется точка." />
    <p>Форма траектории зависит от выбранной системы отсчёта: одна и та же точка может иметь разные траектории в разных системах отсчёта. Покажем это на примере движения Луны (<DemoReference demo="moon" />).</p>
    <p>В системе отсчёта, связанной с Землёй, Луна движется по почти круговой орбите (<DemoReference demo="moon" />). В системе отсчёта, связанной с Солнцем, её траектория близка к орбите Земли вокруг Солнца (пунктирная линия), но имеет небольшие ежемесячные отклонения, вызванные обращением Луны вокруг Земли (<DemoReference demo="moon" />).</p>
    <OrbitDemo />
    <aside className={styles.remark}><div><h4>Замечание</h4><p>Траектория точки зависит от выбранной системы отсчёта.</p></div></aside>
    <p>По форме траектории различают:</p>
    <ol className={styles.list}>
      <li><em>прямолинейное движение</em>, при котором точка движется по прямой линии;</li>
      <li><em>криволинейное движение</em>, при котором точка движется по кривой линии.</li>
    </ol>
    <p>Если из законов движения точки в координатной форме исключить время, получится уравнение (или система уравнений), связывающее координаты точки между собой. Оно называется <em>уравнением траектории</em> и задаёт траекторию аналитически.</p>
    <LessonDefinition id="trajectory-equation-definition" title="Уравнение траектории"
      description="уравнение (или система уравнений), которое связывает координаты точки между собой и задаёт её траекторию." />
    <p>Пройденное точкой расстояние вдоль траектории называется <em>путём</em>.</p>
    <LessonDefinition id="path-definition" title="Путь" notation="L"
      description={<>скалярная физическая величина; длина участка траектории, пройденного точкой за рассматриваемый промежуток времени; <LessonInlineMath tex={String.raw`[L]=\text{м}`} />.</>} />
    <MathText text={String.raw`В процессе движения точки вдоль траектории путь изменяется. Каждому моменту времени соответствует определённое значение пути. Следовательно, путь $L$ можно определить как функцию времени:`} />
    <LessonEquation equation="path-time-law" framed parts={['L=L(t)']} />
    <PathProperties />
  </section>;
}
