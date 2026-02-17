import TeacherDashboardScreen from "@/features/teacher-dashboard/TeacherDashboardScreen";

type PageProps = {
  params: Promise<{ studentId: string }>;
};

export default async function TeacherStudentProfilePage({ params }: PageProps) {
  const { studentId } = await params;
  return <TeacherDashboardScreen active="students" initialStudentId={studentId} />;
}
