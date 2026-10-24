import { buildPageMetadata } from '@/app/page-metadata';
import StatisticsReportScreen from '@/features/teacher-statistics/StatisticsReportScreen';
export const metadata = buildPageMetadata('Статистика работы', 'Распределение учеников по баллам и результаты классов.');
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StatisticsReportScreen id={id} />;
}
