"use client";

import { useMemo, useState } from "react";
import type { GradeBand, StudentLibrary } from "@continuum/shared";
import Link from "next/link";
import ContinuumHeader from "@/components/ContinuumHeader";
import { useStudentLibrary } from "./use-student-library";
import styles from "./student-library.module.css";

const gradeTabs: Array<{ code: GradeBand; label: string }> = [
  { code: "grade_7", label: "7 класс" },
  { code: "grade_8", label: "8 класс" },
  { code: "grade_9", label: "9 класс" },
  { code: "grade_10_11", label: "10–11 классы" },
];

export function StudentLibraryView({ library }: { library: StudentLibrary }) {
  const initialGrade = library.gradeBands.at(-1)?.code ?? "grade_7";
  const [selectedGrade, setSelectedGrade] = useState<GradeBand>(initialGrade);
  const activeGrade = useMemo(
    () => library.gradeBands.find((gradeBand) => gradeBand.code === selectedGrade),
    [library.gradeBands, selectedGrade],
  );

  return (
    <>
      <nav aria-label="Классы" className={styles.gradeNav}>
        {gradeTabs.map((grade) => (
          <button
            aria-current={selectedGrade === grade.code ? "page" : undefined}
            className={selectedGrade === grade.code ? styles.activeGrade : undefined}
            key={grade.code}
            onClick={() => setSelectedGrade(grade.code)}
            type="button"
          >
            {grade.label}
          </button>
        ))}
      </nav>

      <main className={styles.main}>
        <div className={styles.intro}>
          <h1>Материалы по физике</h1>
          <p>Конспекты, интерактивные лекции и задачи</p>
        </div>

        {!activeGrade ? (
          <div className={styles.empty}>
            <h2>Материалы этого класса недоступны</h2>
          </div>
        ) : activeGrade.sections.length === 0 ? (
          <div className={styles.empty}>
            <h2>Материалов пока нет</h2>
          </div>
        ) : (
          <div className={styles.sections}>
            {activeGrade.sections.map((section) => (
              <section className={styles.section} key={section.id}>
                <h2>{section.title}</h2>
                <ol className={styles.lessons}>
                  {section.lessons.map((lesson, index) => (
                    <li key={lesson.id}>
                      <span className={styles.lessonNumber}>{index + 1}</span>
                      <Link className={styles.lessonTitle} href={`/student/lessons/${lesson.id}`}>
                        {lesson.title}
                      </Link>
                      <span className={styles.formats}>
                        <span className={styles.formatSlot}>
                          {lesson.formats.pdf ? (
                            <Link href={`/student/lessons/${lesson.id}`}>PDF</Link>
                          ) : null}
                        </span>
                        <span className={styles.formatSlot}>
                          {lesson.formats.interactive ? (
                            <Link href={`/student/lessons/${lesson.id}`}>Интерактив</Link>
                          ) : null}
                        </span>
                        <span className={styles.formatSlot}>
                          {lesson.formats.tasks ? (
                            <Link href={`/student/lessons/${lesson.id}`}>Задачи</Link>
                          ) : null}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

export default function StudentLibraryScreen() {
  const query = useStudentLibrary();

  return (
    <div className={styles.page}>
      <ContinuumHeader homeHref="/student" />
      {query.isPending ? <div className={styles.state}>Загружаем материалы…</div> : null}
      {query.isError ? (
        <div className={styles.state} role="alert">
          <span>Не удалось загрузить материалы.</span>
          <button onClick={() => void query.refetch()} type="button">Повторить</button>
        </div>
      ) : null}
      {query.data ? <StudentLibraryView library={query.data} /> : null}
    </div>
  );
}
