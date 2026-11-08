import PrototypeReadingQuestion from './PrototypeReadingQuestion';
import MechanicalMotionDemo from './MechanicalMotionDemo';
import PointPositionDemo from './PointPositionDemo';
import MaterialPointDemo from './MaterialPointDemo';
import RadiusVectorTheory from './RadiusVectorTheory';
import MotionLawTheory from './MotionLawTheory';
import TrajectoryTheory from './TrajectoryTheory';
import DisplacementTheory from './DisplacementTheory';
import { DemoReference } from './LessonDemonstration';
import styles from './student-interactive-lesson-prototype.module.css';

export default function KinematicsLessonContent() {
  return (
          <div className={styles.text}>
            <p id="kinematics-intro" tabIndex={-1}><em>Механическим движением</em> называется изменение положения тела относительно других тел с течением времени. <em>Механика</em> изучает законы механического движения. Основными разделами механики являются <em>кинематика</em>, которая описывает движение тел, и <em>динамика</em>, которая объясняет его причины.</p>
            <PrototypeReadingQuestion />
            <p id="reference-frame-text" data-lesson-section><em>Основная задача механики</em> состоит в том, чтобы определить положение тела в любой момент времени. Чтобы решить эту задачу, сначала выбирают <em>систему отсчета</em>, состоящую из <em>тела отсчета</em>, связанной с ним <em>системы координат</em> и <em>часов</em> (<DemoReference demo="reference" />).</p>
            <MechanicalMotionDemo />
            <p id="material-point-text" data-lesson-section>Если в условиях задачи размерами и формой тела можно пренебречь, его заменяют моделью — <em>материальной точкой</em>, которую для краткости будем называть просто точкой (<DemoReference demo="material" />).</p>
            <MaterialPointDemo />
            <p>Для описания движения точки необходимо ввести несколько основных <em>кинематических величин и понятий</em>. В этом параграфе рассматриваются <em>радиус-вектор</em> точки, <em>траектория</em>, <em>путь</em> и <em>перемещение</em>.</p>
            <PointPositionDemo />
            <RadiusVectorTheory />
            <MotionLawTheory />
            <TrajectoryTheory />
            <DisplacementTheory />
          </div>
  );
}
