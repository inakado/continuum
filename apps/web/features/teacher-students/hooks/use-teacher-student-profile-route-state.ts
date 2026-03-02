import { useCallback, useEffect, useMemo, useState } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { buildReviewSearch } from "@/features/teacher-review/review-query";
import type {
  ProfileContext,
  TeacherStudentProfileCourseTree,
  TeacherStudentProfileDetails,
} from "../teacher-student-profile.shared";
import { getFocusedContextFromSearchParams, getProfileStage } from "../teacher-student-profile.shared";

const useNormalizedDrilldownSelection = ({
  courseTree,
  selectedSectionId,
  selectedTaskId,
  selectedUnitId,
  setSelectedSectionId,
  setSelectedTaskId,
  setSelectedUnitId,
}: {
  courseTree: TeacherStudentProfileCourseTree | null;
  selectedSectionId: string | null;
  selectedTaskId: string | null;
  selectedUnitId: string | null;
  setSelectedSectionId: (value: string | null) => void;
  setSelectedTaskId: (value: string | null) => void;
  setSelectedUnitId: (value: string | null) => void;
}) => {
  useEffect(() => {
    if (!courseTree) {
      return;
    }

    if (selectedSectionId && !courseTree.sections.some((section) => section.id === selectedSectionId)) {
      setSelectedSectionId(null);
      setSelectedUnitId(null);
      setSelectedTaskId(null);
      return;
    }

    if (!selectedSectionId) {
      setSelectedUnitId(null);
      setSelectedTaskId(null);
      return;
    }

    const selectedSection = courseTree.sections.find((section) => section.id === selectedSectionId) ?? null;
    if (!selectedSection) return;

    if (selectedUnitId && !selectedSection.units.some((unit) => unit.id === selectedUnitId)) {
      setSelectedUnitId(null);
      setSelectedTaskId(null);
      return;
    }

    if (!selectedUnitId) {
      setSelectedTaskId(null);
      return;
    }

    const selectedUnit = selectedSection.units.find((unit) => unit.id === selectedUnitId) ?? null;
    if (!selectedUnit) return;

    if (selectedTaskId && !selectedUnit.tasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(null);
    }
  }, [
    courseTree,
    selectedSectionId,
    selectedTaskId,
    selectedUnitId,
    setSelectedSectionId,
    setSelectedTaskId,
    setSelectedUnitId,
  ]);
};

