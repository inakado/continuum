import { notFound } from 'next/navigation';
import { buildPageMetadata } from '@/app/page-metadata';
import StudentSpeedLessonPrototype from '@/features/student-library/speed/StudentSpeedLessonPrototype';

export const metadata = {
  ...buildPageMetadata('Скорость', 'Локальный прототип интерактивного занятия КИН-02.'),
  robots: { index: false, follow: false },
};

export default function SpeedPrototypePage() {
  if (process.env.NODE_ENV !== 'development') notFound();
  return <StudentSpeedLessonPrototype />;
}
