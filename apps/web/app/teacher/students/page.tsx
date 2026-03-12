import { buildPageMetadata } from "@/app/page-metadata";
import TeacherDashboardScreen from "@/features/teacher-dashboard/TeacherDashboardScreen";

export const metadata = buildPageMetadata("Ученики", "Список учеников и доступ к их профилям.");

export default function TeacherStudentsPage() {
  return <TeacherDashboardScreen active="students" />;
}
