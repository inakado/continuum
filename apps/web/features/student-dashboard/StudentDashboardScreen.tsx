"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import Button from "@/components/ui/Button";
import { studentApi, type Course, type CourseWithSections, type Section } from "@/lib/api/student";
import styles from "./student-dashboard.module.css";

const LAST_SECTION_KEY = "continuum:lastStudentSectionId";
const COURSES_QUERY_KEY = "view";
const COURSES_QUERY_VALUE = "courses";
const COURSES_HASH = "#courses"; // backward-compat (older links)

type View = "courses" | "sections" | "graph";
type Boot = "checking_last" | "ready";

const StudentSectionGraphPanel = dynamic(() => import("./StudentSectionGraphPanel"), {
  ssr: false,
  loading: () => (
    <div className={styles.panel}>
      <div className={styles.empty}>Загрузка графа…</div>
    </div>
  ),
});

export default function StudentDashboardScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const skipAutoRestoreOnceRef = useRef(false);
  const [boot, setBoot] = useState<Boot>("checking_last");
  const [view, setView] = useState<View>("courses");
  const [courses, setCourses] = useState<Course[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseWithSections | null>(null);

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedSectionTitle, setSelectedSectionTitle] = useState<string | null>(null);

  const navItems = useMemo(
    () => [
      {
        label: "Курсы",
        href: `/student?${COURSES_QUERY_KEY}=${COURSES_QUERY_VALUE}`,
        active: true,
      },
    ],
    [],
  );

  const sortedSections = useMemo(() => {
    if (!selectedCourse) return [];
    return [...selectedCourse.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [selectedCourse]);

  const fetchCourses = useCallback(async () => {
    setLoadingCourses(true);
    setError(null);
    try {
      const data = await studentApi.listCourses();
      setCourses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки курсов");
    } finally {
      setLoadingCourses(false);
    }
  }, []);

  const forceShowCourses = useCallback(() => {
    setError(null);
    setSelectedCourseId(null);
    setSelectedCourse(null);
    setSelectedSectionId(null);
    setSelectedSectionTitle(null);
    setView("courses");
  }, []);

  useEffect(() => {
    const queryOverride = searchParams.get(COURSES_QUERY_KEY) === COURSES_QUERY_VALUE;
    const hashOverride = typeof window !== "undefined" && window.location.hash === COURSES_HASH;
    if (queryOverride || hashOverride) {
      // User explicitly asked to see courses (e.g. from unit page sidebar).
      // We must not auto-restore the last graph.
      forceShowCourses();
      setBoot("ready");

      // Canonicalize URL back to `/student` (no query/hash) without losing state.
      // Note: router.replace will re-run this effect with an empty query, so we must
      // skip the auto-restore once on the next run.
      if (queryOverride) {
        skipAutoRestoreOnceRef.current = true;
        router.replace("/student");
      }
      if (hashOverride) window.history.replaceState(null, "", "/student");
      return;
    }

    if (skipAutoRestoreOnceRef.current) {
      skipAutoRestoreOnceRef.current = false;
      setBoot("ready");
      return;
    }

    try {
      const stored = window.localStorage.getItem(LAST_SECTION_KEY);
      if (stored) {
        setSelectedSectionId(stored);
        setSelectedSectionTitle(null);
        setView("graph");
      }
    } catch {
      // ignore localStorage errors (private mode/etc.)
    } finally {
      setBoot("ready");
    }
  }, [forceShowCourses, router, searchParams]);

  useEffect(() => {
    if (boot !== "ready") return;
    // We always want courses cached for the dashboard, even if we start on the graph.
    fetchCourses();
  }, [boot, fetchCourses]);

  useEffect(() => {
    // If we restored a section graph (or landed here without section title),
    // fetch the section to display its title and allow back-navigation to sections.
    if (boot !== "ready") return;
    if (view !== "graph") return;
    if (!selectedSectionId) return;
    if (selectedSectionTitle) return;

    let cancelled = false;
    (async () => {
      try {
        const section = await studentApi.getSection(selectedSectionId);
        if (cancelled) return;
        setSelectedSectionTitle(section.title);
        setSelectedCourseId(section.courseId);
      } catch {
        if (cancelled) return;
        handleGraphNotFound();
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boot, view, selectedSectionId, selectedSectionTitle]);

  const handleCourseClick = async (courseId: string) => {
    setError(null);
    setSelectedCourseId(courseId);
    setSelectedCourse(null);
    try {
      const data = await studentApi.getCourse(courseId);
      setSelectedCourse(data);
      setView("sections");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки курса");
    }
  };

  const handleSectionClick = (section: Section) => {
    setSelectedSectionId(section.id);
    setSelectedSectionTitle(section.title);
    setView("graph");
    try {
      window.localStorage.setItem(LAST_SECTION_KEY, section.id);
    } catch {
      // ignore
    }
  };

  const handleBackToCourses = () => {
    forceShowCourses();
  };

  const handleBackToSections = async () => {
    if (selectedCourse) {
      setView("sections");
      return;
    }
    if (selectedCourseId) {
      setError(null);
      try {
        const course = await studentApi.getCourse(selectedCourseId);
        setSelectedCourse(course);
        setView("sections");
        return;
      } catch {
        // fallthrough
      }
    }
    // If we restored a graph without knowing its course context, go back to courses.
    forceShowCourses();
  };

  const handleGraphNotFound = () => {
    try {
      window.localStorage.removeItem(LAST_SECTION_KEY);
    } catch {
      // ignore
    }
    setSelectedSectionId(null);
    setSelectedSectionTitle(null);
    setSelectedCourseId(null);
    setSelectedCourse(null);
    setView("courses");
  };

  return (
    <DashboardShell title="Ученик" navItems={navItems}>
      <div className={styles.content}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>
              {view === "courses"
                ? "Курсы"
                : view === "sections"
                  ? `Разделы курса: ${selectedCourse?.title ?? "Курс"}`
                  : `Раздел: ${selectedSectionTitle ?? "Раздел"}`}
            </h1>
            <p className={styles.subtitle}>
              {view === "courses"
                ? "Выберите курс"
                : view === "sections"
                  ? "Выберите раздел"
                  : "Граф доступен только для просмотра"}
            </p>
          </div>
          <div className={styles.actions}>
            {view === "sections" ? (
              <Button variant="ghost" onClick={handleBackToCourses}>
                ← Курсы
              </Button>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className={styles.error} role="status" aria-live="polite">
            {error}
          </div>
        ) : null}

        {boot !== "ready" ? (
          <div className={styles.empty}>Загрузка…</div>
        ) : view === "graph" && selectedSectionId ? (
          <StudentSectionGraphPanel
            sectionId={selectedSectionId}
            sectionTitle={selectedSectionTitle}
            onBack={handleBackToSections}
            onNotFound={handleGraphNotFound}
          />
        ) : view === "sections" ? (
          <div className={styles.panel}>
            <div className={styles.cardGrid}>
              {sortedSections.length === 0 ? (
                <div className={styles.empty}>Разделов пока нет</div>
              ) : (
                sortedSections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    className={styles.card}
                    onClick={() => handleSectionClick(section)}
                  >
                    <div className={styles.cardTitleRow}>
                      <div className={styles.cardTitle}>{section.title}</div>
                      <span className={styles.status}>
                        {section.status === "published" ? "Опубликован" : "Черновик"}
                      </span>
                    </div>
                    <div className={styles.cardMeta}>Открыть граф</div>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className={styles.panel}>
            <div className={styles.cardGrid}>
              {loadingCourses ? (
                <div className={styles.empty}>Загрузка курсов…</div>
              ) : courses.length === 0 ? (
                <div className={styles.empty}>Пока нет опубликованных курсов</div>
              ) : (
                courses.map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    className={`${styles.card} ${selectedCourseId === course.id ? styles.cardActive : ""}`}
                    onClick={() => handleCourseClick(course.id)}
                  >
                    <div className={styles.cardTitleRow}>
                      <div className={styles.cardTitle}>{course.title}</div>
                      <span className={styles.status}>Курс</span>
                    </div>
                    <div className={styles.cardMeta}>{course.description ?? "Без описания"}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
