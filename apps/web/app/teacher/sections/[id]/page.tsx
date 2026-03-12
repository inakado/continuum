import { buildPageMetadata } from "@/app/page-metadata";
import TeacherDashboardScreen from "@/features/teacher-dashboard/TeacherDashboardScreen";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const metadata = buildPageMetadata("Раздел курса", "Редактирование раздела и графа юнитов.");

export default async function TeacherSectionDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <TeacherDashboardScreen active="edit" initialSectionId={id} />;
}
