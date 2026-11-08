import { notFound } from 'next/navigation';
import { buildPageMetadata } from '@/app/page-metadata';
import StudentInteractiveLessonPrototype from '@/features/student-library/StudentInteractiveLessonPrototype';

export const metadata = {
  ...buildPageMetadata('Основные понятия кинематики', 'Локальный прототип интерактивного занятия.'),
  robots: { index: false, follow: false },
};

export default function KinematicsPrototypePage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <StudentInteractiveLessonPrototype />;
}
