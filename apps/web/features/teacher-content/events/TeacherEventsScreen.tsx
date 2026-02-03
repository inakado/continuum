"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TeacherShell from "@/components/TeacherShell";
import { teacherApi, EventLog } from "@/lib/api/teacher";
import AuthRequired from "../auth/AuthRequired";
import { useTeacherLogout } from "../auth/use-teacher-logout";
import { getApiErrorMessage } from "../shared/api-errors";
import styles from "./teacher-events.module.css";

export default function TeacherEventsScreen() {
  const handleLogout = useTeacherLogout();
  const [events, setEvents] = useState<EventLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const fetchEvents = useCallback(async () => {
    if (authRequired) return;
    setLoading(true);
    setError(null);
    try {
      const data = await teacherApi.listEvents({ category: "admin", limit: 50, offset: 0 });
      setEvents(data.items);
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [authRequired]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const rows = useMemo(() => {
    return events.map((event) => {
      const when = new Date(event.occurredAt).toLocaleString("ru-RU");
      const actor = event.actorUser?.login ?? event.actorUserId ?? "system";
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
      {error ? <div className={styles.error}>{error}</div> : null}
      <div className={styles.table}>
        <div className={`${styles.row} ${styles.header}`}>
          <div>Когда</div>
          <div>Событие</div>
          <div>Actor</div>
          <div>Entity</div>
          <div>Payload</div>
        </div>
        {rows.map((row) => (
          <div key={row.id} className={styles.row}>
            <div>{row.when}</div>
            <div>{row.eventType}</div>
            <div>{row.actor}</div>
            <div className={styles.mono}>{row.entity}</div>
            <div className={styles.payload}>{row.payload}</div>
          </div>
        ))}
      </div>
      {loading ? <div className={styles.loading}>Загрузка...</div> : null}
      {!loading && rows.length === 0 ? (
        <div className={styles.empty}>Событий пока нет</div>
      ) : null}
    </TeacherShell>
  );
}
