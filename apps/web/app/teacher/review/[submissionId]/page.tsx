import { buildPageMetadata } from "@/app/page-metadata";
import TeacherDashboardScreen from "@/features/teacher-dashboard/TeacherDashboardScreen";

type PageProps = {
  params: Promise<{ submissionId: string }>;
};

export const metadata = buildPageMetadata("Проверка отправки", "Детальный просмотр фото-отправки ученика.");

export default async function TeacherReviewDetailPage({ params }: PageProps) {
  const { submissionId } = await params;
  return <TeacherDashboardScreen active="review" initialSubmissionId={submissionId} />;
}
