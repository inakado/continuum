"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import TeacherShell from "@/components/TeacherShell";
import { teacherApi } from "@/lib/api/teacher";
import { contentQueryKeys } from "@/lib/query/keys";
import AuthRequired from "../auth/AuthRequired";
import { useTeacherLogout } from "../auth/use-teacher-logout";
import { getApiErrorMessage } from "../shared/api-errors";
import styles from "./teacher-events.module.css";

const TEACHER_EVENTS_QUERY = {
  category: "admin" as const,
  limit: 50,
  offset: 0,
};

export default function TeacherEventsScreen() {
  const handleLogout = useTeacherLogout();
  const eventsQuery = useQuery({
    queryKey: contentQueryKeys.teacherEvents(TEACHER_EVENTS_QUERY),
    queryFn: () => teacherApi.listEvents(TEACHER_EVENTS_QUERY),
  });
  const events = eventsQuery.data?.items ?? [];
  const error = eventsQuery.error ? getApiErrorMessage(eventsQuery.error) : null;
  const authRequired = error === "Перелогиньтесь";

  const rows = useMemo(() => {
    return events.map((event) => {
      const when = new Date(event.occurredAt).toLocaleString("ru-RU");
      const actor = event.actorUser?.login ?? event.actorUserId ?? "система";
      const entity = `${event.entityType}:${event.entityId}`;
      const payloadText = JSON.stringify(event.payload ?? {});
      const payload =
        payloadText.length > 140 ? `${payloadText.slice(0, 140).trimEnd()}…` : payloadText;
      return { ...event, when, actor, entity, payload };
    });
  }, [events]);

  if (authRequired) {
    return (
      <TeacherShell title="События" subtitle="Журнал действий" onLogout={handleLogout}>
        <AuthRequired />
      </TeacherShell>
    );
  }

  return (
    <TeacherShell title="События" subtitle="Журнал действий по контенту" onLogout={handleLogout}>
      {error ? (
        <div className={styles.error} role="status" aria-live="polite">
          {error}
        </div>
      ) : null}
      <div className={styles.tableWrap}>
        <table className={styles.table} aria-busy={eventsQuery.isLoading}>
          <thead>
            <tr className={`${styles.row} ${styles.header}`}>
              <th scope="col">Когда</th>
              <th scope="col">Событие</th>
              <th scope="col">Кто</th>
              <th scope="col">Сущность</th>
              <th scope="col">Данные</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={styles.row}>
                <td>{row.when}</td>
                <td>{row.eventType}</td>
                <td>{row.actor}</td>
                <td className={styles.mono}>{row.entity}</td>
                <td className={styles.payload}>{row.payload}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {eventsQuery.isLoading ? <div className={styles.loading}>Загрузка…</div> : null}
      {!eventsQuery.isLoading && rows.length === 0 ? (
        <div className={styles.empty}>Событий пока нет</div>
      ) : null}
    </TeacherShell>
  );
}
