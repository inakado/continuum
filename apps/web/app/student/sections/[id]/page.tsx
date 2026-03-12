import { buildPageMetadata } from "@/app/page-metadata";
import StudentSectionDetailScreen from "@/features/student-content/sections/StudentSectionDetailScreen";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const metadata = buildPageMetadata("Раздел", "Страница раздела студента с прогрессом и навигацией.");

export default async function StudentSectionDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <StudentSectionDetailScreen sectionId={id} />;
}
