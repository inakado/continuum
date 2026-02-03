"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import StudentShell from "@/components/StudentShell";
import EntityList, { EntityListItem } from "@/components/EntityList";
import { studentApi, UnitWithTasks, Task } from "@/lib/api/student";
import { getStudentErrorMessage } from "../shared/student-errors";
import StudentAuthRequired from "../auth/StudentAuthRequired";
import StudentNotFound from "../shared/StudentNotFound";
import { useStudentLogout } from "../auth/use-student-logout";
import styles from "./student-unit-detail.module.css";

type Props = {
  unitId: string;
};

export default function StudentUnitDetailScreen({ unitId }: Props) {
  const handleLogout = useStudentLogout();
  const [unit, setUnit] = useState<UnitWithTasks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const fetchUnit = useCallback(async () => {
    if (authRequired) return;
    setError(null);
    setNotFound(false);
    try {
      const data = await studentApi.getUnit(unitId);
      setUnit(data);
    } catch (err) {
      const message = getStudentErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      if (message === "Не найдено или недоступно") setNotFound(true);
      setError(message);
    }
  }, [authRequired, unitId]);

  useEffect(() => {
    fetchUnit();
  }, [fetchUnit]);

  const taskItems: EntityListItem[] =
    unit?.tasks.map((task: Task) => ({
      id: task.id,
      title: task.title ?? "Задача",
      meta: task.statementLite,
    })) ?? [];

  if (authRequired) {
    return (
      <StudentShell title="Юнит" onLogout={handleLogout}>
        <StudentAuthRequired />
      </StudentShell>
    );
  }

  return (
    <StudentShell title={unit?.title ?? "Юнит"} subtitle="Опубликованные задачи" onLogout={handleLogout}>
      <div className={styles.topActions}>
        <Link href="/student/courses">← Все курсы</Link>
      </div>

      {notFound ? <StudentNotFound /> : null}
      {error && !notFound ? <div className={styles.error}>{error}</div> : null}

      <EntityList title="Задачи" items={taskItems} emptyLabel="Задач пока нет" />
    </StudentShell>
  );
}
