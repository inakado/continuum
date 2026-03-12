import { buildPageMetadata } from "@/app/page-metadata";
import TeacherEventsScreen from "@/features/teacher-content/events/TeacherEventsScreen";

export const metadata = buildPageMetadata("События", "Журнал событий и действий преподавателя.");

export default function TeacherEventsPage() {
  return <TeacherEventsScreen />;
}
