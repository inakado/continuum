import { buildPageMetadata } from "@/app/page-metadata";
import StudentUnitDetailScreen from "@/features/student-content/units/StudentUnitDetailScreen";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const metadata = buildPageMetadata("Юнит", "Страница юнита студента с материалами и заданиями.");

export default async function StudentUnitDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <StudentUnitDetailScreen unitId={id} />;
}
