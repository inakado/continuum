import { buildPageMetadata } from '@/app/page-metadata';
import WorkAssignmentScreen from '@/features/teacher-assignments/WorkAssignmentScreen';
export const metadata = buildPageMetadata('Назначить работу', 'Выбор классов и получателей проверочной работы.');
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ version?: string; add?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const number = Number(query.version);
  return <WorkAssignmentScreen workId={id} initialVersion={Number.isSafeInteger(number) && number > 0 ? number : undefined} addOnly={query.add === '1'} />;
}
