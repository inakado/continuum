import StudentSectionDetailScreen from "@/features/student-content/sections/StudentSectionDetailScreen";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudentSectionDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <StudentSectionDetailScreen sectionId={id} />;
}
