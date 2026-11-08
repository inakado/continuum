import { Suspense } from "react";
import { buildPageMetadata } from "@/app/page-metadata";
import StudentInteractiveLessonScreen from "@/features/student-library/StudentInteractiveLessonScreen";

export const metadata = buildPageMetadata("Интерактивная лекция", "Текст, демонстрации и вопросы по физике.");

export default async function StudentInteractiveLessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  return <Suspense fallback={<p role="status">Загружаем лекцию…</p>}><StudentInteractiveLessonScreen lessonId={lessonId} /></Suspense>;
}
