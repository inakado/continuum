"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import InteractiveLessonPlayer from "@/components/interactive-lesson/InteractiveLessonPlayer";
import { useAuthSession } from "@/features/auth/useAuthSession";
import { StudentChrome } from "@/features/student-works/StudentWorksShell";
import { libraryParams } from "./library-navigation";
import { useStudentInteractiveArtifact, useStudentLesson } from "./use-student-library";
import styles from "./student-library.module.css";

export default function StudentInteractiveLessonScreen({ lessonId }: { lessonId: string }) {
  const session = useAuthSession();
  const lesson = useStudentLesson(lessonId);
  const params = useSearchParams();
  const artifactId = lesson.data?.artifacts.find(artifact => artifact.type === "interactive")?.id;
  const actorId = session.data?.user.id;
  const document = useStudentInteractiveArtifact(artifactId, actorId);
  const query = libraryParams(params.get("grade") ?? lesson.data?.section.gradeBand ?? null, params.get("q"));
  const homeHref = `/student/lessons/${lessonId}${query.size ? `?${query}` : ""}`;

  if (document.data && actorId) {
    return <InteractiveLessonPlayer key={document.data.artifactId} artifact={document.data} homeHref={homeHref} storageScope={`${actorId}:${lessonId}`} />;
  }

  const unavailable = lesson.isError || document.isError || session.isError || (lesson.isSuccess && !artifactId);
  return <div className={styles.page}>
    <StudentChrome active="materials" />
    <main className={styles.lessonMain}>
      <Link className={styles.backLink} href={homeHref}>К материалам занятия</Link>
      {unavailable ? <div className={styles.state} role="alert">
        <span>Интерактивная лекция недоступна или ещё не опубликована.</span>
        <button type="button" onClick={() => { void lesson.refetch(); if (artifactId) void document.refetch(); if (session.isError) void session.refetch(); }}>Повторить</button>
      </div> : <p role="status">Загружаем интерактивную лекцию…</p>}
    </main>
  </div>;
}
