import TeacherDashboardScreen from "@/features/teacher-dashboard/TeacherDashboardScreen";

type PageProps = {
  params: Promise<{ submissionId: string }>;
};

export default async function TeacherReviewDetailPage({ params }: PageProps) {
  const { submissionId } = await params;
  return <TeacherDashboardScreen active="review" initialSubmissionId={submissionId} />;
}
