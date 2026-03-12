import { buildPageMetadata } from "@/app/page-metadata";
import TeacherDashboardScreen from "@/features/teacher-dashboard/TeacherDashboardScreen";

type PageProps = {
  params: Promise<{ studentId: string }>;
};

export const metadata = buildPageMetadata("Профиль ученика", "Материалы, прогресс и действия по ученику.");

export default async function TeacherStudentProfilePage({ params }: PageProps) {
  const { studentId } = await params;
  return <TeacherDashboardScreen active="students" initialStudentId={studentId} />;
}
