"use client";

import RoleGuard from "@/features/auth/RoleGuard";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard requiredRole="student">{children}</RoleGuard>;
}
