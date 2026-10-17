import { buildPageMetadata } from '@/app/page-metadata';
import TeacherWorksScreen from '@/features/teacher-works/TeacherWorksScreen';
export const metadata = buildPageMetadata('Работы', 'Создание проверочных работ из банка заданий.');
export default function TeacherWorksPage() { return <TeacherWorksScreen />; }
