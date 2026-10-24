import { buildPageMetadata } from '@/app/page-metadata';
import StudentWorkScreen from '@/features/student-works/StudentWorkScreen';
export const metadata = buildPageMetadata('Выполнение работы', 'Ответы на задания проверочной работы.');
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string }> }) {
  const { id } = await params;
  const { view } = await searchParams;
  return <StudentWorkScreen id={id} entry={view === 'solutions' || view === 'result' ? view : undefined} />;
}
