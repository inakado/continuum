import ContinuumHeader from '@/components/ContinuumHeader';
import LessonArticle from '@/components/interactive-lesson/authoring/LessonArticle';
import definition from './kinematics-package';
import LessonNavigation from './LessonNavigation';
import styles from './student-interactive-lesson-prototype.module.css';

// Прототип и импортируемый пакет собираются из одного авторского материала.
export default function StudentInteractiveLessonPrototype() {
  return <div className={styles.page}>
    <div className={styles.chrome} data-lesson-chrome><ContinuumHeader homeHref="/student" subject={<LessonNavigation />} /></div>
    <LessonArticle definition={definition} />
  </div>;
}