export const useTeacherStudentProfileRouteState = ({
  courseTree,
  details,
  router,
  searchParams,
  studentId,
}: {
  courseTree: TeacherStudentProfileCourseTree | null;
  details: TeacherStudentProfileDetails | null;
  router: AppRouterInstance;
  searchParams: ReadonlyURLSearchParams;
  studentId: string;
}) => {
  const focusedContext = useMemo(() => getFocusedContextFromSearchParams(searchParams), [searchParams]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(focusedContext.courseId);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(focusedContext.sectionId);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(focusedContext.unitId);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(focusedContext.taskId);

  useEffect(() => {
    setActiveCourseId(focusedContext.courseId);
    setSelectedSectionId(focusedContext.sectionId);
    setSelectedUnitId(focusedContext.unitId);
    setSelectedTaskId(focusedContext.taskId);
  }, [focusedContext, studentId]);

  const syncContext = useCallback(
    (next: {
      courseId?: string | null;
      sectionId?: string | null;
      unitId?: string | null;
      taskId?: string | null;
    }) => {
      const search = new URLSearchParams();
      if (next.courseId) search.set("courseId", next.courseId);
      if (next.sectionId) search.set("sectionId", next.sectionId);
      if (next.unitId) search.set("unitId", next.unitId);
      if (next.taskId) search.set("taskId", next.taskId);
      router.replace(`/teacher/students/${studentId}${search.toString() ? `?${search}` : ""}`);
    },
    [router, studentId],
  );

  useNormalizedDrilldownSelection({
    courseTree,
    selectedSectionId,
    selectedTaskId,
    selectedUnitId,
    setSelectedSectionId,
    setSelectedTaskId,
    setSelectedUnitId,
  });

  const selectedCourse = useMemo(() => {
    if (!details || !activeCourseId) return null;
    return details.courses.find((course) => course.id === activeCourseId) ?? null;
  }, [activeCourseId, details]);

  const selectedSection = useMemo(() => {
    if (!courseTree || !selectedSectionId) return null;
    return courseTree.sections.find((section) => section.id === selectedSectionId) ?? null;
  }, [courseTree, selectedSectionId]);

  const selectedUnit = useMemo(() => {
    if (!selectedSection || !selectedUnitId) return null;
    return selectedSection.units.find((unit) => unit.id === selectedUnitId) ?? null;
  }, [selectedSection, selectedUnitId]);

  const stage = useMemo(
    () => getProfileStage(activeCourseId, selectedSectionId, selectedUnitId),
    [activeCourseId, selectedSectionId, selectedUnitId],
  );

  const openReviewInbox = useCallback(
    (params?: ProfileContext) => {
      const search = buildReviewSearch({
        status: "pending_review",
        sort: "oldest",
        studentId,
        courseId: params?.courseId ?? undefined,
        sectionId: params?.sectionId ?? undefined,
        unitId: params?.unitId ?? undefined,
        taskId: params?.taskId ?? undefined,
      });
      router.push(`/teacher/review${search ? `?${search}` : ""}`);
    },
    [router, studentId],
  );

  const openCourse = useCallback(
    (courseId: string) => {
      setActiveCourseId(courseId);
      setSelectedSectionId(null);
      setSelectedUnitId(null);
      setSelectedTaskId(null);
      syncContext({ courseId });
    },
    [syncContext],
  );

  const openSection = useCallback(
    (sectionId: string) => {
      if (!activeCourseId) return;
      setSelectedSectionId(sectionId);
      setSelectedUnitId(null);
      setSelectedTaskId(null);
      syncContext({ courseId: activeCourseId, sectionId });
    },
    [activeCourseId, syncContext],
  );

  const openUnit = useCallback(
    (unitId: string) => {
      if (!activeCourseId || !selectedSectionId) return;
      setSelectedUnitId(unitId);
      setSelectedTaskId(null);
      syncContext({
        courseId: activeCourseId,
        sectionId: selectedSectionId,
        unitId,
      });
    },
    [activeCourseId, selectedSectionId, syncContext],
  );

  const toggleTaskStatement = useCallback(
    (taskId: string) => {
      if (!activeCourseId || !selectedSectionId || !selectedUnitId) return;
      const nextTaskId = selectedTaskId === taskId ? null : taskId;
      setSelectedTaskId(nextTaskId);
      syncContext({
        courseId: activeCourseId,
        sectionId: selectedSectionId,
        unitId: selectedUnitId,
        taskId: nextTaskId,
      });
    },
    [activeCourseId, selectedSectionId, selectedTaskId, selectedUnitId, syncContext],
  );

  const goCoursesRoot = useCallback(() => {
    setActiveCourseId(null);
    setSelectedSectionId(null);
    setSelectedUnitId(null);
    setSelectedTaskId(null);
    syncContext({});
  }, [syncContext]);

  const goSectionsRoot = useCallback(() => {
    if (!activeCourseId) return;
    setSelectedSectionId(null);
    setSelectedUnitId(null);
    setSelectedTaskId(null);
    syncContext({ courseId: activeCourseId });
  }, [activeCourseId, syncContext]);

  const goUnitsRoot = useCallback(() => {
    if (!activeCourseId || !selectedSectionId) return;
    setSelectedUnitId(null);
    setSelectedTaskId(null);
    syncContext({
      courseId: activeCourseId,
      sectionId: selectedSectionId,
    });
  }, [activeCourseId, selectedSectionId, syncContext]);

  const clearSelectedTask = useCallback(() => {
    if (!activeCourseId || !selectedSectionId || !selectedUnitId) return;
    setSelectedTaskId(null);
    syncContext({
      courseId: activeCourseId,
      sectionId: selectedSectionId,
      unitId: selectedUnitId,
    });
  }, [activeCourseId, selectedSectionId, selectedUnitId, syncContext]);

  return {
    activeCourseId,
    courseTree,
    openCourse,
    openReviewInbox,
    openSection,
    openUnit,
    selectedCourse,
    selectedSection,
    selectedTaskId,
    selectedUnit,
    stage,
    toggleTaskStatement,
    goCoursesRoot,
    goSectionsRoot,
    goUnitsRoot,
    clearSelectedTask,
  };
};
