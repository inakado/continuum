"use client";

import Link from "next/link";
import InteractiveLessonPlayer from "@/components/interactive-lesson/InteractiveLessonPlayer";
import { useAuthSession } from "@/features/auth/useAuthSession";
import TeacherChrome from "@/features/teacher-shell/TeacherChrome";
import { useTeacherInteractiveArtifact } from "./use-teacher-library";
import styles from "./teacher-library.module.css";

export default function TeacherInteractiveLessonScreen({ artifactId }: { artifactId: string }) {
  const session = useAuthSession();
  const actorId = session.data?.user.id;
  const document = useTeacherInteractiveArtifact(artifactId, actorId);
  const homeHref = "/teacher/materials";

  if (document.data && actorId) {
    return <InteractiveLessonPlayer key={artifactId} artifact={document.data} homeHref={homeHref} storageScope={`${actorId}:preview:${document.data.manifest.lessonId}`} />;
  }

  const unavailable = document.isError || session.isError;
  return <div className={styles.page}>
    <TeacherChrome active="materials" />
    <main className={styles.previewState}>
      <Link href={homeHref}>К материалам</Link>
      {unavailable ? <div className={styles.state} role="alert">
        <span>Не удалось открыть интерактивную лекцию.</span>
        <button type="button" onClick={() => { void document.refetch(); if (session.isError) void session.refetch(); }}>Повторить</button>
      </div> : <p role="status">Загружаем интерактивную лекцию…</p>}
    </main>
  </div>;
}
