"use client";

import { useState } from "react";
import type { LessonArtifact } from "@continuum/shared";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, FileText } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { StudentChrome } from "@/features/student-works/StudentWorksShell";
import { gradeLabels, libraryHref } from "./library-navigation";
import { studentLibraryApi } from "./student-library.api";
import { useStudentLesson } from "./use-student-library";
import styles from "./student-library.module.css";

const artifactLabel = (type: "pdf" | "interactive" | "tasks_pdf") => {
  if (type === "interactive") return "Интерактивная лекция";
  if (type === "tasks_pdf") return "Задачи PDF";
  return "Конспект PDF";
};

function MaterialRow({ artifact, lessonTitle }: { artifact: LessonArtifact; lessonTitle: string }) {
  const [error, setError] = useState(false);
  const [opening, setOpening] = useState(false);
  const open = async () => {
    // Open synchronously so browsers do not block a tab created after the API request.
    const tab = window.open("", "_blank");
    if (tab) tab.opener = null;
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
      {artifact.type === "interactive" ? <div className={styles.unavailableMaterial}><strong>{artifactLabel(artifact.type)}</strong><small>Интерактивная версия пока недоступна</small></div> : <button className={styles.materialAction} disabled={opening} aria-label={`${artifactLabel(artifact.type)}: ${lessonTitle} (в новой вкладке)`} onClick={() => void open()} type="button">
        <FileText size={22} aria-hidden="true" /><span><strong>{opening ? "Открываем…" : artifactLabel(artifact.type)}</strong><small>Откроется в новой вкладке</small></span><ArrowUpRight size={18} aria-hidden="true" />
      </button>}
      {error ? <small role="alert">Не удалось открыть файл. Попробуйте ещё раз.</small> : null}
    </li>
  );
}

export default function StudentLessonScreen({ lessonId }: { lessonId: string }) {
  const query = useStudentLesson(lessonId);
  const params = useSearchParams();
  const backHref = libraryHref(params.get('grade') ?? query.data?.section.gradeBand ?? null, params.get('q'), lessonId);

  return (
    <div className={styles.page}>
      <StudentChrome active="materials" />
      <main className={styles.lessonMain}>
        {query.isPending ? <div className={styles.state}>Загружаем занятие…</div> : null}
        {query.isError ? (
          <div className={styles.state} role="alert">
            <span>Занятие недоступно или ещё не опубликовано.</span>
            <Link href={backHref}>К материалам</Link>
          </div>
        ) : null}
        {query.data ? (
          <>
            <Link className={styles.backLink} href={backHref}><ArrowLeft size={18} aria-hidden="true" />К занятиям</Link>
            <div className={styles.lessonIntro}>
              <p className={styles.eyebrow}>{gradeLabels[query.data.section.gradeBand]} · {query.data.section.title}</p>
              <h1>{query.data.title}</h1>
              {query.data.description ? <p>{query.data.description}</p> : null}
            </div>

            <section className={styles.materials} aria-label="Материалы занятия">
              {query.data.artifacts.length === 0 ? (
                <p className={styles.gradeEmpty}>Файлы к занятию пока не опубликованы.</p>
              ) : (
                <ul className={styles.materialList}>
                  {query.data.artifacts.map((artifact) => <MaterialRow artifact={artifact} lessonTitle={query.data!.title} key={artifact.id} />)}
                </ul>
              )}
              {query.data.artifacts.length > 0 && <details className={styles.fileDetails}><summary>Сведения о файлах</summary><ul>{query.data.artifacts.map(artifact => <li key={artifact.id}><span>{artifactLabel(artifact.type)}</span><p>{artifact.filename}</p></li>)}</ul></details>}
            </section>

          </>
        ) : null}
      </main>
    </div>
  );
}
