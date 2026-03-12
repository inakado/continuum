"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { CourseWithSections, Section } from "@/lib/api/student";
import { COURSES_HASH, LAST_SECTION_KEY } from "../constants";

export type StudentDashboardView = "courses" | "sections" | "graph";
export type StudentDashboardBoot = "checking_last" | "ready";
type HistoryMode = "push" | "replace" | "none";

type StudentDashboardHistoryState = {
  __continuumStudentNav: true;
  view: StudentDashboardView;
  courseId: string | null;
  sectionId: string | null;
  sectionTitle: string | null;
};

type State = {
  boot: StudentDashboardBoot;
  error: string | null;
  selectedCourseId: string | null;
  selectedSectionId: string | null;
  selectedSectionTitle: string | null;
  view: StudentDashboardView;
};

type Action =
  | { type: "boot/ready" }
  | { type: "error/set"; value: string | null }
  | { type: "courses/show" }
  | { type: "sections/show"; courseId: string }
  | { type: "graph/show"; courseId: string | null; sectionId: string; sectionTitle: string | null }
  | { type: "graph/not-found" };

const initialState: State = {
  boot: "checking_last",
  error: null,
  selectedCourseId: null,
  selectedSectionId: null,
  selectedSectionTitle: null,
  view: "courses",
};

const buildHistoryState = (
  view: StudentDashboardView,
  courseId: string | null,
  sectionId: string | null,
  sectionTitle: string | null,
): Omit<StudentDashboardHistoryState, "__continuumStudentNav"> => ({
  view,
  courseId,
  sectionId,
  sectionTitle,
});

const isStudentDashboardHistoryState = (value: unknown): value is StudentDashboardHistoryState => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<StudentDashboardHistoryState>;
  return candidate.__continuumStudentNav === true;
};

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "boot/ready":
      return state.boot === "ready" ? state : { ...state, boot: "ready" };
    case "error/set":
      return { ...state, error: action.value };
    case "courses/show":
      return {
        ...state,
        error: null,
        selectedCourseId: null,
        selectedSectionId: null,
        selectedSectionTitle: null,
        view: "courses",
      };
    case "sections/show":
      return {
        ...state,
        error: null,
        selectedCourseId: action.courseId,
        selectedSectionId: null,
        selectedSectionTitle: null,
        view: "sections",
      };
    case "graph/show":
      return {
        ...state,
        error: null,
        selectedCourseId: action.courseId,
        selectedSectionId: action.sectionId,
        selectedSectionTitle: action.sectionTitle,
        view: "graph",
      };
    case "graph/not-found":
      return {
        ...state,
        error: null,
        selectedCourseId: null,
        selectedSectionId: null,
        selectedSectionTitle: null,
        view: "courses",
      };
    default:
      return state;
  }
};

const clearLastSection = () => {
  try {
    window.localStorage.removeItem(LAST_SECTION_KEY);
  } catch {
    // ignore
  }
};

const storeLastSection = (sectionId: string) => {
  try {
    window.localStorage.setItem(LAST_SECTION_KEY, sectionId);
  } catch {
    // ignore
  }
};

