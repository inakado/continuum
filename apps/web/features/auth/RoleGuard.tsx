"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { usePathname } from "next/navigation";
import AuthRequired from "@/features/teacher-content/auth/AuthRequired";
import StudentAuthRequired from "@/features/student-content/auth/StudentAuthRequired";
import { useAuthSession } from "./useAuthSession";
import styles from "./role-guard.module.css";

type RoleGuardProps = {
  requiredRole: "admin" | "teacher" | "student";
  children: ReactNode;
};

export default function RoleGuard({ requiredRole, children }: RoleGuardProps) {
  const pathname = usePathname();

  const allowBypass = useMemo(() => {
    if (!pathname) return false;
    return pathname.endsWith("/login");
  }, [pathname]);
  const sessionQuery = useAuthSession(!allowBypass);

  if (allowBypass) return <>{children}</>;

  if (sessionQuery.isPending) {
    return <div className={styles.state}>Проверка доступа…</div>;
  }

  if (sessionQuery.isError) {
    return (
      <div className={styles.state}>
        <div className={styles.title}>Сервис временно недоступен</div>
        <div className={styles.subtitle}>Не удалось проверить доступ. Попробуйте ещё раз.</div>
      </div>
    );
  }

  if (!sessionQuery.data) {
    return requiredRole === "student" ? <StudentAuthRequired /> : <AuthRequired />;
  }

  if (sessionQuery.data.user.role !== requiredRole) {
    return (
      <div className={styles.state}>
        <div className={styles.title}>Доступ запрещён</div>
        <div className={styles.subtitle}>Роль не соответствует разделу.</div>
      </div>
    );
  }

  return <>{children}</>;
}
