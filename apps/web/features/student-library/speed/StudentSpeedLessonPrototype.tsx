import ContinuumHeader from '@/components/ContinuumHeader';
import LessonArticle from '@/components/interactive-lesson/authoring/LessonArticle';
import LessonNavigation from '../LessonNavigation';
import styles from '../student-interactive-lesson-prototype.module.css';
import definition from './speed-definition';

export default function StudentSpeedLessonPrototype() {
  return <div className={styles.page}>
    <div className={styles.chrome} data-lesson-chrome><ContinuumHeader homeHref="/student" subject={<LessonNavigation sections={definition.sections} title={definition.title} articleId={definition.articleId} />} /></div>
    <LessonArticle definition={definition} />
  </div>;
}
