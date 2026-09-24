"use client";

import { useState } from "react";
import type { LessonArtifact } from "@continuum/shared";
import Link from "next/link";
import ContinuumHeader from "@/components/ContinuumHeader";
import { studentLibraryApi } from "./student-library.api";
import { useStudentLesson } from "./use-student-library";
import styles from "./student-library.module.css";

const artifactLabel = (type: "pdf" | "interactive" | "tasks_pdf") => {
  if (type === "interactive") return "Интерактивная лекция";
  if (type === "tasks_pdf") return "Задачи PDF";
  return "Конспект PDF";
};

function MaterialRow({ artifact }: { artifact: LessonArtifact }) {
  const [error, setError] = useState(false);
  const [opening, setOpening] = useState(false);
  const open = async () => {
    // Open synchronously so browsers do not block a tab created after the API request.
    const tab = window.open("", "_blank");
    setError(false);
    setOpening(true);
    try {
      const result = await studentLibraryApi.getArtifactView(artifact.id);
      if (tab) tab.location.replace(result.url);
      else window.location.assign(result.url);
    } catch {
      tab?.close();
      setError(true);
    } finally {
      setOpening(false);
    }
  };

  return (
    <li>
      <span>{artifactLabel(artifact.type)}</span>
      <strong>{artifact.filename}</strong>
      {artifact.type === "interactive" ? (
        <small>Интерактивная версия пока недоступна</small>
      ) : (
        <button disabled={opening} onClick={() => void open()} type="button">
          {opening ? "Открываем…" : "Открыть PDF"}
        </button>
      )}
      {error ? <small role="alert">Не удалось открыть файл. Попробуйте ещё раз.</small> : null}
    </li>
  );
}

export default function StudentLessonScreen({ lessonId }: { lessonId: string }) {
  const query = useStudentLesson(lessonId);

  return (
    <div className={styles.page}>
      <ContinuumHeader homeHref="/student" />
      <main className={styles.lessonMain}>
        {query.isPending ? <div className={styles.state}>Загружаем занятие…</div> : null}
        {query.isError ? (
          <div className={styles.state} role="alert">
            <span>Занятие недоступно или ещё не опубликовано.</span>
            <Link href="/student">К материалам</Link>
          </div>
        ) : null}
        {query.data ? (
          <>
            <div className={styles.lessonIntro}>
              <p className={styles.eyebrow}>
                <Link href="/student">Материалы</Link> / {query.data.section.title}
              </p>
              <h1>{query.data.title}</h1>
              {query.data.description ? <p>{query.data.description}</p> : null}
            </div>

            <section className={styles.materials} aria-labelledby="materials-heading">
              <div className={styles.blockHeading}>
                <h2 id="materials-heading">Материалы</h2>
                <span>{query.data.artifacts.length}</span>
              </div>
              {query.data.artifacts.length === 0 ? (
                <p className={styles.gradeEmpty}>Файлы к занятию пока не опубликованы.</p>
              ) : (
                <ul className={styles.materialList}>
                  {query.data.artifacts.map((artifact) => <MaterialRow artifact={artifact} key={artifact.id} />)}
                </ul>
              )}
            </section>

          </>
        ) : null}
      </main>
    </div>
  );
}
