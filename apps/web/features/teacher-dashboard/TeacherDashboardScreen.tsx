"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import AlertDialog from "@/components/ui/AlertDialog";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { teacherApi } from "@/lib/api/teacher";
import type { Course, CourseWithSections, Section } from "@/lib/api/teacher";
import { contentQueryKeys } from "@/lib/query/keys";
import { getContentStatusLabel } from "@/lib/status-labels";
import { getApiErrorMessage } from "@/features/teacher-content/shared/api-errors";
import { useTeacherLogout } from "@/features/teacher-content/auth/use-teacher-logout";
import { useTeacherIdentity } from "@/features/teacher-content/shared/use-teacher-identity";
import TeacherStudentsPanel from "@/features/teacher-students/TeacherStudentsPanel";
import TeacherReviewInboxPanel from "@/features/teacher-review/TeacherReviewInboxPanel";
import TeacherReviewSubmissionDetailPanel from "@/features/teacher-review/TeacherReviewSubmissionDetailPanel";
import styles from "./teacher-dashboard.module.css";

type ActiveSection = "edit" | "students" | "review" | "analytics";

type TeacherDashboardScreenProps = {
  active: ActiveSection;
  initialSectionId?: string;
  initialStudentId?: string;
  initialSubmissionId?: string;
};

type ContentConfig = {
  title: string;
  subtitle: string;
};

type TeacherEditModeProps = {
  initialSectionId?: string;
};

type EditDialogState =
  | {
      kind: "course";
      id: string;
    }
  | {
      kind: "section";
      id: string;
    };

type DeleteDialogState =
  | { kind: "course"; course: Course }
  | { kind: "section"; section: Section }
  | null;

type HistoryUpdateMode = "push" | "replace" | "none";

type TeacherEditHistoryState = {
  __continuumTeacherEditNav: true;
  courseId: string | null;
  sectionId: string | null;
  sectionTitle: string | null;
};

const isTeacherEditHistoryState = (value: unknown): value is TeacherEditHistoryState => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TeacherEditHistoryState>;
  return candidate.__continuumTeacherEditNav === true;
};

const CONTENT_BY_SECTION: Record<ActiveSection, ContentConfig> = {
  edit: {
    title: "Создание и редактирование",
    subtitle: "Выберите курс и раздел, чтобы перейти к графу",
  },
  students: {
    title: "Ученики",
    subtitle: "",
  },
  review: {
    title: "Проверка фото",
    subtitle: "",
  },
  analytics: {
    title: "Аналитика",
    subtitle: "Раздел в разработке",
  },
};

const TeacherSectionGraphPanel = dynamic(() => import("./TeacherSectionGraphPanel"), {
  ssr: false,
  loading: () => (
    <div className={styles.placeholder}>
      <div className={styles.placeholderTitle}>Загрузка графа…</div>
      <div className={styles.placeholderSubtitle}>Подготавливаем редактор.</div>
    </div>
  ),
});

const getNavItems = (active: ActiveSection) => [
  {
    label: "Курсы",
    href: "/teacher",
    active: active === "edit",
  },
  {
    label: "Ученики",
    href: "/teacher/students",
    active: active === "students",
  },
  {
    label: "Проверка фото",
    href: "/teacher/review",
    active: active === "review",
  },
  {
    label: "Аналитика",
    href: "/teacher/analytics",
    active: active === "analytics",
  },
];

function TeacherStudentsMode({ initialStudentId }: { initialStudentId?: string }) {
  return <TeacherStudentsPanel studentId={initialStudentId} />;
}

function TeacherReviewMode({ initialSubmissionId }: { initialSubmissionId?: string }) {
  if (initialSubmissionId) {
    return <TeacherReviewSubmissionDetailPanel submissionId={initialSubmissionId} />;
  }
  return <TeacherReviewInboxPanel />;
}

function TeacherAnalyticsMode({ content }: { content: ContentConfig }) {
  return (
    <div className={styles.placeholder}>
      <div className={styles.placeholderTitle}>{content.title}</div>
      <div className={styles.placeholderSubtitle}>{content.subtitle}</div>
    </div>
  );
}

