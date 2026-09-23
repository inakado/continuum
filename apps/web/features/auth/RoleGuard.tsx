"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthSession } from "./useAuthSession";
import styles from "./role-guard.module.css";

type RoleGuardProps = {
  requiredRole: "admin" | "teacher" | "student";
  children: ReactNode;
};

export default function RoleGuard({ requiredRole, children }: RoleGuardProps) {
  const pathname = usePathname();
  const router = useRouter();

  const allowBypass = useMemo(() => {
    if (!pathname) return false;
    return pathname.endsWith("/login");
  }, [pathname]);
  const sessionQuery = useAuthSession(!allowBypass);

  useEffect(() => {
    if (!allowBypass && !sessionQuery.isPending && !sessionQuery.isError && !sessionQuery.data) {
      router.replace("/login");
    }
  }, [allowBypass, router, sessionQuery.data, sessionQuery.isError, sessionQuery.isPending]);

  if (allowBypass) return <>{children}</>;

  if (sessionQuery.isPending) {
    return <div className={styles.state}>Проверка доступа…</div>;
  }

  if (sessionQuery.isError) {
    return (
      <div className={styles.state}>
        <div className={styles.title}>Сервис временно недоступен</div>
        <div className={styles.subtitle}>Попробуйте обновить страницу.</div>
      </div>
    );
  }

  if (!sessionQuery.data) {
    return <div className={styles.state}>Переход ко входу…</div>;
  }

  if (sessionQuery.data.user.role !== requiredRole) {
    return (
      <div className={styles.state}>
        <div className={styles.title}>Раздел недоступен</div>
        <div className={styles.subtitle}>Он не входит в вашу учётную запись.</div>
      </div>
    );
  }

  return <>{children}</>;
}
