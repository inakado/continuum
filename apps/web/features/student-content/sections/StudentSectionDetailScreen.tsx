"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import StudentShell from "@/components/StudentShell";
import EntityList, { EntityListItem } from "@/components/EntityList";
import Button from "@/components/ui/Button";
import { studentApi, SectionWithUnits, Unit } from "@/lib/api/student";
import { getStudentErrorMessage } from "../shared/student-errors";
import StudentAuthRequired from "../auth/StudentAuthRequired";
import StudentNotFound from "../shared/StudentNotFound";
import { useStudentLogout } from "../auth/use-student-logout";
import styles from "./student-section-detail.module.css";

type Props = {
  sectionId: string;
};

export default function StudentSectionDetailScreen({ sectionId }: Props) {
  const handleLogout = useStudentLogout();
  const [section, setSection] = useState<SectionWithUnits | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const fetchSection = useCallback(async () => {
    if (authRequired) return;
    setError(null);
    setNotFound(false);
    try {
      const data = await studentApi.getSection(sectionId);
      setSection(data);
    } catch (err) {
      const message = getStudentErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      if (message === "Не найдено или недоступно") setNotFound(true);
      setError(message);
    }
  }, [authRequired, sectionId]);

  useEffect(() => {
    fetchSection();
  }, [fetchSection]);

  const items: EntityListItem[] =
    section?.units.map((unit: Unit) => ({
      id: unit.id,
      title: unit.title,
      href: `/student/units/${unit.id}`,
      actions: (
        <Link href={`/student/units/${unit.id}`}>
          <Button variant="ghost">Открыть</Button>
        </Link>
      ),
    })) ?? [];

  if (authRequired) {
    return (
      <StudentShell title="Раздел" onLogout={handleLogout}>
        <StudentAuthRequired />
      </StudentShell>
    );
  }

  return (
    <StudentShell title={section?.title ?? "Раздел"} subtitle="Опубликованные юниты" onLogout={handleLogout}>
      <div className={styles.topActions}>
        <Link href="/student/courses">← Все курсы</Link>
      </div>

      {notFound ? <StudentNotFound /> : null}
      {error && !notFound ? <div className={styles.error}>{error}</div> : null}

      <EntityList title="Юниты" items={items} emptyLabel="Юнитов пока нет" />
    </StudentShell>
  );
}
