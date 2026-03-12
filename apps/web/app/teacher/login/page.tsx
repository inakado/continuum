import { buildPageMetadata } from "@/app/page-metadata";
import { redirect } from "next/navigation";

export const metadata = buildPageMetadata("Вход преподавателя", "Переход на единый вход преподавателя в Континуум.");

export default function TeacherLoginPage() {
  redirect("/login");
}
