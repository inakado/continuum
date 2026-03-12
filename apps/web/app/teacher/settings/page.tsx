import { buildPageMetadata } from "@/app/page-metadata";
import TeacherSettingsScreen from "@/features/teacher-settings/TeacherSettingsScreen";

export const metadata = buildPageMetadata("Настройки", "Настройки профиля преподавателя и рабочей среды.");

export default function TeacherSettingsPage() {
  return <TeacherSettingsScreen />;
}
