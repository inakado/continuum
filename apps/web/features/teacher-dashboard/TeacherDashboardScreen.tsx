"use client";

import { useCallback, useMemo, type ChangeEvent, type RefObject } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { ImagePlus, Pencil, Trash2 } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import AlertDialog from "@/components/ui/AlertDialog";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Switch from "@/components/ui/Switch";
import Textarea from "@/components/ui/Textarea";
import type { Course, CourseWithSections, Section } from "@/lib/api/teacher";
import { getContentStatusLabel } from "@/lib/status-labels";
import { useTeacherLogout } from "@/features/teacher-content/auth/use-teacher-logout";
import { useTeacherIdentity } from "@/features/teacher-content/shared/use-teacher-identity";
import TeacherStudentsPanel from "@/features/teacher-students/TeacherStudentsPanel";
import TeacherReviewInboxPanel from "@/features/teacher-review/TeacherReviewInboxPanel";
import TeacherReviewSubmissionDetailPanel from "@/features/teacher-review/TeacherReviewSubmissionDetailPanel";
import { useTeacherEditCoverImage } from "./hooks/use-teacher-edit-cover-image";
import { useTeacherEditMode } from "./hooks/use-teacher-edit-mode";
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
          <Switch
            className={styles.cardPublishSwitch}
            checked={course.status === "published"}
            onCheckedChange={() => onPublishToggle(course)}
            aria-label={course.status === "published" ? "Снять курс с публикации" : "Опубликовать курс"}
            title={course.status === "published" ? "Снять с публикации" : "Опубликовать"}
          />
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
          <Switch
            className={styles.cardPublishSwitch}
            checked={section.status === "published"}
            onCheckedChange={() => onPublishToggle(section)}
            aria-label={section.status === "published" ? "Снять раздел с публикации" : "Опубликовать раздел"}
            title={section.status === "published" ? "Снять с публикации" : "Опубликовать"}
          />
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
  coverImageUrl: string | null;
  coverImageStatusText: string;
  error: string | null;
  saving: boolean;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onPickCoverImage: () => void;
  onRemoveCoverImage: () => void;
  onCoverImageSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  onCoverImagePreviewError: () => void;
  coverImageInputRef: RefObject<HTMLInputElement | null>;
  onSave: () => void;
  onCancel: () => void;
};

function TeacherEditDialogPanel({
  title,
  description,
  coverImageUrl,
  coverImageStatusText,
  error,
  saving,
  onTitleChange,
  onDescriptionChange,
  onPickCoverImage,
  onRemoveCoverImage,
  onCoverImageSelected,
  onCoverImagePreviewError,
  coverImageInputRef,
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
      <div className={styles.coverEditor}>
        <div className={styles.coverEditorHeader}>
          <span className={styles.labelTitle}>Обложка</span>
          <input
            ref={coverImageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className={styles.coverInput}
            onChange={onCoverImageSelected}
          />
          <div className={styles.coverActions}>
            <Button variant="ghost" onClick={onPickCoverImage}>
              <ImagePlus size={14} aria-hidden="true" />
              Загрузить
            </Button>
            {coverImageUrl ? (
              <Button variant="ghost" onClick={onRemoveCoverImage}>
                Удалить
              </Button>
            ) : null}
          </div>
        </div>
        {coverImageUrl ? (
          <div className={styles.coverPreviewWrap}>
            <img
              src={coverImageUrl}
              alt=""
              className={styles.coverPreview}
              onError={onCoverImagePreviewError}
            />
          </div>
        ) : (
          <div className={styles.coverPlaceholder}>Обложка пока не загружена.</div>
        )}
        <div className={styles.coverStatus}>{coverImageStatusText}</div>
      </div>
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
  const formatCreatedAt = useCallback(
    (value: string) =>
      new Intl.DateTimeFormat("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(value)),
    [],
  );
  const {
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
  } = useTeacherEditMode({
    initialSectionId,
    onPushToTeacherRoot: () => router.push("/teacher"),
  });

  const editingEntity = useMemo(() => {
    if (!editDialog) return null;
    if (editDialog.kind === "course") {
      const course = courses.find((item) => item.id === editDialog.id) ?? null;
      return {
        kind: "course" as const,
        id: editDialog.id,
        assetKey: course?.coverImageAssetKey ?? null,
      };
    }

    const section = sortedSections.find((item) => item.id === editDialog.id) ?? null;
    return {
      kind: "section" as const,
      id: editDialog.id,
      assetKey: section?.coverImageAssetKey ?? null,
    };
  }, [courses, editDialog, sortedSections]);

  const handleRefreshEditEntity = useCallback(async () => {
    await refreshCourses();
    if (selectedCourseId) {
      await refreshSelectedCourse(selectedCourseId);
    }
  }, [refreshCourses, refreshSelectedCourse, selectedCourseId]);

  const {
    coverImageInputRef,
    coverImageState,
    coverImageStatusText,
    handleCoverImageSelected,
    handleCoverImageRemove,
    handleCoverImagePreviewError,
  } = useTeacherEditCoverImage({
    editingEntity,
    onAfterChange: handleRefreshEditEntity,
  });

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
          onOpenCourse={(courseId) => void openCourse(courseId, "push")}
          onPublishCourseToggle={(course) => void handlePublishCourseToggle(course)}
          onEditCourse={handleStartEditCourse}
          onDeleteCourse={(course) => void handleDeleteCourse(course)}
        />
      )}

      {editDialog ? (
        <TeacherEditDialogPanel
          title={editTitle}
          description={editDescription}
          coverImageUrl={coverImageState.previewUrl}
          coverImageStatusText={coverImageStatusText}
          error={editError}
          saving={savingEdit}
          onTitleChange={setEditTitle}
          onDescriptionChange={setEditDescription}
          onPickCoverImage={() => coverImageInputRef.current?.click()}
          onRemoveCoverImage={() => void handleCoverImageRemove()}
          onCoverImageSelected={handleCoverImageSelected}
          onCoverImagePreviewError={handleCoverImagePreviewError}
          coverImageInputRef={coverImageInputRef}
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
