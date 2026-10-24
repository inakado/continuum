"use client";

import { useMemo, useState } from "react";
import type { GradeBand, StudentLibrary } from "@continuum/shared";
import Link from "next/link";
import ContinuumHeader from "@/components/ContinuumHeader";
import { StudentNavigation } from '@/features/student-works/StudentWorksShell';
import { useStudentLibrary } from "./use-student-library";
import { useStudentPdf } from "./use-student-pdf";
import styles from "./student-library.module.css";

const gradeTabs: Array<{ code: GradeBand; label: string }> = [
  { code: "grade_7", label: "7 класс" },
  { code: "grade_8", label: "8 класс" },
  { code: "grade_9", label: "9 класс" },
  { code: "grade_10_11", label: "10–11 классы" },
];

export function StudentLibraryView({ library }: { library: StudentLibrary }) {
  const pdf = useStudentPdf();
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

      <main aria-label="Материалы по физике" className={styles.main}>
        {pdf.error ? <p className={styles.fileError} role="alert">Не удалось открыть PDF. Нажмите на файл ещё раз.</p> : null}
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
                            <button aria-label={`Открыть PDF: ${lesson.title} (в новой вкладке)`} disabled={Boolean(pdf.opening)} onClick={() => void pdf.open({ lessonId: lesson.id, type: "pdf" })} type="button">
                              {pdf.opening?.lessonId === lesson.id && pdf.opening.type === "pdf" ? "PDF…" : "PDF"}
                            </button>
                          ) : null}
                        </span>
                        <span className={styles.formatSlot}>
                          {lesson.formats.interactive ? (
                            <Link href={`/student/lessons/${lesson.id}`}>Интерактив</Link>
                          ) : null}
                        </span>
                        <span className={styles.formatSlot}>
                          {lesson.formats.tasks ? (
                            <button aria-label={`Открыть задачи PDF: ${lesson.title} (в новой вкладке)`} disabled={Boolean(pdf.opening)} onClick={() => void pdf.open({ lessonId: lesson.id, type: "tasks_pdf" })} type="button">
                              {pdf.opening?.lessonId === lesson.id && pdf.opening.type === "tasks_pdf" ? "Задачи…" : "Задачи"}
                            </button>
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
      <StudentNavigation active="materials" />
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
