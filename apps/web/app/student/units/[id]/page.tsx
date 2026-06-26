import { buildPageMetadata } from "@/app/page-metadata";
import StudentUnitDetailScreen from "@/features/student-content/units/StudentUnitDetailScreen";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ taskId?: string }>;
};

export const metadata = buildPageMetadata("Юнит", "Страница юнита студента с материалами и заданиями.");

export default async function StudentUnitDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { taskId } = await searchParams;
  return <StudentUnitDetailScreen unitId={id} focusTaskId={taskId ?? null} />;
}
