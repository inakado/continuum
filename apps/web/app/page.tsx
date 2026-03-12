import { buildPageMetadata } from "@/app/page-metadata";
import { redirect } from "next/navigation";

export const metadata = buildPageMetadata("Перенаправление", "Вход в платформу Континуум.");

export default function Home() {
  redirect("/login");
}
