import { buildPageMetadata } from '@/app/page-metadata';
import TeacherWorkPreviewScreen from '@/features/teacher-assignments/TeacherWorkPreviewScreen';
export const metadata = buildPageMetadata('Просмотр работы', 'Условия выбранной редакции без ключей ответов.');
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ version?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const number = Number(query.version);
  return <TeacherWorkPreviewScreen workId={id} version={Number.isSafeInteger(number) && number > 0 ? number : undefined} />;
}
