import { buildPageMetadata } from "@/app/page-metadata";
import StudentCoursesScreen from "@/features/student-content/courses/StudentCoursesScreen";

export const metadata = buildPageMetadata("Курсы", "Список курсов, доступных студенту.");

export default function StudentCoursesPage() {
  return <StudentCoursesScreen />;
}
