"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import Button from "@/components/ui/Button";
import { studentApi, type Course, type CourseWithSections, type Section } from "@/lib/api/student";
import { getContentStatusLabel } from "@/lib/status-labels";
import { useStudentLogout } from "@/features/student-content/auth/use-student-logout";
import { useStudentIdentity } from "@/features/student-content/shared/use-student-identity";
import styles from "./student-dashboard.module.css";
import {
  COURSES_HASH,
  COURSES_QUERY_KEY,
  COURSES_QUERY_VALUE,
  LAST_SECTION_KEY,
} from "./constants";

type View = "courses" | "sections" | "graph";
type Boot = "checking_last" | "ready";
type HistoryMode = "push" | "replace" | "none";

type StudentDashboardHistoryState = {
  __continuumStudentNav: true;
  view: View;
  courseId: string | null;
  sectionId: string | null;
  sectionTitle: string | null;
};

const isStudentDashboardHistoryState = (value: unknown): value is StudentDashboardHistoryState => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StudentDashboardHistoryState>;
  return candidate.__continuumStudentNav === true;
};

const StudentSectionGraphPanel = dynamic(() => import("./StudentSectionGraphPanel"), {
  ssr: false,
  loading: () => (
    <div className={styles.panel}>
      <div className={styles.empty}>Загрузка графа…</div>
    </div>
  ),
});

type StudentDashboardScreenProps = {
  queryOverride?: boolean;
};

