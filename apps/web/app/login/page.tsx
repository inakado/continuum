import { buildPageMetadata } from "@/app/page-metadata";
import UnifiedLoginScreen from "@/features/auth/UnifiedLoginScreen";

export const metadata = buildPageMetadata("Вход", "Единая страница входа для студентов и преподавателей.");

export default function LoginPage() {
  return <UnifiedLoginScreen />;
}
