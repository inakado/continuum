"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import TeacherShell from "@/components/TeacherShell";
import EntityList, { EntityListItem } from "@/components/EntityList";
import EntityEditorInline from "@/components/EntityEditorInline";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { teacherApi, CourseWithSections, Section } from "@/lib/api/teacher";
import { getApiErrorMessage } from "../shared/api-errors";
import AuthRequired from "../auth/AuthRequired";
import { useTeacherLogout } from "../auth/use-teacher-logout";
import styles from "./teacher-course-detail.module.css";

type Props = {
  courseId: string;
};

export default function TeacherCourseDetailScreen({ courseId }: Props) {
  const handleLogout = useTeacherLogout();
  const [course, setCourse] = useState<CourseWithSections | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("");
  const [editing, setEditing] = useState<CourseWithSections | null>(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");

  const fetchCourse = useCallback(async () => {
    if (authRequired) return;
    setError(null);
    try {
      const data = await teacherApi.getCourse(courseId);
      setCourse(data);
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setError(message);
    }
  }, [authRequired, courseId]);

  useEffect(() => {
    fetchCourse();
  }, [fetchCourse]);

  const handleCreateSection = async () => {
    if (authRequired) return;
    setFormError(null);
    try {
      await teacherApi.createSection({ courseId, title: sectionTitle, sortOrder: 0 });
      setSectionTitle("");
      fetchCourse();
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setFormError(message);
    }
  };

  const handleCourseUpdate = async () => {
    if (authRequired || !editing) return;
    setFormError(null);
    try {
      await teacherApi.updateCourse(editing.id, {
        title: courseTitle,
        description: courseDescription || null,
      });
      setEditing(null);
      fetchCourse();
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setFormError(message);
    }
  };

  const handlePublishToggle = async () => {
    if (authRequired || !course) return;
    setError(null);
    try {
      if (course.status === "published") {
        await teacherApi.unpublishCourse(course.id);
      } else {
        await teacherApi.publishCourse(course.id);
      }
      fetchCourse();
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setError(message);
    }
  };

  const handleSectionPublishToggle = async (section: Section) => {
    if (authRequired) return;
    setError(null);
    try {
      if (section.status === "published") {
        await teacherApi.unpublishSection(section.id);
      } else {
        await teacherApi.publishSection(section.id);
      }
      fetchCourse();
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setError(message);
    }
  };

  const handleSectionDelete = async (section: Section) => {
    if (authRequired) return;
    const confirmed = window.confirm(
      "Удалить раздел? Удаление возможно только если в разделе нет юнитов.",
    );
    if (!confirmed) return;
    setError(null);
    try {
      await teacherApi.deleteSection(section.id);
      fetchCourse();
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setError(message);
    }
  };

  const items: EntityListItem[] =
    course?.sections.map((section) => ({
      id: section.id,
      title: section.title,
      status: section.status,
      href: `/teacher/sections/${section.id}`,
      actions: (
        <>
          <Button variant="ghost" onClick={() => handleSectionPublishToggle(section)}>
            {section.status === "published" ? "В черновик" : "Опубликовать"}
          </Button>
          <Button variant="ghost" onClick={() => handleSectionDelete(section)}>
            Удалить
          </Button>
        </>
      ),
    })) ?? [];

  if (authRequired) {
    return (
      <TeacherShell title="Курс" onLogout={handleLogout}>
        <AuthRequired />
      </TeacherShell>
    );
  }

  return (
    <TeacherShell
      title={course?.title ?? "Курс"}
      subtitle="Разделы и публикация"
      onLogout={handleLogout}
    >
      <div className={styles.topActions}>
        <Link href="/teacher">← К панели преподавателя</Link>
        {course ? (
          <Button variant="ghost" onClick={handlePublishToggle}>
            {course.status === "published" ? "Снять с публикации" : "Опубликовать"}
          </Button>
        ) : null}
        {course ? (
          <Button
            variant="ghost"
            onClick={() => {
              setEditing(course);
              setCourseTitle(course.title);
              setCourseDescription(course.description ?? "");
            }}
          >
            Редактировать курс
          </Button>
        ) : null}
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      {editing ? (
        <EntityEditorInline
          title="Редактировать курс"
          submitLabel="Сохранить"
          onSubmit={handleCourseUpdate}
          error={formError}
          disabled={!courseTitle}
        >
          <label className={styles.label}>
            Название
            <Input value={courseTitle} onChange={(event) => setCourseTitle(event.target.value)} />
          </label>
          <label className={styles.label}>
            Описание
            <Input
              value={courseDescription}
              onChange={(event) => setCourseDescription(event.target.value)}
            />
          </label>
        </EntityEditorInline>
      ) : null}

      <EntityEditorInline
        title="Новый раздел"
        description="Минимум: название"
        submitLabel="Создать"
        onSubmit={handleCreateSection}
        error={formError}
        disabled={!sectionTitle}
      >
        <label className={styles.label}>
          Название раздела
          <Input value={sectionTitle} onChange={(event) => setSectionTitle(event.target.value)} />
        </label>
      </EntityEditorInline>

      <EntityList title="Разделы" items={items} emptyLabel="Разделов пока нет" />
    </TeacherShell>
  );
}
