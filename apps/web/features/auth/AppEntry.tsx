"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthSession } from "./useAuthSession";
import styles from "./role-guard.module.css";

export default function AppEntry() {
  const router = useRouter();
  const session = useAuthSession();

  useEffect(() => {
    if (!session.isPending && !session.isError) {
      router.replace(session.data ? `/${session.data.user.role}` : "/login");
    }
  }, [router, session.data, session.isError, session.isPending]);

  if (session.isError) {
    return <div className={styles.state}><div>
      <h1 className={styles.title}>Сервис временно недоступен</h1>
      <p className={styles.subtitle}>Проверьте подключение и повторите.</p>
      <button className={styles.retry} type="button" onClick={() => { void session.refetch(); }}>Повторить</button>
    </div></div>;
  }

  return <div className={styles.state} role="status">Открываем Континуум…</div>;
}
