"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import Button from "@/components/ui/Button";
import { studentApi, type Course, type CourseWithSections, type Section } from "@/lib/api/student";
import { contentQueryKeys } from "@/lib/query/keys";
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

type DashboardHeaderState = {
  title: string;
  subtitle: string;
  showBackToCourses: boolean;
};

type StudentDashboardPanelProps = {
  boot: Boot;
  courses: Course[];
  loadingCourses: boolean;
  onCourseClick: (courseId: string) => void;
  onGraphNotFound: () => void;
  onSectionClick: (section: Section) => void;
  onSectionsBack: () => void;
  sections: Section[];
  selectedCourseId: string | null;
  selectedSectionId: string | null;
  selectedSectionTitle: string | null;
  view: View;
};

type QueryErrorState = {
  error: Error | null;
  isError: boolean;
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

const buildHistoryState = (
  view: View,
  courseId: string | null,
  sectionId: string | null,
  sectionTitle: string | null,
): Omit<StudentDashboardHistoryState, "__continuumStudentNav"> => ({
  view,
  courseId,
  sectionId,
  sectionTitle,
});

const getDashboardHeaderState = (
  view: View,
  courseTitle: string | null | undefined,
  sectionTitle: string | null,
): DashboardHeaderState => {
  if (view === "courses") {
    return {
      title: "Курсы",
      subtitle: "Выберите курс",
      showBackToCourses: false,
    };
  }

  if (view === "sections") {
    return {
      title: courseTitle ?? "Курс",
      subtitle: "Выберите раздел",
      showBackToCourses: true,
    };
  }

  return {
    title: `Раздел: ${sectionTitle ?? "Раздел"}`,
    subtitle: "",
    showBackToCourses: false,
  };
};

const getRequestError = (
  coursesQuery: QueryErrorState,
  selectedCourseQuery: QueryErrorState,
  view: View,
) => {
  if (coursesQuery.isError) {
    return coursesQuery.error instanceof Error ? coursesQuery.error.message : "Ошибка загрузки курсов";
  }
  if (selectedCourseQuery.isError && view === "sections") {
    return selectedCourseQuery.error instanceof Error ? selectedCourseQuery.error.message : "Ошибка загрузки курса";
  }
  return null;
};

const StudentDashboardPanel = ({
  boot,
  courses,
  loadingCourses,
  onCourseClick,
  onGraphNotFound,
  onSectionClick,
  onSectionsBack,
  sections,
  selectedCourseId,
  selectedSectionId,
  selectedSectionTitle,
  view,
}: StudentDashboardPanelProps) => {
  if (boot !== "ready") {
    return <div className={styles.empty}>Загрузка…</div>;
  }

  if (view === "graph" && selectedSectionId) {
    return (
      <StudentSectionGraphPanel
        sectionId={selectedSectionId}
        sectionTitle={selectedSectionTitle}
        onBack={onSectionsBack}
        onNotFound={onGraphNotFound}
      />
    );
  }

  if (view === "sections") {
    return (
      <div className={styles.panel}>
        <div className={styles.cardGrid}>
          {sections.length === 0 ? (
            <div className={styles.empty}>Разделов пока нет</div>
          ) : (
            sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={styles.card}
                onClick={() => onSectionClick(section)}
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
    );
  }

  return (
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
              onClick={() => onCourseClick(course.id)}
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
  );
};

const useStudentDashboardBoot = ({
  forceShowCourses,
  queryOverride,
  router,
  setBoot,
  setSelectedSectionId,
  setSelectedSectionTitle,
  setView,
  writeHistoryState,
}: {
  forceShowCourses: () => void;
  queryOverride: boolean;
  router: ReturnType<typeof useRouter>;
  setBoot: (boot: Boot) => void;
  setSelectedSectionId: (sectionId: string | null) => void;
  setSelectedSectionTitle: (title: string | null) => void;
  setView: (view: View) => void;
  writeHistoryState: (
    next: Omit<StudentDashboardHistoryState, "__continuumStudentNav">,
    mode?: Exclude<HistoryMode, "none">,
  ) => void;
}) => {
  const skipAutoRestoreOnceRef = useRef(false);

  useEffect(() => {
    const hashOverride = typeof window !== "undefined" && window.location.hash === COURSES_HASH;
    if (queryOverride || hashOverride) {
      forceShowCourses();
      setBoot("ready");

      if (queryOverride) {
        skipAutoRestoreOnceRef.current = true;
        writeHistoryState(buildHistoryState("courses", null, null, null), "replace");
        router.replace("/student");
      }
      if (hashOverride) {
        window.history.replaceState(
          {
            __continuumStudentNav: true,
            ...buildHistoryState("courses", null, null, null),
          } satisfies StudentDashboardHistoryState,
          "",
          "/student",
        );
      }
      return;
    }

    if (skipAutoRestoreOnceRef.current) {
      skipAutoRestoreOnceRef.current = false;
      writeHistoryState(buildHistoryState("courses", null, null, null), "replace");
      setBoot("ready");
      return;
    }

    let initialState = buildHistoryState("courses", null, null, null);

    try {
      const stored = window.localStorage.getItem(LAST_SECTION_KEY);
      if (stored) {
        setSelectedSectionId(stored);
        setSelectedSectionTitle(null);
        setView("graph");
        initialState = buildHistoryState("graph", null, stored, null);
      }
    } catch {
      // ignore localStorage errors (private mode/etc.)
    } finally {
      writeHistoryState(initialState, "replace");
      setBoot("ready");
    }
  }, [
    forceShowCourses,
    queryOverride,
    router,
    setBoot,
    setSelectedSectionId,
    setSelectedSectionTitle,
    setView,
    writeHistoryState,
  ]);
};

const useStudentDashboardSectionRestore = ({
  boot,
  handleGraphNotFound,
  selectedSectionId,
  selectedSectionQuery,
  selectedSectionTitle,
  setSelectedCourseId,
  setSelectedSectionTitle,
  view,
  writeHistoryState,
}: {
  boot: Boot;
  handleGraphNotFound: () => void;
  selectedSectionId: string | null;
  selectedSectionQuery: ReturnType<typeof useQuery<Section>>;
  selectedSectionTitle: string | null;
  setSelectedCourseId: (courseId: string | null) => void;
  setSelectedSectionTitle: (title: string | null) => void;
  view: View;
  writeHistoryState: (
    next: Omit<StudentDashboardHistoryState, "__continuumStudentNav">,
    mode?: Exclude<HistoryMode, "none">,
  ) => void;
}) => {
  useEffect(() => {
    if (boot !== "ready" || view !== "graph" || !selectedSectionId || selectedSectionTitle) {
      return;
    }
    if (selectedSectionQuery.isSuccess) {
      const section = selectedSectionQuery.data;
      setSelectedSectionTitle(section.title);
      setSelectedCourseId(section.courseId);
      writeHistoryState(buildHistoryState("graph", section.courseId, section.id, section.title), "replace");
      return;
    }
    if (selectedSectionQuery.isError) {
      handleGraphNotFound();
    }
  }, [
    boot,
    handleGraphNotFound,
    selectedSectionId,
    selectedSectionQuery.data,
    selectedSectionQuery.isError,
    selectedSectionQuery.isSuccess,
    selectedSectionTitle,
    setSelectedCourseId,
    setSelectedSectionTitle,
    view,
    writeHistoryState,
  ]);
};

const useStudentDashboardPopState = ({
  boot,
  forceShowCourses,
  openCourse,
  setError,
  setSelectedCourseId,
  setSelectedSectionId,
  setSelectedSectionTitle,
  setView,
}: {
  boot: Boot;
  forceShowCourses: () => void;
  openCourse: (courseId: string, mode?: HistoryMode) => Promise<boolean>;
  setError: (error: string | null) => void;
  setSelectedCourseId: (courseId: string | null) => void;
  setSelectedSectionId: (sectionId: string | null) => void;
  setSelectedSectionTitle: (title: string | null) => void;
  setView: (view: View) => void;
}) => {
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
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [
    boot,
    forceShowCourses,
    openCourse,
    setError,
    setSelectedCourseId,
    setSelectedSectionId,
    setSelectedSectionTitle,
    setView,
  ]);
};

type StudentDashboardScreenProps = {
  queryOverride?: boolean;
};

export default function StudentDashboardScreen({ queryOverride = false }: StudentDashboardScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const handleLogout = useStudentLogout();
  const identity = useStudentIdentity();
  const [boot, setBoot] = useState<Boot>("checking_last");
  const [view, setView] = useState<View>("courses");
  const [error, setError] = useState<string | null>(null);

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedSectionTitle, setSelectedSectionTitle] = useState<string | null>(null);
  const coursesQuery = useQuery({
    queryKey: contentQueryKeys.studentCourses(),
    queryFn: () => studentApi.listCourses(),
    enabled: boot === "ready",
  });
  const selectedCourseQuery = useQuery({
    queryKey: contentQueryKeys.studentCourse(selectedCourseId ?? ""),
    queryFn: () => studentApi.getCourse(selectedCourseId as string),
    enabled: boot === "ready" && Boolean(selectedCourseId),
  });
  const selectedSectionQuery = useQuery({
    queryKey: contentQueryKeys.studentSection(selectedSectionId ?? ""),
    queryFn: () => studentApi.getSection(selectedSectionId as string),
    enabled: boot === "ready" && view === "graph" && Boolean(selectedSectionId),
  });
  const courses: Course[] = coursesQuery.data ?? [];
  const selectedCourse: CourseWithSections | null = selectedCourseQuery.data ?? null;
  const loadingCourses = coursesQuery.isPending;

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
  const requestError = useMemo(
    () => getRequestError(coursesQuery, selectedCourseQuery, view),
    [coursesQuery, selectedCourseQuery, view],
  );
  const visibleError = error ?? requestError;
  const headerState = useMemo(
    () => getDashboardHeaderState(view, selectedCourse?.title, selectedSectionTitle),
    [selectedCourse?.title, selectedSectionTitle, view],
  );

  const openCourse = useCallback(
    async (courseId: string, mode: HistoryMode = "push") => {
      setError(null);
      try {
        const data = await queryClient.ensureQueryData({
          queryKey: contentQueryKeys.studentCourse(courseId),
          queryFn: () => studentApi.getCourse(courseId),
        });
        setSelectedCourseId(courseId);
        setSelectedSectionId(null);
        setSelectedSectionTitle(null);
        setView("sections");
        if (mode !== "none") {
          writeHistoryState(buildHistoryState("sections", data.id, null, null), mode);
        }
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Ошибка загрузки курса");
        return false;
      }
    },
    [queryClient, writeHistoryState],
  );

  const forceShowCourses = useCallback(() => {
    setError(null);
    setSelectedCourseId(null);
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
    setView("courses");
    writeHistoryState(buildHistoryState("courses", null, null, null), "replace");
  }, [writeHistoryState]);

  useStudentDashboardBoot({
    forceShowCourses,
    queryOverride,
    router,
    setBoot,
    setSelectedSectionId,
    setSelectedSectionTitle,
    setView,
    writeHistoryState,
  });

  useStudentDashboardSectionRestore({
    boot,
    handleGraphNotFound,
    selectedSectionId,
    selectedSectionQuery,
    selectedSectionTitle,
    setSelectedCourseId,
    setSelectedSectionTitle,
    view,
    writeHistoryState,
  });

  useStudentDashboardPopState({
    boot,
    forceShowCourses,
    openCourse,
    setError,
    setSelectedCourseId,
    setSelectedSectionId,
    setSelectedSectionTitle,
    setView,
  });

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
    writeHistoryState(buildHistoryState("graph", selectedCourseId, section.id, section.title), "push");
    try {
      window.localStorage.setItem(LAST_SECTION_KEY, section.id);
    } catch {
      // ignore
    }
  }, [selectedCourseId, writeHistoryState]);

  const handleBackToCourses = useCallback(() => {
    forceShowCourses();
    writeHistoryState(buildHistoryState("courses", null, null, null), "push");
  }, [forceShowCourses, writeHistoryState]);

  const handleBackToSections = useCallback(async () => {
    if (selectedCourse) {
      setView("sections");
      writeHistoryState(buildHistoryState("sections", selectedCourse.id, null, null), "push");
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
    writeHistoryState(buildHistoryState("courses", null, null, null), "push");
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
            <h1 className={styles.title}>{headerState.title}</h1>
            <p className={styles.subtitle}>{headerState.subtitle}</p>
          </div>
          <div className={styles.actions}>
            {headerState.showBackToCourses ? (
              <Button variant="ghost" onClick={handleBackToCourses}>
                ← Курсы
              </Button>
            ) : null}
          </div>
        </div>

        {visibleError ? (
          <div className={styles.error} role="status" aria-live="polite">
            {visibleError}
          </div>
        ) : null}

        <StudentDashboardPanel
          boot={boot}
          courses={courses}
          loadingCourses={loadingCourses}
          onCourseClick={handleCourseClick}
          onGraphNotFound={handleGraphNotFound}
          onSectionClick={handleSectionClick}
          onSectionsBack={handleBackToSections}
          sections={sortedSections}
          selectedCourseId={selectedCourseId}
          selectedSectionId={selectedSectionId}
          selectedSectionTitle={selectedSectionTitle}
          view={view}
        />
      </div>
    </DashboardShell>
  );
}
