import StudentCourseDetailScreen from "@/features/student-content/courses/StudentCourseDetailScreen";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudentCourseDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <StudentCourseDetailScreen courseId={id} />;
}
