import { buildPageMetadata } from "@/app/page-metadata";
import StudentLibraryScreen from "@/features/student-library/StudentLibraryScreen";

export const metadata = buildPageMetadata(
  "Библиотека",
  "Учебные материалы по физике.",
);

export default function StudentLibraryPage() {
  return <StudentLibraryScreen />;
}
