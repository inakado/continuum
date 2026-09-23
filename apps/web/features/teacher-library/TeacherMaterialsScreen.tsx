"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import type { GradeBand, LibrarySection } from "@continuum/shared";
import Link from "next/link";
import ContinuumHeader from "@/components/ContinuumHeader";
import {
  useCreateLesson,
  useCreateSection,
  usePublishLesson,
  usePublishSection,
  useTeacherLibrary,
} from "./use-teacher-library";
import styles from "./teacher-library.module.css";

const gradeLabels: Record<GradeBand, string> = {
  grade_7: "7 класс",
  grade_8: "8 класс",
  grade_9: "9 класс",
  grade_10_11: "10–11 классы",
};

const sectionCountLabel = (count: number) => {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${count} разделов`;
  if (mod10 === 1) return `${count} раздел`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} раздела`;
  return `${count} разделов`;
};

function NewLessonForm({ sectionId }: { sectionId: string }) {
  const [title, setTitle] = useState("");
  const createLesson = useCreateLesson();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedTitle = title.trim();
    if (!normalizedTitle) return;
    createLesson.mutate(
      { sectionId, title: normalizedTitle },
      { onSuccess: () => setTitle("") },
    );
  };

  return (
    <form className={styles.lessonForm} onSubmit={submit}>
      <label className={styles.visuallyHidden} htmlFor={`lesson-${sectionId}`}>
        Название нового занятия
      </label>
      <input
        id={`lesson-${sectionId}`}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Новое занятие"
        maxLength={200}
      />
      <button disabled={createLesson.isPending || title.trim().length === 0} type="submit">
        {createLesson.isPending ? "Добавляем…" : "Добавить"}
      </button>
      {createLesson.isError ? (
        <span className={styles.formError} role="alert">Не удалось добавить занятие.</span>
      ) : null}
    </form>
  );
}

function SectionBlock({ section }: { section: LibrarySection }) {
  const publishSection = usePublishSection();
  const publishLesson = usePublishLesson();

  return (
    <article className={styles.section}>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.status}>{section.status === "published" ? "Опубликован" : "Черновик"}</span>
          <h3>{section.title}</h3>
          {section.description ? <p>{section.description}</p> : null}
        </div>
        {section.status === "draft" ? (
          <button
            className={styles.publishButton}
            disabled={publishSection.isPending}
            onClick={() => publishSection.mutate(section.id)}
            type="button"
          >
            {publishSection.isPending ? "Публикуем…" : "Опубликовать раздел"}
          </button>
        ) : null}
      </div>

      {publishSection.isError || publishLesson.isError ? (
        <p className={styles.formError} role="alert">Не удалось опубликовать. Повторите позже.</p>
      ) : null}

      <ol className={styles.lessons}>
        {section.lessons.map((lesson, index) => (
          <li key={lesson.id}>
            <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
            <span className={styles.lessonTitle}>{lesson.title}</span>
            <span className={styles.status}>{lesson.status === "published" ? "Опубликовано" : "Черновик"}</span>
            {lesson.status === "draft" ? (
              <button
                disabled={publishLesson.isPending || section.status !== "published"}
                onClick={() => publishLesson.mutate(lesson.id)}
                title={section.status === "draft" ? "Сначала опубликуйте раздел" : undefined}
                type="button"
              >
                {publishLesson.isPending ? "Публикуем…" : "Опубликовать"}
              </button>
            ) : null}
          </li>
        ))}
      </ol>
      <NewLessonForm sectionId={section.id} />
    </article>
  );
}

export default function TeacherMaterialsScreen() {
  const library = useTeacherLibrary();
  const createSection = useCreateSection();
  const [title, setTitle] = useState("");
  const [gradeBand, setGradeBand] = useState<GradeBand>("grade_10_11");

  const submitSection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedTitle = title.trim();
    if (!normalizedTitle) return;
    createSection.mutate(
      { gradeBand, title: normalizedTitle },
      { onSuccess: () => setTitle("") },
    );
  };

  return (
    <div className={styles.page}>
      <ContinuumHeader homeHref="/teacher" />
      <nav aria-label="Разделы учителя" className={styles.teacherNav}>
        <Link aria-current="page" href="/teacher/materials">Материалы</Link>
        <Link href="/teacher/students">Ученики и доступы</Link>
      </nav>
      <main className={styles.main}>
        <div className={styles.intro}>
          <h1>Разделы и занятия</h1>
          <p>Структура библиотеки и публикация готовых материалов.</p>
        </div>

        <form className={styles.sectionForm} onSubmit={submitSection}>
          <select
            aria-label="Класс"
            value={gradeBand}
            onChange={(event) => setGradeBand(event.target.value as GradeBand)}
          >
            {Object.entries(gradeLabels).map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
          <label className={styles.visuallyHidden} htmlFor="section-title">
            Название раздела
          </label>
          <input
            id="section-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Например, Механика"
            maxLength={160}
          />
          <button disabled={createSection.isPending || title.trim().length === 0} type="submit">
            {createSection.isPending ? "Создаём…" : "Создать раздел"}
          </button>
        </form>

        {createSection.isError ? (
          <p className={styles.formError} role="alert">Не удалось создать раздел.</p>
        ) : null}

        {library.isPending ? <div className={styles.state}>Загружаем материалы…</div> : null}
        {library.isError ? (
          <div className={styles.state} role="alert">
            <span>Не удалось загрузить материалы.</span>
            <button onClick={() => void library.refetch()} type="button">Повторить</button>
          </div>
        ) : null}
        {library.data ? (
          <div className={styles.catalog}>
            {library.data.gradeBands.map((band) => (
              <section className={styles.grade} key={band.code}>
                <div className={styles.gradeHeading}>
                  <h2>{gradeLabels[band.code]}</h2>
                  <span>{sectionCountLabel(band.sections.length)}</span>
                </div>
                <div className={styles.sections}>
                  {band.sections.length === 0 ? (
                    <p className={styles.empty}>Разделов пока нет.</p>
                  ) : (
                    band.sections.map((section) => <SectionBlock key={section.id} section={section} />)
                  )}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </main>
    </div>
  );
}
