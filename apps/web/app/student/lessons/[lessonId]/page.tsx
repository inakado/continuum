import { buildPageMetadata } from "@/app/page-metadata";
import StudentLessonScreen from "@/features/student-library/StudentLessonScreen";

export const metadata = buildPageMetadata("Занятие", "Материалы занятия по физике.");

export default async function StudentLessonPage({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  return <StudentLessonScreen lessonId={lessonId} />;
}