export default function StudentDashboardScreen({ queryOverride = false }: StudentDashboardScreenProps) {
  const router = useRouter();
  const handleLogout = useStudentLogout();
  const identity = useStudentIdentity();
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
  const coursesRequestIdRef = useRef(0);
  const courseRequestIdRef = useRef(0);

  const writeHistoryState = useCallback(
    (
      next: Omit<StudentDashboardHistoryState, "__continuumStudentNav">,
      mode: Exclude<HistoryMode, "none"> = "push",
    ) => {
      if (typeof window === "undefined") return;
      const fullState: StudentDashboardHistoryState = {
        __continuumStudentNav: true,
        ...next,
      };
      if (mode === "replace") {
        window.history.replaceState(fullState, "", window.location.href);
      } else {
        window.history.pushState(fullState, "", window.location.href);
      }
    },
    [],
  );

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
    const requestId = ++coursesRequestIdRef.current;
    setLoadingCourses(true);
    setError(null);
    try {
      const data = await studentApi.listCourses();
      if (requestId !== coursesRequestIdRef.current) return;
      setCourses(data);
    } catch (err) {
      if (requestId !== coursesRequestIdRef.current) return;
      setError(err instanceof Error ? err.message : "Ошибка загрузки курсов");
    } finally {
      if (requestId === coursesRequestIdRef.current) {
        setLoadingCourses(false);
      }
    }
  }, []);

  const loadCourse = useCallback(async (courseId: string) => {
    const requestId = ++courseRequestIdRef.current;
    setError(null);
    setSelectedCourseId(courseId);
    setSelectedCourse(null);
    try {
      const data = await studentApi.getCourse(courseId);
      if (requestId !== courseRequestIdRef.current) return null;
      setSelectedCourse(data);
      return data;
    } catch (err) {
      if (requestId !== courseRequestIdRef.current) return null;
      setError(err instanceof Error ? err.message : "Ошибка загрузки курса");
      return null;
    }
  }, []);

  const openCourse = useCallback(
    async (courseId: string, mode: HistoryMode = "push") => {
      const data = await loadCourse(courseId);
      if (!data) return false;
      setSelectedSectionId(null);
      setSelectedSectionTitle(null);
      setView("sections");
      if (mode !== "none") {
        writeHistoryState(
          { view: "sections", courseId: data.id, sectionId: null, sectionTitle: null },
          mode,
        );
      }
      return true;
    },
    [loadCourse, writeHistoryState],
  );

  const forceShowCourses = useCallback(() => {
    setError(null);
    setSelectedCourseId(null);
    setSelectedCourse(null);
    setSelectedSectionId(null);
    setSelectedSectionTitle(null);
    setView("courses");
  }, []);

  const handleGraphNotFound = useCallback(() => {
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
    writeHistoryState({ view: "courses", courseId: null, sectionId: null, sectionTitle: null }, "replace");
  }, [writeHistoryState]);

  useEffect(() => {
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
        writeHistoryState({ view: "courses", courseId: null, sectionId: null, sectionTitle: null }, "replace");
        router.replace("/student");
      }
      if (hashOverride) {
        window.history.replaceState(
          {
            __continuumStudentNav: true,
            view: "courses",
            courseId: null,
            sectionId: null,
            sectionTitle: null,
          } satisfies StudentDashboardHistoryState,
          "",
          "/student",
        );
      }
      return;
    }

    if (skipAutoRestoreOnceRef.current) {
      skipAutoRestoreOnceRef.current = false;
      writeHistoryState({ view: "courses", courseId: null, sectionId: null, sectionTitle: null }, "replace");
      setBoot("ready");
      return;
    }

    let initialState: Omit<StudentDashboardHistoryState, "__continuumStudentNav"> = {
      view: "courses",
      courseId: null,
      sectionId: null,
      sectionTitle: null,
    };

    try {
      const stored = window.localStorage.getItem(LAST_SECTION_KEY);
      if (stored) {
        setSelectedSectionId(stored);
        setSelectedSectionTitle(null);
        setView("graph");
        initialState = {
          view: "graph",
          courseId: null,
          sectionId: stored,
          sectionTitle: null,
        };
      }
    } catch {
      // ignore localStorage errors (private mode/etc.)
    } finally {
      writeHistoryState(initialState, "replace");
      setBoot("ready");
    }
  }, [forceShowCourses, queryOverride, router, writeHistoryState]);

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
        writeHistoryState(
          {
            view: "graph",
            courseId: section.courseId,
            sectionId: section.id,
            sectionTitle: section.title,
          },
          "replace",
        );
      } catch {
        if (cancelled) return;
        handleGraphNotFound();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [boot, handleGraphNotFound, selectedSectionId, selectedSectionTitle, view, writeHistoryState]);

  useEffect(() => {
    if (boot !== "ready") return;

    const onPopState = (event: PopStateEvent) => {
      if (!isStudentDashboardHistoryState(event.state)) return;

      const next = event.state;
      if (next.view === "courses") {
        forceShowCourses();
        return;
      }

      if (next.view === "sections") {
        if (!next.courseId) {
          forceShowCourses();
          return;
        }
        void openCourse(next.courseId, "none");
        return;
      }

      if (!next.sectionId) {
        forceShowCourses();
        return;
      }

      setError(null);
      setSelectedSectionId(next.sectionId);
      setSelectedSectionTitle(next.sectionTitle);
      setSelectedCourseId(next.courseId);
      setView("graph");
      if (next.courseId) {
        void loadCourse(next.courseId);
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [boot, forceShowCourses, loadCourse, openCourse]);

  const handleCourseClick = useCallback(
    async (courseId: string) => {
      void openCourse(courseId, "push");
    },
    [openCourse],
  );

  const handleSectionClick = useCallback((section: Section) => {
    setSelectedSectionId(section.id);
    setSelectedSectionTitle(section.title);
    setView("graph");
    writeHistoryState(
      {
        view: "graph",
        courseId: selectedCourseId,
        sectionId: section.id,
        sectionTitle: section.title,
      },
      "push",
    );
    try {
      window.localStorage.setItem(LAST_SECTION_KEY, section.id);
    } catch {
      // ignore
    }
  }, [selectedCourseId, writeHistoryState]);

  const handleBackToCourses = useCallback(() => {
    forceShowCourses();
    writeHistoryState({ view: "courses", courseId: null, sectionId: null, sectionTitle: null }, "push");
  }, [forceShowCourses, writeHistoryState]);

  const handleBackToSections = useCallback(async () => {
    if (selectedCourse) {
      setView("sections");
      writeHistoryState({ view: "sections", courseId: selectedCourse.id, sectionId: null, sectionTitle: null }, "push");
      return;
    }
    if (selectedCourseId) {
      const opened = await openCourse(selectedCourseId, "push");
      if (opened) {
        return;
      }
    }
    // If we restored a graph without knowing its course context, go back to courses.
    forceShowCourses();
    writeHistoryState({ view: "courses", courseId: null, sectionId: null, sectionTitle: null }, "push");
  }, [forceShowCourses, openCourse, selectedCourse, selectedCourseId, writeHistoryState]);

  return (
    <DashboardShell
      title={identity.displayName || "Профиль"}
      navItems={navItems}
      appearance="glass"
      onLogout={handleLogout}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>
              {view === "courses"
                ? "Курсы"
                : view === "sections"
                  ? selectedCourse?.title ?? "Курс"
                  : `Раздел: ${selectedSectionTitle ?? "Раздел"}`}
            </h1>
            <p className={styles.subtitle}>
              {view === "courses"
                ? "Выберите курс"
                : view === "sections"
                  ? "Выберите раздел"
                  : ""}
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
                      <span className={styles.status}>{getContentStatusLabel(section.status)}</span>
                    </div>
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
