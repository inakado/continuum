import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { teacherApi, type Course, type CourseWithSections, type Section } from "@/lib/api/teacher";
import { contentQueryKeys } from "@/lib/query/keys";
import { getApiErrorMessage } from "@/features/teacher-content/shared/api-errors";

type HistoryUpdateMode = "push" | "replace" | "none";

type TeacherEditHistoryState = {
  __continuumTeacherEditNav: true;
  courseId: string | null;
  sectionId: string | null;
  sectionTitle: string | null;
};

export type EditDialogState =
  | {
      kind: "course";
      id: string;
    }
  | {
      kind: "section";
      id: string;
    };

export type DeleteDialogState =
  | { kind: "course"; course: Course }
  | { kind: "section"; section: Section }
  | null;

const isTeacherEditHistoryState = (value: unknown): value is TeacherEditHistoryState => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TeacherEditHistoryState>;
  return candidate.__continuumTeacherEditNav === true;
};

const normalizeDescription = (value: string) => {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const useTeacherEditMode = ({
  initialSectionId,
  onPushToTeacherRoot,
}: {
  initialSectionId?: string;
  onPushToTeacherRoot: () => void;
}) => {
  const queryClient = useQueryClient();
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedSectionTitle, setSelectedSectionTitle] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionDescription, setSectionDescription] = useState("");
  const [courseFormError, setCourseFormError] = useState<string | null>(null);
  const [sectionFormError, setSectionFormError] = useState<string | null>(null);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [editDialog, setEditDialog] = useState<EditDialogState | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<DeleteDialogState>(null);
  const [historyReady, setHistoryReady] = useState(Boolean(initialSectionId));

  const coursesQuery = useQuery({
    queryKey: contentQueryKeys.teacherCourses(),
    queryFn: () => teacherApi.listCourses(),
  });
  const selectedCourseQuery = useQuery({
    queryKey: contentQueryKeys.teacherCourse(selectedCourseId ?? ""),
    queryFn: () => teacherApi.getCourse(selectedCourseId as string),
    enabled: Boolean(selectedCourseId),
  });

  const courses: Course[] = coursesQuery.data ?? [];
  const selectedCourse: CourseWithSections | null = selectedCourseQuery.data ?? null;
  const loadingCourses = coursesQuery.isPending;
  const loadingSections = Boolean(selectedCourseId) && selectedCourseQuery.isPending;
  const sortedSections = useMemo(() => {
    if (!selectedCourse) return [];
    return [...selectedCourse.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [selectedCourse]);
  const requestError = useMemo(() => {
    if (coursesQuery.isError) return getApiErrorMessage(coursesQuery.error);
    if (selectedCourseQuery.isError && selectedCourseId) return getApiErrorMessage(selectedCourseQuery.error);
    return null;
  }, [coursesQuery.error, coursesQuery.isError, selectedCourseId, selectedCourseQuery.error, selectedCourseQuery.isError]);
  const visibleError = error ?? requestError;

  const writeHistoryState = useCallback(
    (next: Omit<TeacherEditHistoryState, "__continuumTeacherEditNav">, mode: "push" | "replace" = "push") => {
      if (initialSectionId || typeof window === "undefined") return;
      const fullState: TeacherEditHistoryState = {
        __continuumTeacherEditNav: true,
        ...next,
      };
      if (mode === "replace") {
        window.history.replaceState(fullState, "", window.location.href);
      } else {
        window.history.pushState(fullState, "", window.location.href);
      }
    },
    [initialSectionId],
  );

  const refreshCourses = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: contentQueryKeys.teacherCourses() });
  }, [queryClient]);

  const refreshSelectedCourse = useCallback(
    async (courseId: string) => {
      await queryClient.invalidateQueries({ queryKey: contentQueryKeys.teacherCourse(courseId) });
    },
    [queryClient],
  );

  const resetInlineSectionForm = useCallback(() => {
    setShowSectionForm(false);
    setSectionTitle("");
    setSectionDescription("");
    setSectionFormError(null);
  }, []);

  const resetInlineCourseForm = useCallback(() => {
    setShowCourseForm(false);
    setCourseTitle("");
    setCourseDescription("");
    setCourseFormError(null);
  }, []);

  const resetCourseSelection = useCallback(
    (mode: "push" | "replace" = "push") => {
      setSelectedCourseId(null);
      resetInlineSectionForm();
      setSelectedSectionId(null);
      setSelectedSectionTitle(null);
      writeHistoryState({ courseId: null, sectionId: null, sectionTitle: null }, mode);
    },
    [resetInlineSectionForm, writeHistoryState],
  );

  const openCourse = useCallback(
    async (courseId: string, mode: HistoryUpdateMode = "push") => {
      setError(null);
      resetInlineCourseForm();
      setSelectedCourseId(courseId);
      resetInlineSectionForm();
      try {
        await queryClient.ensureQueryData({
          queryKey: contentQueryKeys.teacherCourse(courseId),
          queryFn: () => teacherApi.getCourse(courseId),
        });
      } catch (err) {
        setError(getApiErrorMessage(err));
        return false;
      }
      if (mode !== "none") {
        writeHistoryState({ courseId, sectionId: null, sectionTitle: null }, mode);
      }
      return true;
    },
    [queryClient, resetInlineCourseForm, resetInlineSectionForm, writeHistoryState],
  );

  useEffect(() => {
    if (initialSectionId) {
      setSelectedSectionId(initialSectionId);
    }
  }, [initialSectionId]);

  useEffect(() => {
    if (initialSectionId || typeof window === "undefined") return;
    const currentState = window.history.state;
    if (!isTeacherEditHistoryState(currentState)) {
      writeHistoryState(
        {
          courseId: null,
          sectionId: null,
          sectionTitle: null,
        },
        "replace",
      );
      setHistoryReady(true);
      return;
    }

    if (!currentState.courseId) {
      setSelectedCourseId(null);
      setSelectedSectionId(null);
      setSelectedSectionTitle(null);
      setHistoryReady(true);
      return;
    }

    const { courseId, sectionId, sectionTitle: restoredSectionTitle } = currentState;
    setSelectedSectionId(sectionId);
    setSelectedSectionTitle(restoredSectionTitle);
    setHistoryReady(true);
    void openCourse(courseId, "none");
  }, [initialSectionId, openCourse, writeHistoryState]);

  useEffect(() => {
    if (initialSectionId || typeof window === "undefined") return;

    const onPopState = (event: PopStateEvent) => {
      if (!isTeacherEditHistoryState(event.state)) return;

      const next = event.state;
      if (!next.courseId) {
        setSelectedCourseId(null);
        setSelectedSectionId(null);
        setSelectedSectionTitle(null);
        return;
      }

      setSelectedSectionId(next.sectionId);
      setSelectedSectionTitle(next.sectionTitle);
      void openCourse(next.courseId, "none");
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [initialSectionId, openCourse]);

  const createCourseMutation = useMutation({ mutationFn: teacherApi.createCourse });
  const createSectionMutation = useMutation({ mutationFn: teacherApi.createSection });
  const toggleCoursePublishMutation = useMutation({
    mutationFn: async (course: Course) => {
      if (course.status === "published") {
        return teacherApi.unpublishCourse(course.id);
      }
      return teacherApi.publishCourse(course.id);
    },
  });
  const toggleSectionPublishMutation = useMutation({
    mutationFn: async (section: Section) => {
      if (section.status === "published") {
        return teacherApi.unpublishSection(section.id);
      }
      return teacherApi.publishSection(section.id);
    },
  });
  const updateCourseMutation = useMutation({
    mutationFn: ({ id, title, description }: { id: string; title: string; description: string | null }) =>
      teacherApi.updateCourse(id, { title, description }),
  });
  const updateSectionMutation = useMutation({
    mutationFn: ({ id, title, description }: { id: string; title: string; description: string | null }) =>
      teacherApi.updateSection(id, { title, description }),
  });
  const deleteCourseMutation = useMutation({ mutationFn: (courseId: string) => teacherApi.deleteCourse(courseId) });
  const deleteSectionMutation = useMutation({ mutationFn: (sectionId: string) => teacherApi.deleteSection(sectionId) });

  const creatingCourse = createCourseMutation.isPending;
  const creatingSection = createSectionMutation.isPending;
  const savingEdit = updateCourseMutation.isPending || updateSectionMutation.isPending;

  const handleCreateCourse = useCallback(async () => {
    if (!courseTitle.trim() || creatingCourse) return;
    setCourseFormError(null);
    try {
      const created = await createCourseMutation.mutateAsync({
        title: courseTitle.trim(),
        description: normalizeDescription(courseDescription),
      });
      setCourseTitle("");
      setCourseDescription("");
      setShowCourseForm(false);
      await refreshCourses();
      await openCourse(created.id, "none");
    } catch (err) {
      setCourseFormError(getApiErrorMessage(err));
    }
  }, [courseDescription, courseTitle, createCourseMutation, creatingCourse, openCourse, refreshCourses]);

  const handleCreateSection = useCallback(async () => {
    if (!selectedCourse || !sectionTitle.trim() || creatingSection) return;
    setSectionFormError(null);
    try {
      await createSectionMutation.mutateAsync({
        courseId: selectedCourse.id,
        title: sectionTitle.trim(),
        description: normalizeDescription(sectionDescription),
        sortOrder: 0,
      });
      setSectionTitle("");
      setSectionDescription("");
      setShowSectionForm(false);
      await refreshSelectedCourse(selectedCourse.id);
    } catch (err) {
      setSectionFormError(getApiErrorMessage(err));
    }
  }, [createSectionMutation, creatingSection, refreshSelectedCourse, sectionDescription, sectionTitle, selectedCourse]);

  const handlePublishCourseToggle = useCallback(async (course: Course) => {
    setError(null);
    try {
      await toggleCoursePublishMutation.mutateAsync(course);
      await refreshCourses();
      if (selectedCourseId === course.id) {
        await refreshSelectedCourse(course.id);
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, [refreshCourses, refreshSelectedCourse, selectedCourseId, toggleCoursePublishMutation]);

  const handleDeleteCourse = useCallback((course: Course) => {
    setDeleteDialog({ kind: "course", course });
  }, []);

  const confirmDeleteCourse = useCallback(async (course: Course) => {
    setError(null);
    try {
      await deleteCourseMutation.mutateAsync(course.id);
      if (selectedCourseId === course.id) {
        resetCourseSelection("replace");
      }
      await refreshCourses();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, [deleteCourseMutation, refreshCourses, resetCourseSelection, selectedCourseId]);

  const handlePublishSectionToggle = useCallback(async (section: Section) => {
    if (!selectedCourse) return;
    setError(null);
    try {
      await toggleSectionPublishMutation.mutateAsync(section);
      await refreshSelectedCourse(selectedCourse.id);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, [refreshSelectedCourse, selectedCourse, toggleSectionPublishMutation]);

  const handleDeleteSection = useCallback((section: Section) => {
    if (!selectedCourse) return;
    setDeleteDialog({ kind: "section", section });
  }, [selectedCourse]);

  const confirmDeleteSection = useCallback(async (section: Section) => {
    if (!selectedCourse) return;
    setError(null);
    try {
      await deleteSectionMutation.mutateAsync(section.id);
      await refreshSelectedCourse(selectedCourse.id);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, [deleteSectionMutation, refreshSelectedCourse, selectedCourse]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteDialog) return;
    if (deleteDialog.kind === "course") {
      await confirmDeleteCourse(deleteDialog.course);
    } else {
      await confirmDeleteSection(deleteDialog.section);
    }
    setDeleteDialog(null);
  }, [confirmDeleteCourse, confirmDeleteSection, deleteDialog]);

  const handleSectionClick = useCallback((section: Section) => {
    setSelectedSectionId(section.id);
    setSelectedSectionTitle(section.title);
    writeHistoryState(
      {
        courseId: selectedCourse?.id ?? selectedCourseId,
        sectionId: section.id,
        sectionTitle: section.title,
      },
      "push",
    );
  }, [selectedCourse, selectedCourseId, writeHistoryState]);

  const handleStartEditCourse = useCallback((course: Course) => {
    setEditDialog({ kind: "course", id: course.id });
    setEditTitle(course.title);
    setEditDescription(course.description ?? "");
    setEditError(null);
  }, []);

  const handleStartEditSection = useCallback((section: Section) => {
    setEditDialog({ kind: "section", id: section.id });
    setEditTitle(section.title);
    setEditDescription(section.description ?? "");
    setEditError(null);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editDialog) return;
    const title = editTitle.trim();
    if (!title || savingEdit) return;
    setEditError(null);
    try {
      if (editDialog.kind === "course") {
        await updateCourseMutation.mutateAsync({
          id: editDialog.id,
          title,
          description: normalizeDescription(editDescription),
        });
        await refreshCourses();
        if (selectedCourseId === editDialog.id) {
          await refreshSelectedCourse(editDialog.id);
        }
      } else if (selectedCourse) {
        const updated = await updateSectionMutation.mutateAsync({
          id: editDialog.id,
          title,
          description: normalizeDescription(editDescription),
        });
        if (selectedSectionId === updated.id) {
          setSelectedSectionTitle(updated.title);
        }
        await refreshSelectedCourse(selectedCourse.id);
      }
      setEditDialog(null);
    } catch (err) {
      setEditError(getApiErrorMessage(err));
    }
  }, [editDescription, editDialog, editTitle, refreshCourses, refreshSelectedCourse, savingEdit, selectedCourse, selectedCourseId, selectedSectionId, updateCourseMutation, updateSectionMutation]);

  const handleBackToList = useCallback(() => {
    if (initialSectionId) {
      onPushToTeacherRoot();
      return;
    }
    setSelectedSectionId(null);
    setSelectedSectionTitle(null);
    writeHistoryState(
      {
        courseId: selectedCourse?.id ?? selectedCourseId,
        sectionId: null,
        sectionTitle: null,
      },
      "push",
    );
  }, [initialSectionId, onPushToTeacherRoot, selectedCourse, selectedCourseId, writeHistoryState]);

  const handleBackToCoursesRoot = useCallback(() => {
    resetCourseSelection("push");
  }, [resetCourseSelection]);

  return {
    courses,
    selectedCourse,
    selectedCourseId,
    selectedSectionId,
    selectedSectionTitle,
    sortedSections,
    loadingCourses,
    loadingSections,
    visibleError,
    historyReady,
    courseTitle,
    setCourseTitle,
    courseDescription,
    setCourseDescription,
    sectionTitle,
    setSectionTitle,
    sectionDescription,
    setSectionDescription,
    courseFormError,
    sectionFormError,
    showCourseForm,
    showSectionForm,
    editDialog,
    editTitle,
    setEditTitle,
    editDescription,
    setEditDescription,
    editError,
    deleteDialog,
    creatingCourse,
    creatingSection,
    savingEdit,
    setDeleteDialog,
    setEditDialog,
    setShowCourseForm,
    setShowSectionForm,
    setCourseFormError,
    setSectionFormError,
    handleCreateCourse,
    handleCreateSection,
    handlePublishCourseToggle,
    handleDeleteCourse,
    handlePublishSectionToggle,
    handleDeleteSection,
    handleConfirmDelete,
    handleSectionClick,
    handleStartEditCourse,
    handleStartEditSection,
    handleSaveEdit,
    handleBackToList,
    handleBackToCoursesRoot,
    openCourse,
    refreshCourses,
    refreshSelectedCourse,
  };
};
