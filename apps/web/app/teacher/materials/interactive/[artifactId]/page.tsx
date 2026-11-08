import { buildPageMetadata } from "@/app/page-metadata";
import TeacherInteractiveLessonScreen from "@/features/teacher-library/TeacherInteractiveLessonScreen";

export const metadata = buildPageMetadata("Предпросмотр лекции", "Интерактивный материал занятия.");

export default async function TeacherInteractiveLessonPage({ params }: { params: Promise<{ artifactId: string }> }) {
  const { artifactId } = await params;
  return <TeacherInteractiveLessonScreen artifactId={artifactId} />;
}
