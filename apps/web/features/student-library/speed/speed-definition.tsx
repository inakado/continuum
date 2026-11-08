import type { LessonDefinition } from '@/components/interactive-lesson/authoring/lesson-definition';
import SpeedLessonContent from './SpeedLessonContent';

const definition: LessonDefinition = {
  lessonId: 'kin-02',
  title: 'Скорость',
  context: '10–11 класс · Кинематика',
  articleId: 'kin02-lesson',
  titleId: 'kin02-title',
  sections: [
    { id: 'kin02-title', title: 'Скорость' },
    { id: 'kin02-average', title: 'Средняя по перемещению скорость' },
    { id: 'kin02-instantaneous', title: 'Мгновенная скорость' },
    { id: 'kin02-projections', title: 'Знак проекции скорости' },
    { id: 'kin02-classification', title: 'Классификация движения' },
    { id: 'kin02-path', title: 'Средняя путевая скорость' },
    { id: 'kin02-instantaneous-path', title: 'Мгновенная путевая скорость' },
    { id: 'kin02-return', title: 'Движение туда и обратно' },
  ],
  questions: [],
  Content: SpeedLessonContent,
};

export default definition;
