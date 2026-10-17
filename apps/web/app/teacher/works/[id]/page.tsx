import { buildPageMetadata } from '@/app/page-metadata';
import TeacherWorkScreen from '@/features/teacher-works/TeacherWorkScreen';
export const metadata = buildPageMetadata('Конструктор работы', 'Состав и порядок заданий проверочной работы.');
export default async function TeacherWorkPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeacherWorkScreen id={id} />;
}
