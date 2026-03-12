import { buildPageMetadata } from "@/app/page-metadata";
import TeacherUnitDetailScreen from "@/features/teacher-content/units/TeacherUnitDetailScreen";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const metadata = buildPageMetadata("Юнит курса", "Редактирование материалов и задач юнита.");

export default async function TeacherUnitDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <TeacherUnitDetailScreen unitId={id} />;
}