export const useStudentDashboardNavigation = ({
  ensureCourse,
  queryOverride,
}: {
  ensureCourse: (courseId: string) => Promise<CourseWithSections>;
  queryOverride: boolean;
}) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const skipAutoRestoreOnceRef = useRef(false);

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

  const showCourses = useCallback(() => {
    dispatch({ type: "courses/show" });
  }, []);

  const openCourse = useCallback(
    async (courseId: string, mode: HistoryMode = "push") => {
      dispatch({ type: "error/set", value: null });
      try {
        const course = await ensureCourse(courseId);
        dispatch({ type: "sections/show", courseId: course.id });
        if (mode !== "none") {
          writeHistoryState(buildHistoryState("sections", course.id, null, null), mode);
        }
        return true;
      } catch (error) {
        dispatch({
          type: "error/set",
          value: error instanceof Error ? error.message : "Ошибка загрузки курса",
        });
        return false;
      }
    },
    [ensureCourse, writeHistoryState],
  );

  const handleGraphNotFound = useCallback(() => {
    clearLastSection();
    dispatch({ type: "graph/not-found" });
    writeHistoryState(buildHistoryState("courses", null, null, null), "replace");
  }, [writeHistoryState]);

  const handleCourseClick = useCallback(
    (courseId: string) => {
      void openCourse(courseId, "push");
    },
    [openCourse],
  );

  const handleSectionClick = useCallback(
    (section: Section) => {
      if (section.accessStatus === "locked") {
        dispatch({
          type: "error/set",
          value: "Раздел заблокирован. Сначала завершите предыдущий раздел.",
        });
        return;
      }

      dispatch({
        type: "graph/show",
        courseId: state.selectedCourseId,
        sectionId: section.id,
        sectionTitle: section.title,
      });
      writeHistoryState(
        buildHistoryState("graph", state.selectedCourseId, section.id, section.title),
        "push",
      );
      storeLastSection(section.id);
    },
    [state.selectedCourseId, writeHistoryState],
  );

  const handleBackToCourses = useCallback(() => {
    showCourses();
    writeHistoryState(buildHistoryState("courses", null, null, null), "push");
  }, [showCourses, writeHistoryState]);

  const handleBackToSections = useCallback(async () => {
    if (state.selectedCourseId) {
      const opened = await openCourse(state.selectedCourseId, "push");
      if (opened) return;
    }
    showCourses();
    writeHistoryState(buildHistoryState("courses", null, null, null), "push");
  }, [openCourse, showCourses, state.selectedCourseId, writeHistoryState]);

  useEffect(() => {
    const hashOverride = typeof window !== "undefined" && window.location.hash === COURSES_HASH;
    if (queryOverride || hashOverride) {
      showCourses();
      dispatch({ type: "boot/ready" });

      if (queryOverride) {
        skipAutoRestoreOnceRef.current = true;
        window.history.replaceState(
          {
            __continuumStudentNav: true,
            ...buildHistoryState("courses", null, null, null),
          } satisfies StudentDashboardHistoryState,
          "",
          "/student",
        );
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
      dispatch({ type: "boot/ready" });
      return;
    }

    let initialHistoryState = buildHistoryState("courses", null, null, null);

    try {
      const storedSectionId = window.localStorage.getItem(LAST_SECTION_KEY);
      if (storedSectionId) {
        dispatch({
          type: "graph/show",
          courseId: null,
          sectionId: storedSectionId,
          sectionTitle: null,
        });
        initialHistoryState = buildHistoryState("graph", null, storedSectionId, null);
      } else {
        showCourses();
      }
    } catch {
      showCourses();
    } finally {
      writeHistoryState(initialHistoryState, "replace");
      dispatch({ type: "boot/ready" });
    }
  }, [queryOverride, showCourses, writeHistoryState]);

  useEffect(() => {
    if (state.boot !== "ready") return;

    const onPopState = (event: PopStateEvent) => {
      if (!isStudentDashboardHistoryState(event.state)) return;

      const next = event.state;
      if (next.view === "courses") {
        showCourses();
        return;
      }

      if (next.view === "sections") {
        if (!next.courseId) {
          showCourses();
          return;
        }
        void openCourse(next.courseId, "none");
        return;
      }

      if (!next.sectionId) {
        showCourses();
        return;
      }

      dispatch({ type: "error/set", value: null });
      dispatch({
        type: "graph/show",
        courseId: next.courseId,
        sectionId: next.sectionId,
        sectionTitle: next.sectionTitle,
      });
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [openCourse, showCourses, state.boot]);

  const restoreResolvedSection = useCallback(
    (section: Section) => {
      if (
        state.boot !== "ready" ||
        state.view !== "graph" ||
        state.selectedSectionId !== section.id ||
        state.selectedSectionTitle
      ) {
        return;
      }
      dispatch({
        type: "graph/show",
        courseId: section.courseId,
        sectionId: section.id,
        sectionTitle: section.title,
      });
      writeHistoryState(
        buildHistoryState("graph", section.courseId, section.id, section.title),
        "replace",
      );
    },
    [
      state.boot,
      state.selectedSectionId,
      state.selectedSectionTitle,
      state.view,
      writeHistoryState,
    ],
  );

  return {
    state,
    handleBackToCourses,
    handleBackToSections,
    handleCourseClick,
    handleGraphNotFound,
    handleSectionClick,
    restoreResolvedSection,
  };
};
