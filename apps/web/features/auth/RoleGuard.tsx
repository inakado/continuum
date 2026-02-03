"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import AuthRequired from "@/features/teacher-content/auth/AuthRequired";
import StudentAuthRequired from "@/features/student-content/auth/StudentAuthRequired";
import { authApi } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import styles from "./role-guard.module.css";

type RoleGuardProps = {
  requiredRole: "teacher" | "student";
  children: ReactNode;
};

type GuardState = "loading" | "unauthorized" | "forbidden" | "ok";

export default function RoleGuard({ requiredRole, children }: RoleGuardProps) {
  const pathname = usePathname();
  const [state, setState] = useState<GuardState>("loading");

  const allowBypass = useMemo(() => {
    if (!pathname) return false;
    return pathname.endsWith("/login");
  }, [pathname]);

  useEffect(() => {
    if (allowBypass) {
      setState("ok");
      return;
    }

    let mounted = true;

    const checkRole = async () => {
      try {
        const data = await authApi.me();
        if (data.user?.role !== requiredRole) {
          if (mounted) setState("forbidden");
          return;
        }
        if (mounted) setState("ok");
      } catch (err) {
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
          if (mounted) setState("unauthorized");
          return;
        }
        if (mounted) setState("unauthorized");
      }
    };

    checkRole();

    return () => {
      mounted = false;
    };
  }, [allowBypass, requiredRole]);

  if (state === "loading") {
    return <div className={styles.state}>Проверка доступа...</div>;
  }

  if (state === "unauthorized") {
    return requiredRole === "teacher" ? <AuthRequired /> : <StudentAuthRequired />;
  }

  if (state === "forbidden") {
    return (
      <div className={styles.state}>
        <div className={styles.title}>Доступ запрещён</div>
        <div className={styles.subtitle}>Роль не соответствует разделу.</div>
      </div>
    );
  }

  return <>{children}</>;
}
