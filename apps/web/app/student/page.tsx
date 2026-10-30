import { Suspense } from "react";
import { buildPageMetadata } from "@/app/page-metadata";
import StudentLibraryScreen from "@/features/student-library/StudentLibraryScreen";

export const metadata = buildPageMetadata(
  "Библиотека",
  "Учебные материалы по физике.",
);

export default function StudentLibraryPage() {
  return <Suspense fallback={<p role="status">Загружаем материалы…</p>}><StudentLibraryScreen /></Suspense>;
}
