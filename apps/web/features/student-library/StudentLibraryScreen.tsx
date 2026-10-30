"use client";

import { useEffect } from "react";
import type { StudentLibrary } from "@continuum/shared";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import SearchField from "@/components/ui/SearchField";
import { StudentChrome } from '@/features/student-works/StudentWorksShell';
import { useStudentLibrary } from "./use-student-library";
import { useStudentPdf } from "./use-student-pdf";
import { gradeLabels, libraryParams } from "./library-navigation";
import styles from "./student-library.module.css";

export function StudentLibraryView({ library }: { library: StudentLibrary }) {
  const pdf = useStudentPdf();
  const params = useSearchParams();
  const grade = library.gradeBands.find(item => item.code === params.get('grade')) ?? library.gradeBands.at(-1);
  const query = (params.get('q') ?? '').slice(0, 200);
  const normalized = query.trim().toLocaleLowerCase('ru');
  const sections = grade?.sections.map(section => ({ ...section, lessons: section.lessons.map((lesson, index) => ({ ...lesson, number: index + 1 })).filter(lesson => `${lesson.title} ${section.title}`.toLocaleLowerCase('ru').includes(normalized)) })).filter(section => section.lessons.length);
  const update = (code: string | null, search: string) => {
    const next = libraryParams(code, search).toString();
    window.history.replaceState(null, '', `/student${next ? `?${next}` : ''}`);
  };
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (!id.startsWith('lesson-')) return;
    const target = document.getElementById(id);
    target?.scrollIntoView?.({ block: 'center' });
    target?.focus({ preventScroll: true });
  }, [library, query, grade?.code]);
  return (
    <>
      {library.gradeBands.length > 1 && <nav aria-label="Классы" className={styles.gradeNav}>
        {library.gradeBands.map(item => <button key={item.code} type="button" aria-current={grade?.code === item.code ? 'page' : undefined} className={grade?.code === item.code ? styles.activeGrade : undefined} onClick={() => update(item.code, query)}>{gradeLabels[item.code]}</button>)}
      </nav>}
      <main aria-label="Материалы по физике" className={styles.main}>
        <div className={styles.catalogHeading}><h1>Материалы</h1>{library.gradeBands.length > 1 ? <label className={styles.mobileGrade}><span className={styles.srOnly}>Класс материалов</span><select aria-label="Класс материалов" value={grade?.code} onChange={event => update(event.target.value, query)}>{library.gradeBands.map(item => <option key={item.code} value={item.code}>{gradeLabels[item.code]}</option>)}</select></label> : grade && <span>{gradeLabels[grade.code]}</span>}</div>
        {grade?.sections.some(section => section.lessons.length) && <SearchField label="Найти занятие" placeholder="Найти занятие" value={query} maxLength={200} onValueChange={value => update(grade.code, value)} className={styles.catalogSearch} />}
        {pdf.error ? <p className={styles.fileError} role="alert">Не удалось открыть PDF. Нажмите на файл ещё раз.</p> : null}
        {!grade ? (
          <div className={styles.empty}>
            <h2>Материалы этого класса недоступны</h2>
          </div>
        ) : grade.sections.length === 0 ? (
          <div className={styles.empty}>
            <h2>Материалов пока нет</h2>
          </div>
        ) : (
          <div className={styles.sections}>
            {!sections?.length && <p className={styles.gradeEmpty}>{normalized ? 'Занятия не найдены. Попробуйте другое название.' : 'Материалов пока нет.'}</p>}
            {sections?.map((section) => (
              <section className={styles.section} key={section.id}>
                <h2>{section.title}</h2>
                <ol className={styles.lessons}>
                  {section.lessons.map((lesson) => (
                    <li key={lesson.id}>
                      <Link id={`lesson-${lesson.id}`} className={styles.lessonTitle} href={`/student/lessons/${lesson.id}?${libraryParams(grade.code, query)}`}>
                        <span className={styles.lessonNumber}>{lesson.number}</span>
                        <span className={styles.lessonName}>{lesson.title}</span>
                        <span className={styles.mobileFormats}>{[lesson.formats.pdf && 'Конспект', lesson.formats.tasks && 'Задачи', lesson.formats.interactive && 'Интерактив'].filter(Boolean).join(' · ')}</span>
                        <ChevronRight className={styles.lessonChevron} size={18} aria-hidden="true" />
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
                            <Link href={`/student/lessons/${lesson.id}?${libraryParams(grade.code, query)}`}>Интерактив</Link>
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
      <StudentChrome active="materials" />
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
