import { buildPageMetadata } from "@/app/page-metadata";
import { redirect } from "next/navigation";

export const metadata = buildPageMetadata("Вход студента", "Переход на единый вход студента в Континуум.");

export default function StudentLoginPage() {
  redirect("/login");
}
