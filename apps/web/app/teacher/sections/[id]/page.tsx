import TeacherDashboardScreen from "@/features/teacher-dashboard/TeacherDashboardScreen";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TeacherSectionDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <TeacherDashboardScreen active="edit" initialSectionId={id} />;
}
