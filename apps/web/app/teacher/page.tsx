import { buildPageMetadata } from "@/app/page-metadata";
import { redirect } from "next/navigation";

export const metadata = buildPageMetadata("Материалы", "Разделы и занятия библиотеки.");

export default function TeacherLibraryPage() {
  redirect("/teacher/materials");
}
