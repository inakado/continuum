import { buildPageMetadata } from "@/app/page-metadata";
import StudentCourseDetailScreen from "@/features/student-content/courses/StudentCourseDetailScreen";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const metadata = buildPageMetadata("Курс", "Страница курса студента с доступными разделами.");

export default async function StudentCourseDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <StudentCourseDetailScreen courseId={id} />;
}
