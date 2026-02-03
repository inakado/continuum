import TeacherSectionDetailScreen from "@/features/teacher-content/sections/TeacherSectionDetailScreen";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TeacherSectionDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <TeacherSectionDetailScreen sectionId={id} />;
}
