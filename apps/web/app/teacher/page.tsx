import { buildPageMetadata } from "@/app/page-metadata";
import TeacherDashboardScreen from "@/features/teacher-dashboard/TeacherDashboardScreen";

export const metadata = buildPageMetadata("Консоль преподавателя", "Главный teacher dashboard для управления курсами.");

export default function TeacherDashboardPage() {
  return <TeacherDashboardScreen active="edit" />;
}
