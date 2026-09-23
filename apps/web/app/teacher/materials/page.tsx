import { buildPageMetadata } from "@/app/page-metadata";
import TeacherMaterialsScreen from "@/features/teacher-library/TeacherMaterialsScreen";

export const metadata = buildPageMetadata("Материалы", "Разделы и занятия библиотеки.");

export default function TeacherMaterialsPage() {
  return <TeacherMaterialsScreen />;
}
