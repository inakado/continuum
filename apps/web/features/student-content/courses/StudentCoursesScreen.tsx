"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import StudentShell from "@/components/StudentShell";
import EntityList, { EntityListItem } from "@/components/EntityList";
import Button from "@/components/ui/Button";
import { studentApi, Course } from "@/lib/api/student";
import { getStudentErrorMessage } from "../shared/student-errors";
import StudentAuthRequired from "../auth/StudentAuthRequired";
import { useStudentLogout } from "../auth/use-student-logout";
import styles from "./student-courses.module.css";

export default function StudentCoursesScreen() {
  const handleLogout = useStudentLogout();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const fetchCourses = useCallback(async () => {
    if (authRequired) return;
    setLoading(true);
    setError(null);
    try {
      const data = await studentApi.listCourses();
      setCourses(data);
    } catch (err) {
      const message = getStudentErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [authRequired]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const items: EntityListItem[] = courses.map((course) => ({
    id: course.id,
    title: course.title,
    meta: course.description ?? "Без описания",
    href: `/student/courses/${course.id}`,
    actions: (
      <Link href={`/student/courses/${course.id}`}>
        <Button variant="ghost">Открыть</Button>
      </Link>
    ),
  }));

  if (authRequired) {
    return (
      <StudentShell title="Курсы" onLogout={handleLogout}>
        <StudentAuthRequired />
      </StudentShell>
    );
  }

  return (
    <StudentShell title="Курсы" subtitle="Опубликованные курсы" onLogout={handleLogout}>
      {error ? <div className={styles.error}>{error}</div> : null}
      <EntityList
        title="Список курсов"
        items={items}
        emptyLabel={loading ? "Загрузка..." : "Курсов пока нет"}
      />
    </StudentShell>
  );
}
