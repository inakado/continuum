import { buildPageMetadata } from "@/app/page-metadata";
import TeacherDashboardScreen from "@/features/teacher-dashboard/TeacherDashboardScreen";

export const metadata = buildPageMetadata("Аналитика", "Раздел аналитики преподавателя.");

export default function TeacherAnalyticsPage() {
  return <TeacherDashboardScreen active="analytics" />;
}
