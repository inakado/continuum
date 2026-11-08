import type { LessonDefinition } from '@/components/interactive-lesson/authoring/lesson-definition';
import KinematicsLessonContent from './KinematicsLessonContent';
import { lessonSections } from './lesson-navigation';

const definition: LessonDefinition = {
  lessonId: 'kin-01',
  title: 'Основные понятия кинематики',
  context: '10–11 класс · Кинематика',
  articleId: 'kinematics-lesson',
  titleId: 'kinematics-title',
  sections: [...lessonSections],
  questions: [{ id: 'motion-question', revision: 1 }],
  Content: KinematicsLessonContent,
};
export default definition;
