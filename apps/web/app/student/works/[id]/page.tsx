import { buildPageMetadata } from '@/app/page-metadata';
import StudentWorkScreen from '@/features/student-works/StudentWorkScreen';
export const metadata = buildPageMetadata('Выполнение работы', 'Ответы на задания проверочной работы.');
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StudentWorkScreen id={id} />;
}
