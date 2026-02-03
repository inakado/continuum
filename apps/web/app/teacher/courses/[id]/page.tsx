import TeacherCourseDetailScreen from "@/features/teacher-content/courses/TeacherCourseDetailScreen";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TeacherCourseDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <TeacherCourseDetailScreen courseId={id} />;
}