type TeacherCourseCreateFormProps = {
  title: string;
  description: string;
  error: string | null;
  saving: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

function TeacherCourseCreateForm({
  title,
  description,
  error,
  saving,
  onTitleChange,
  onDescriptionChange,
  onSave,
  onCancel,
}: TeacherCourseCreateFormProps) {
  return (
    <div className={styles.inlineForm}>
      <label className={styles.label}>
        Название курса
        <Input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          name="courseTitle"
          autoComplete="off"
          placeholder="Например, Математика 7 класс…"
        />
      </label>
      <label className={styles.label}>
        Описание курса
        <Textarea
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          name="courseDescription"
          rows={3}
          placeholder="Коротко опишите курс..."
        />
      </label>
      {error ? <div className={styles.formError}>{error}</div> : null}
      <div className={styles.actions}>
        <Button onClick={onSave} disabled={!title.trim() || saving}>
          Сохранить курс
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </div>
  );
}

type TeacherSectionCreateFormProps = {
  title: string;
  description: string;
  error: string | null;
  saving: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

function TeacherSectionCreateForm({
  title,
  description,
  error,
  saving,
  onTitleChange,
  onDescriptionChange,
  onSave,
  onCancel,
}: TeacherSectionCreateFormProps) {
  return (
    <div className={styles.inlineForm}>
      <label className={styles.label}>
        Название раздела
        <Input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          name="sectionTitle"
          autoComplete="off"
          placeholder="Например, Дроби и проценты…"
        />
      </label>
      <label className={styles.label}>
        Описание раздела
        <Textarea
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          name="sectionDescription"
          rows={3}
          placeholder="Коротко опишите, что изучают в этом разделе..."
        />
      </label>
      {error ? <div className={styles.formError}>{error}</div> : null}
      <div className={styles.actions}>
        <Button onClick={onSave} disabled={!title.trim() || saving}>
          Сохранить раздел
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </div>
  );
}

type TeacherCourseCardProps = {
  course: Course;
  isActive: boolean;
  onOpen: (courseId: string) => void;
  onPublishToggle: (course: Course) => void;
  onEdit: (course: Course) => void;
  onDelete: (course: Course) => void;
  formatCreatedAt: (value: string) => string;
};

function TeacherCourseCard({
  course,
  isActive,
  onOpen,
  onPublishToggle,
  onEdit,
  onDelete,
  formatCreatedAt,
}: TeacherCourseCardProps) {
  return (
    <div key={course.id} className={`${styles.card} ${isActive ? styles.cardActive : ""}`}>
      <button type="button" className={styles.cardMain} onClick={() => onOpen(course.id)}>
        <div className={styles.cardTitleRow}>
          <div className={styles.cardTitle}>{course.title}</div>
        </div>
        <div className={styles.cardMetaGroup}>
          <div className={styles.cardMeta}>{course.description ? course.description : "Без описания"}</div>
          <div className={styles.cardMetaMuted}>Создан: {formatCreatedAt(course.createdAt)}</div>
        </div>
      </button>
      <div className={styles.cardControls}>
        <span className={styles.status} data-status={course.status}>
          {getContentStatusLabel(course.status)}
        </span>
        <div className={styles.cardActions}>
          <Button
            variant="ghost"
            className={styles.cardIconAction}
            title={course.status === "published" ? "Снять с публикации" : "Опубликовать"}
            aria-label={course.status === "published" ? "Снять курс с публикации" : "Опубликовать курс"}
            onClick={() => onPublishToggle(course)}
          >
            {course.status === "published" ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          </Button>
          <Button
            variant="ghost"
            className={styles.cardIconAction}
            title="Редактировать курс"
            aria-label="Редактировать курс"
            onClick={() => onEdit(course)}
          >
            <Pencil size={16} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            className={styles.cardIconAction}
            title="Удалить курс"
            aria-label="Удалить курс"
            onClick={() => onDelete(course)}
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}

type TeacherSectionCardProps = {
  section: Section;
  onOpen: (section: Section) => void;
  onPublishToggle: (section: Section) => void;
  onEdit: (section: Section) => void;
  onDelete: (section: Section) => void;
  formatCreatedAt: (value: string) => string;
};

function TeacherSectionCard({
  section,
  onOpen,
  onPublishToggle,
  onEdit,
  onDelete,
  formatCreatedAt,
}: TeacherSectionCardProps) {
  return (
    <div key={section.id} className={styles.card}>
      <button type="button" className={styles.cardMain} onClick={() => onOpen(section)}>
        <div className={styles.cardTitleRow}>
          <div className={styles.cardTitle}>{section.title}</div>
        </div>
        <div className={styles.cardMetaGroup}>
          <div className={styles.cardMeta}>{section.description ? section.description : "Без описания"}</div>
          <div className={styles.cardMetaMuted}>Создан: {formatCreatedAt(section.createdAt)}</div>
        </div>
      </button>
      <div className={styles.cardControls}>
        <span className={styles.status} data-status={section.status}>
          {getContentStatusLabel(section.status)}
        </span>
        <div className={styles.cardActions}>
          <Button
            variant="ghost"
            className={styles.cardIconAction}
            title={section.status === "published" ? "Снять с публикации" : "Опубликовать"}
            aria-label={section.status === "published" ? "Снять раздел с публикации" : "Опубликовать раздел"}
            onClick={() => onPublishToggle(section)}
          >
            {section.status === "published" ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
          </Button>
          <Button
            variant="ghost"
            className={styles.cardIconAction}
            title="Редактировать раздел"
            aria-label="Редактировать раздел"
            onClick={() => onEdit(section)}
          >
            <Pencil size={16} aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            className={styles.cardIconAction}
            title="Удалить раздел"
            aria-label="Удалить раздел"
            onClick={() => onDelete(section)}
          >
            <Trash2 size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}

type TeacherEditDialogPanelProps = {
  title: string;
  description: string;
  error: string | null;
  saving: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
};

function TeacherEditDialogPanel({
  title,
  description,
  error,
  saving,
  onTitleChange,
  onDescriptionChange,
  onSave,
  onCancel,
}: TeacherEditDialogPanelProps) {
  return (
    <div className={styles.inlineForm} role="dialog" aria-label="Редактирование">
      <label className={styles.label}>
        Название
        <Input
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          name="editTitle"
          autoComplete="off"
          placeholder="Введите название..."
        />
      </label>
      <label className={styles.label}>
        Описание
        <Textarea
          value={description}
          onChange={(event) => onDescriptionChange(event.target.value)}
          name="editDescription"
          rows={3}
          placeholder="Введите описание..."
        />
      </label>
      {error ? <div className={styles.formError}>{error}</div> : null}
      <div className={styles.actions}>
        <Button onClick={onSave} disabled={!title.trim() || saving}>
          {saving ? "Сохранение..." : "Сохранить изменения"}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          Отмена
        </Button>
      </div>
    </div>
  );
}

type TeacherCourseListPanelProps = {
  courses: Course[];
  selectedCourseId: string | null;
  loadingCourses: boolean;
  showCourseForm: boolean;
  courseTitle: string;
  courseDescription: string;
  courseFormError: string | null;
  creatingCourse: boolean;
  formatCreatedAt: (value: string) => string;
  onToggleCourseForm: () => void;
  onCourseTitleChange: (value: string) => void;
  onCourseDescriptionChange: (value: string) => void;
  onCreateCourse: () => void;
  onCancelCourseForm: () => void;
  onOpenCourse: (courseId: string) => void;
  onPublishCourseToggle: (course: Course) => void;
  onEditCourse: (course: Course) => void;
  onDeleteCourse: (course: Course) => void;
};

function TeacherCourseListPanel({
  courses,
  selectedCourseId,
  loadingCourses,
  showCourseForm,
  courseTitle,
  courseDescription,
  courseFormError,
  creatingCourse,
  formatCreatedAt,
  onToggleCourseForm,
  onCourseTitleChange,
  onCourseDescriptionChange,
  onCreateCourse,
  onCancelCourseForm,
  onOpenCourse,
  onPublishCourseToggle,
  onEditCourse,
  onDeleteCourse,
}: TeacherCourseListPanelProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.breadcrumbs}>
          <span className={styles.breadcrumbCurrent}>Курсы</span>
        </div>
        <div className={styles.panelActions}>
          <Button onClick={onToggleCourseForm}>Создать курс</Button>
        </div>
      </div>

      <div className={styles.panelBody}>
        {showCourseForm ? (
          <TeacherCourseCreateForm
            title={courseTitle}
            description={courseDescription}
            error={courseFormError}
            saving={creatingCourse}
            onTitleChange={onCourseTitleChange}
            onDescriptionChange={onCourseDescriptionChange}
            onSave={onCreateCourse}
            onCancel={onCancelCourseForm}
          />
        ) : null}

        {loadingCourses ? (
          <div className={styles.empty}>Загрузка курсов…</div>
        ) : courses.length === 0 ? (
          <div className={styles.empty}>Пока нет курсов. Создайте первый.</div>
        ) : (
          <div className={styles.cardGrid}>
            {courses.map((course) => (
              <TeacherCourseCard
                key={course.id}
                course={course}
                isActive={selectedCourseId === course.id}
                onOpen={onOpenCourse}
                onPublishToggle={onPublishCourseToggle}
                onEdit={onEditCourse}
                onDelete={onDeleteCourse}
                formatCreatedAt={formatCreatedAt}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

type TeacherSectionListPanelProps = {
  selectedCourse: CourseWithSections;
  sortedSections: Section[];
  loadingSections: boolean;
  showSectionForm: boolean;
  sectionTitle: string;
  sectionDescription: string;
  sectionFormError: string | null;
  creatingSection: boolean;
  formatCreatedAt: (value: string) => string;
  onBackToCourses: () => void;
  onToggleSectionForm: () => void;
  onSectionTitleChange: (value: string) => void;
  onSectionDescriptionChange: (value: string) => void;
  onCreateSection: () => void;
  onCancelSectionForm: () => void;
  onOpenSection: (section: Section) => void;
  onPublishSectionToggle: (section: Section) => void;
  onEditSection: (section: Section) => void;
  onDeleteSection: (section: Section) => void;
};

function TeacherSectionListPanel({
  selectedCourse,
  sortedSections,
  loadingSections,
  showSectionForm,
  sectionTitle,
  sectionDescription,
  sectionFormError,
  creatingSection,
  formatCreatedAt,
  onBackToCourses,
  onToggleSectionForm,
  onSectionTitleChange,
  onSectionDescriptionChange,
  onCreateSection,
  onCancelSectionForm,
  onOpenSection,
  onPublishSectionToggle,
  onEditSection,
  onDeleteSection,
}: TeacherSectionListPanelProps) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div className={styles.breadcrumbs}>
          <button type="button" className={styles.breadcrumbLink} onClick={onBackToCourses}>
            Курсы
          </button>
          <span className={styles.breadcrumbDivider}>/</span>
          <span className={styles.breadcrumbCurrent}>{selectedCourse.title}</span>
        </div>
        <div className={styles.panelActions}>
          <Button onClick={onToggleSectionForm}>Новый раздел</Button>
        </div>
      </div>

      <div className={styles.panelBody}>
        {showSectionForm ? (
          <TeacherSectionCreateForm
            title={sectionTitle}
            description={sectionDescription}
            error={sectionFormError}
            saving={creatingSection}
            onTitleChange={onSectionTitleChange}
            onDescriptionChange={onSectionDescriptionChange}
            onSave={onCreateSection}
            onCancel={onCancelSectionForm}
          />
        ) : null}

        {loadingSections ? (
          <div className={styles.empty}>Загрузка разделов…</div>
        ) : sortedSections.length === 0 ? (
          <div className={styles.empty}>Разделов пока нет.</div>
        ) : (
          <div className={styles.cardGrid}>
            {sortedSections.map((section) => (
              <TeacherSectionCard
                key={section.id}
                section={section}
                onOpen={onOpenSection}
                onPublishToggle={onPublishSectionToggle}
                onEdit={onEditSection}
                onDelete={onDeleteSection}
                formatCreatedAt={formatCreatedAt}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TeacherEditMode({ initialSectionId }: TeacherEditModeProps) {
  const router = useRouter();
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

  const formatCreatedAt = useCallback(
    (value: string) =>
      new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(value)),
    [],
  );

  const normalizeDescription = (value: string) => {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  };

  const sortedSections = useMemo(() => {
    if (!selectedCourse) return [];
    return [...selectedCourse.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [selectedCourse]);

  const refreshCourses = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: contentQueryKeys.teacherCourses() });
  }, [queryClient]);

  const refreshSelectedCourse = useCallback(async (courseId: string) => {
    await queryClient.invalidateQueries({
      queryKey: contentQueryKeys.teacherCourse(courseId),
    });
  }, [queryClient]);

  const resetCourseSelection = useCallback(
    (mode: "push" | "replace" = "push") => {
      setSelectedCourseId(null);
      setShowSectionForm(false);
      setSectionTitle("");
      setSectionDescription("");
      setSelectedSectionId(null);
      setSelectedSectionTitle(null);
      writeHistoryState({ courseId: null, sectionId: null, sectionTitle: null }, mode);
    },
    [writeHistoryState],
  );

  const handleOpenCourse = useCallback(
    async (courseId: string, mode: HistoryUpdateMode = "push") => {
      setError(null);
      setShowCourseForm(false);
      setCourseTitle("");
      setCourseFormError(null);
      setSelectedCourseId(courseId);
      setSectionTitle("");
      setSectionDescription("");
      setShowSectionForm(false);
      setSectionFormError(null);
      try {
        await queryClient.ensureQueryData({
          queryKey: contentQueryKeys.teacherCourse(courseId),
          queryFn: () => teacherApi.getCourse(courseId),
        });
      } catch (err) {
        setError(getApiErrorMessage(err));
        return;
      }
      if (mode !== "none") {
        writeHistoryState({ courseId, sectionId: null, sectionTitle: null }, mode);
      }
    },
    [queryClient, writeHistoryState],
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

    const { courseId, sectionId, sectionTitle } = currentState;
    setSelectedSectionId(sectionId);
    setSelectedSectionTitle(sectionTitle);
    setHistoryReady(true);
    void handleOpenCourse(courseId, "none");
  }, [handleOpenCourse, initialSectionId, writeHistoryState]);

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
      void handleOpenCourse(next.courseId, "none");
    };

    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, [handleOpenCourse, initialSectionId]);

  const createCourseMutation = useMutation({
    mutationFn: teacherApi.createCourse,
  });
  const createSectionMutation = useMutation({
    mutationFn: teacherApi.createSection,
  });
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
  const deleteCourseMutation = useMutation({
    mutationFn: (courseId: string) => teacherApi.deleteCourse(courseId),
  });
  const deleteSectionMutation = useMutation({
    mutationFn: (sectionId: string) => teacherApi.deleteSection(sectionId),
  });

  const creatingCourse = createCourseMutation.isPending;
  const creatingSection = createSectionMutation.isPending;
  const savingEdit = updateCourseMutation.isPending || updateSectionMutation.isPending;

  const handleCreateCourse = async () => {
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
      await handleOpenCourse(created.id, "none");
    } catch (err) {
      setCourseFormError(getApiErrorMessage(err));
    }
  };

  const handleCreateSection = async () => {
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
  };

  const handlePublishCourseToggle = async (course: Course) => {
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
  };

  const handleDeleteCourse = async (course: Course) => {
    setDeleteDialog({ kind: "course", course });
  };

  const confirmDeleteCourse = async (course: Course) => {
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
  };

  const handlePublishSectionToggle = async (section: Section) => {
    if (!selectedCourse) return;
    setError(null);
    try {
      await toggleSectionPublishMutation.mutateAsync(section);
      await refreshSelectedCourse(selectedCourse.id);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleDeleteSection = async (section: Section) => {
    if (!selectedCourse) return;
    setDeleteDialog({ kind: "section", section });
  };

  const confirmDeleteSection = async (section: Section) => {
    if (!selectedCourse) return;
    setError(null);
    try {
      await deleteSectionMutation.mutateAsync(section.id);
      await refreshSelectedCourse(selectedCourse.id);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog) return;
    if (deleteDialog.kind === "course") {
      await confirmDeleteCourse(deleteDialog.course);
    } else {
      await confirmDeleteSection(deleteDialog.section);
    }
    setDeleteDialog(null);
  };

  const handleSectionClick = (section: Section) => {
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
  };

  const handleStartEditCourse = (course: Course) => {
    setEditDialog({ kind: "course", id: course.id });
    setEditTitle(course.title);
    setEditDescription(course.description ?? "");
    setEditError(null);
  };

  const handleStartEditSection = (section: Section) => {
    setEditDialog({ kind: "section", id: section.id });
    setEditTitle(section.title);
    setEditDescription(section.description ?? "");
    setEditError(null);
  };

  const handleSaveEdit = async () => {
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
  };

  const handleBackToList = () => {
    if (initialSectionId) {
      router.push("/teacher");
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
  };

  const handleBackToCoursesRoot = () => {
    resetCourseSelection("push");
  };

  return (
    <>
      {visibleError ? (
        <div className={styles.error} role="status" aria-live="polite">
          {visibleError}
        </div>
      ) : null}

      {!historyReady ? (
        <section className={styles.panel}>
          <div className={styles.empty}>Загрузка…</div>
        </section>
      ) : selectedSectionId ? (
        <TeacherSectionGraphPanel
          sectionId={selectedSectionId}
          sectionTitle={selectedSectionTitle}
          courseTitle={selectedCourse?.title ?? null}
          onBackToSections={handleBackToList}
          onBackToCourses={handleBackToCoursesRoot}
        />
      ) : selectedCourse ? (
        <TeacherSectionListPanel
          selectedCourse={selectedCourse}
          sortedSections={sortedSections}
          loadingSections={loadingSections}
          showSectionForm={showSectionForm}
          sectionTitle={sectionTitle}
          sectionDescription={sectionDescription}
          sectionFormError={sectionFormError}
          creatingSection={creatingSection}
          formatCreatedAt={formatCreatedAt}
          onBackToCourses={handleBackToCoursesRoot}
          onToggleSectionForm={() => {
            setShowSectionForm((prev) => !prev);
            setSectionFormError(null);
            setSectionDescription("");
          }}
          onSectionTitleChange={setSectionTitle}
          onSectionDescriptionChange={setSectionDescription}
          onCreateSection={handleCreateSection}
          onCancelSectionForm={() => setShowSectionForm(false)}
          onOpenSection={handleSectionClick}
          onPublishSectionToggle={(section) => void handlePublishSectionToggle(section)}
          onEditSection={handleStartEditSection}
          onDeleteSection={(section) => void handleDeleteSection(section)}
        />
      ) : (
        <TeacherCourseListPanel
          courses={courses}
          selectedCourseId={selectedCourseId}
          loadingCourses={loadingCourses}
          showCourseForm={showCourseForm}
          courseTitle={courseTitle}
          courseDescription={courseDescription}
          courseFormError={courseFormError}
          creatingCourse={creatingCourse}
          formatCreatedAt={formatCreatedAt}
          onToggleCourseForm={() => {
            setShowCourseForm((prev) => !prev);
            setCourseFormError(null);
            setCourseDescription("");
          }}
          onCourseTitleChange={setCourseTitle}
          onCourseDescriptionChange={setCourseDescription}
          onCreateCourse={handleCreateCourse}
          onCancelCourseForm={() => setShowCourseForm(false)}
          onOpenCourse={(courseId) => void handleOpenCourse(courseId, "push")}
          onPublishCourseToggle={(course) => void handlePublishCourseToggle(course)}
          onEditCourse={handleStartEditCourse}
          onDeleteCourse={(course) => void handleDeleteCourse(course)}
        />
      )}

      {editDialog ? (
        <TeacherEditDialogPanel
          title={editTitle}
          description={editDescription}
          error={editError}
          saving={savingEdit}
          onTitleChange={setEditTitle}
          onDescriptionChange={setEditDescription}
          onSave={handleSaveEdit}
          onCancel={() => setEditDialog(null)}
        />
      ) : null}
      <AlertDialog
        open={Boolean(deleteDialog)}
        onOpenChange={(open) => {
          if (!open) setDeleteDialog(null);
        }}
        title={deleteDialog?.kind === "course" ? "Удалить курс?" : "Удалить раздел?"}
        description={
          deleteDialog?.kind === "course"
            ? "Удаление возможно только если в курсе нет разделов."
            : "Удаление возможно только если в разделе нет юнитов."
        }
        confirmText={deleteDialog?.kind === "course" ? "Удалить курс" : "Удалить раздел"}
        cancelText="Отмена"
        destructive
        onConfirm={() => void handleConfirmDelete()}
      />
    </>
  );
}

export default function TeacherDashboardScreen({
  active,
  initialSectionId,
  initialStudentId,
  initialSubmissionId,
}: TeacherDashboardScreenProps) {
  const router = useRouter();
  const handleLogout = useTeacherLogout();
  const identity = useTeacherIdentity();
  const content = CONTENT_BY_SECTION[active];
  const navItems = useMemo(() => getNavItems(active), [active]);
  const showMainHeader = active !== "edit";

  const renderActiveMode = () => {
    switch (active) {
      case "students":
        return <TeacherStudentsMode initialStudentId={initialStudentId} />;
      case "review":
        return <TeacherReviewMode initialSubmissionId={initialSubmissionId} />;
      case "analytics":
        return <TeacherAnalyticsMode content={content} />;
      case "edit":
      default:
        return <TeacherEditMode initialSectionId={initialSectionId} />;
    }
  };

  return (
    <DashboardShell
      title={identity.displayName || "Преподаватель"}
      navItems={navItems}
      appearance="glass"
      onLogout={handleLogout}
      settingsHref="/teacher/settings"
    >
      <div className={styles.content}>
        {showMainHeader ? (
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>{content.title}</h1>
              {content.subtitle ? <p className={styles.subtitle}>{content.subtitle}</p> : null}
            </div>
            {active === "students" && initialStudentId ? (
              <div className={styles.panelActions}>
                <Button variant="ghost" onClick={() => router.push("/teacher/students")}>
                  Назад к ученикам
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}

        {renderActiveMode()}
      </div>
    </DashboardShell>
  );
}
