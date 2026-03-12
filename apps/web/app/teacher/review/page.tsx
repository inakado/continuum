import { buildPageMetadata } from "@/app/page-metadata";
import TeacherDashboardScreen from "@/features/teacher-dashboard/TeacherDashboardScreen";

export const metadata = buildPageMetadata("Проверка фото", "Очередь фото-ответов на проверку.");

export default function TeacherReviewPage() {
  return <TeacherDashboardScreen active="review" />;
}
