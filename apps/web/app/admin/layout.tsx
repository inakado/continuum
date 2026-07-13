import type { ReactNode } from "react";
import RoleGuard from "@/features/auth/RoleGuard";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <RoleGuard requiredRole="admin">{children}</RoleGuard>;
}
