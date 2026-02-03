"use client";

import RoleGuard from "@/features/auth/RoleGuard";

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard requiredRole="teacher">{children}</RoleGuard>;
}
