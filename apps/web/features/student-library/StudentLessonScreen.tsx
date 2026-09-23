"use client";

import Link from "next/link";
import ContinuumHeader from "@/components/ContinuumHeader";
import { useStudentLesson } from "./use-student-library";
import styles from "./student-library.module.css";

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
                  {query.data.artifacts.map((artifact) => (
                    <li key={artifact.id}>
                      <span>{artifact.type === "pdf" ? "PDF" : "Интерактив"}</span>
                      <strong>{artifact.filename}</strong>
                      <small>Версия {artifact.version}</small>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={styles.tasks} aria-labelledby="tasks-heading">
              <div className={styles.blockHeading}>
                <h2 id="tasks-heading">Задачи</h2>
                <span>{query.data.tasks.length}</span>
              </div>
              {query.data.tasks.length === 0 ? (
                <p className={styles.gradeEmpty}>Задач к занятию пока нет.</p>
              ) : (
                <ol className={styles.taskList}>
                  {query.data.tasks.map((task, index) => (
                    <li key={task.id}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        {task.title ? <h3>{task.title}</h3> : null}
                        <p>{task.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
