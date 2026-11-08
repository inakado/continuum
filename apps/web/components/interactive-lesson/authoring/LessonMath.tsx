import AssessmentMarkdown from '@/components/assessment/AssessmentMarkdown';
import styles from './lesson-theory.module.css';

export default function LessonMath({ text }: { text: string }) {
  return <div className={styles.math}><AssessmentMarkdown text={text} images={{}} /></div>;
}
