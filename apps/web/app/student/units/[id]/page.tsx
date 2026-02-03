import StudentUnitDetailScreen from "@/features/student-content/units/StudentUnitDetailScreen";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudentUnitDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <StudentUnitDetailScreen unitId={id} />;
}
