import { buildPageMetadata } from "@/app/page-metadata";
import AppEntry from "@/features/auth/AppEntry";

export const metadata = buildPageMetadata("Перенаправление", "Вход в платформу Континуум.");

export default function Home() {
  return <AppEntry />;
}
