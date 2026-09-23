import { buildPageMetadata } from "@/app/page-metadata";
import TeacherStudentsScreen from "@/features/teacher-students/TeacherStudentsScreen";

export const metadata = buildPageMetadata("Ученики", "Учётные записи и доступ к классам.");

export default function TeacherStudentsPage() {
  return <TeacherStudentsScreen />;
}
