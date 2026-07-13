import { buildPageMetadata } from "@/app/page-metadata";
import AdminTeachersScreen from "@/features/admin-users/AdminTeachersScreen";

export const metadata = buildPageMetadata(
  "Администрирование",
  "Управление учетными записями преподавателей.",
);

export default function AdminTeachersPage() {
  return <AdminTeachersScreen />;
}
