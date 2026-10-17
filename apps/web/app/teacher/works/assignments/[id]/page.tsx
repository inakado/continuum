import { buildPageMetadata } from '@/app/page-metadata';
import AssignmentReportScreen from '@/features/teacher-assignments/AssignmentReportScreen';
export const metadata = buildPageMetadata('Выполнение работы', 'Состояние и результаты назначенной работы.');
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AssignmentReportScreen id={id} />;
}
