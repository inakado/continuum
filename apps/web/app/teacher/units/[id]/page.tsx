import TeacherUnitDetailScreen from "@/features/teacher-content/units/TeacherUnitDetailScreen";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TeacherUnitDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <TeacherUnitDetailScreen unitId={id} />;
}
