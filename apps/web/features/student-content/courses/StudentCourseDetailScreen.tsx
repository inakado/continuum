"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import StudentShell from "@/components/StudentShell";
import EntityList, { EntityListItem } from "@/components/EntityList";
import Button from "@/components/ui/Button";
import { studentApi, CourseWithSections, Section } from "@/lib/api/student";
import { getStudentErrorMessage } from "../shared/student-errors";
import StudentAuthRequired from "../auth/StudentAuthRequired";
import StudentNotFound from "../shared/StudentNotFound";
import { useStudentLogout } from "../auth/use-student-logout";
import styles from "./student-course-detail.module.css";

type Props = {
  courseId: string;
};

export default function StudentCourseDetailScreen({ courseId }: Props) {
  const handleLogout = useStudentLogout();
  const [course, setCourse] = useState<CourseWithSections | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const fetchCourse = useCallback(async () => {
    if (authRequired) return;
    setError(null);
    setNotFound(false);
    try {
      const data = await studentApi.getCourse(courseId);
      setCourse(data);
    } catch (err) {
      const message = getStudentErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      if (message === "Не найдено или недоступно") setNotFound(true);
      setError(message);
    }
  }, [authRequired, courseId]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  const items: EntityListItem[] =
    course?.sections.map((section: Section) => ({
      id: section.id,
      title: section.title,
      href: `/student/sections/${section.id}`,
      actions: (
        <Link href={`/student/sections/${section.id}`}>
          <Button variant="ghost">Открыть</Button>
        </Link>
      ),
    })) ?? [];

  if (authRequired) {
    return (
      <StudentShell title="Курс" onLogout={handleLogout}>
        <StudentAuthRequired />
      </StudentShell>
    );
  }

  return (
    <StudentShell title={course?.title ?? "Курс"} subtitle="Опубликованные разделы" onLogout={handleLogout}>
      <div className={styles.topActions}>
        <Link href="/student/courses">← Все курсы</Link>
      </div>

      {course?.description ? (
        <div className={styles.description}>{course.description}</div>
      ) : null}

      {notFound ? <StudentNotFound /> : null}
      {error && !notFound ? <div className={styles.error}>{error}</div> : null}

      <EntityList title="Разделы" items={items} emptyLabel="Разделов пока нет" />
    </StudentShell>
  );
}
