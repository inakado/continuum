"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthSession } from "./useAuthSession";
import { clearAnswerDrafts } from '@/lib/assessment/answer-draft';
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
  const [previousUser, setPreviousUser] = useState<string | null>(null);
  useEffect(() => {
    if (sessionQuery.data?.user.role === requiredRole) { setPreviousUser(sessionQuery.data.user.id); clearAnswerDrafts(sessionQuery.data.user.id); }
  }, [requiredRole, sessionQuery.data]);
  const preserveWork = requiredRole === 'student' && /^\/student\/works\/[^/]+$/.test(pathname ?? '') && Boolean(previousUser);

  useEffect(() => {
    if (!allowBypass && !preserveWork && !sessionQuery.isPending && !sessionQuery.isError && !sessionQuery.data) {
      router.replace(requiredRole === 'student' && /^\/student\/works\/[^/]+$/.test(pathname ?? '') ? `/login?returnTo=${encodeURIComponent(pathname!)}` : '/login');
    }
  }, [allowBypass, pathname, preserveWork, requiredRole, router, sessionQuery.data, sessionQuery.isError, sessionQuery.isPending]);

  if (allowBypass) return <>{children}</>;

  if (sessionQuery.isPending) {
    return <div className={styles.state}>Проверка доступа…</div>;
  }

  if (sessionQuery.isError) {
    if (preserveWork) return <div key={previousUser} style={{ display: 'contents' }}>{children}</div>;
    return (
      <div className={styles.state}>
        <div className={styles.title}>Сервис временно недоступен</div>
        <div className={styles.subtitle}>Попробуйте обновить страницу.</div>
      </div>
    );
  }

  if (!sessionQuery.data) {
    if (preserveWork) return <div key={previousUser} style={{ display: 'contents' }}>{children}</div>;
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

  return <div key={sessionQuery.data.user.id} style={{ display: 'contents' }}>{children}</div>;
}
