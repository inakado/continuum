"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import TeacherShell from "@/components/TeacherShell";
import EntityList, { EntityListItem } from "@/components/EntityList";
import EntityEditorInline from "@/components/EntityEditorInline";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { teacherApi, Course } from "@/lib/api/teacher";
import { getApiErrorMessage } from "../shared/api-errors";
import AuthRequired from "../auth/AuthRequired";
import { useTeacherLogout } from "../auth/use-teacher-logout";
import styles from "./teacher-courses.module.css";

export default function TeacherCoursesScreen() {
  const handleLogout = useTeacherLogout();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Course | null>(null);

  const fetchCourses = useCallback(async () => {
    if (authRequired) return;
    setLoading(true);
    setError(null);
    try {
      const data = await teacherApi.listCourses();
      setCourses(data);
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [authRequired]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  const handleCreate = async () => {
    if (authRequired) return;
    setFormError(null);
    try {
      await teacherApi.createCourse({ title, description: description || null });
      setTitle("");
      setDescription("");
      fetchCourses();
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setFormError(message);
    }
  };

  const handleUpdate = async () => {
    if (authRequired || !editing) return;
    setFormError(null);
    try {
      await teacherApi.updateCourse(editing.id, {
        title,
        description: description || null,
      });
      setEditing(null);
      setTitle("");
      setDescription("");
      fetchCourses();
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setFormError(message);
    }
  };

  const handlePublishToggle = async (course: Course) => {
    if (authRequired) return;
    setError(null);
    try {
      if (course.status === "published") {
        await teacherApi.unpublishCourse(course.id);
      } else {
        await teacherApi.publishCourse(course.id);
      }
      fetchCourses();
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setError(message);
    }
  };

  const handleDeleteCourse = async (course: Course) => {
    if (authRequired) return;
    const confirmed = window.confirm(
      "Удалить курс? Удаление возможно только если в курсе нет разделов.",
    );
    if (!confirmed) return;
    setError(null);
    try {
      await teacherApi.deleteCourse(course.id);
      fetchCourses();
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setError(message);
    }
  };

  const items: EntityListItem[] = courses.map((course) => ({
    id: course.id,
    title: course.title,
    status: course.status,
    href: `/teacher/courses/${course.id}`,
    meta: course.description ?? "Без описания",
    actions: (
      <>
        <Button variant="ghost" onClick={() => handlePublishToggle(course)}>
          {course.status === "published" ? "В черновик" : "Опубликовать"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setEditing(course);
            setTitle(course.title);
            setDescription(course.description ?? "");
          }}
        >
          Редактировать
        </Button>
        <Button variant="ghost" onClick={() => handleDeleteCourse(course)}>
          Удалить
        </Button>
      </>
    ),
  }));

  if (authRequired) {
    return (
      <TeacherShell title="Курсы" onLogout={handleLogout}>
        <AuthRequired />
      </TeacherShell>
    );
  }

  return (
    <TeacherShell title="Курсы" subtitle="Создай базовую структуру контента" onLogout={handleLogout}>
      {error ? <div className={styles.error}>{error}</div> : null}
      <EntityEditorInline
        title={editing ? "Редактировать курс" : "Новый курс"}
        description={editing ? "Обнови название или описание" : "Минимум: название курса"}
        submitLabel={editing ? "Сохранить" : "Создать"}
        onSubmit={editing ? handleUpdate : handleCreate}
        error={formError}
        disabled={!title}
      >
        <label className={styles.label}>
          Название
          <Input value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className={styles.label}>
          Описание
          <Input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Опционально"
          />
        </label>
      </EntityEditorInline>

      <EntityList
        title="Список курсов"
        items={items}
        emptyLabel={loading ? "Загрузка..." : "Курсов пока нет"}
      />

      <div className={styles.helper}>
        <Link href="/login">Перелогиниться</Link>
      </div>
    </TeacherShell>
  );
}
