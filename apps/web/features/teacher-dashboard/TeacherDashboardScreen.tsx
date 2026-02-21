"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Pencil, Trash2 } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { teacherApi, Course, CourseWithSections, Section } from "@/lib/api/teacher";
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

function TeacherEditMode({ initialSectionId }: TeacherEditModeProps) {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseWithSections | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedSectionTitle, setSelectedSectionTitle] = useState<string | null>(null);
  const [loadingCourses, setLoadingCourses] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [courseTitle, setCourseTitle] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionDescription, setSectionDescription] = useState("");
  const [courseFormError, setCourseFormError] = useState<string | null>(null);
  const [sectionFormError, setSectionFormError] = useState<string | null>(null);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [creatingSection, setCreatingSection] = useState(false);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const [editDialog, setEditDialog] = useState<EditDialogState | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const coursesRequestIdRef = useRef(0);
  const sectionsRequestIdRef = useRef(0);

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

  const fetchCourses = useCallback(async () => {
    const requestId = ++coursesRequestIdRef.current;
    setLoadingCourses(true);
    setError(null);
    try {
      const data = await teacherApi.listCourses();
      if (requestId !== coursesRequestIdRef.current) return;
      setCourses(data);
    } catch (err) {
      if (requestId !== coursesRequestIdRef.current) return;
      setError(getApiErrorMessage(err));
    } finally {
      if (requestId === coursesRequestIdRef.current) {
        setLoadingCourses(false);
      }
    }
  }, []);

  const selectCourse = useCallback(async (courseId: string) => {
    const requestId = ++sectionsRequestIdRef.current;
    setSelectedCourseId(courseId);
    setSelectedCourse(null);
    setLoadingSections(true);
    setSectionTitle("");
    setSectionDescription("");
    setShowSectionForm(false);
    setSectionFormError(null);
    try {
      const data = await teacherApi.getCourse(courseId);
      if (requestId !== sectionsRequestIdRef.current) return;
      setSelectedCourse(data);
    } catch (err) {
      if (requestId !== sectionsRequestIdRef.current) return;
      setError(getApiErrorMessage(err));
    } finally {
      if (requestId === sectionsRequestIdRef.current) {
        setLoadingSections(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    if (initialSectionId) {
      setSelectedSectionId(initialSectionId);
    }
  }, [initialSectionId]);

  const handleCreateCourse = async () => {
    if (!courseTitle.trim() || creatingCourse) return;
    setCourseFormError(null);
    setCreatingCourse(true);
    try {
      const created = await teacherApi.createCourse({
        title: courseTitle.trim(),
        description: normalizeDescription(courseDescription),
      });
      setCourseTitle("");
      setCourseDescription("");
      setShowCourseForm(false);
      await fetchCourses();
      await selectCourse(created.id);
    } catch (err) {
      setCourseFormError(getApiErrorMessage(err));
    } finally {
      setCreatingCourse(false);
    }
  };

  const handleCreateSection = async () => {
    if (!selectedCourse || !sectionTitle.trim() || creatingSection) return;
    setSectionFormError(null);
    setCreatingSection(true);
    try {
      await teacherApi.createSection({
        courseId: selectedCourse.id,
        title: sectionTitle.trim(),
        description: normalizeDescription(sectionDescription),
        sortOrder: 0,
      });
      setSectionTitle("");
      setSectionDescription("");
      setShowSectionForm(false);
      await selectCourse(selectedCourse.id);
    } catch (err) {
      setSectionFormError(getApiErrorMessage(err));
    } finally {
      setCreatingSection(false);
    }
  };

  const handlePublishCourseToggle = async (course: Course) => {
    setError(null);
    try {
      if (course.status === "published") {
        await teacherApi.unpublishCourse(course.id);
      } else {
        await teacherApi.publishCourse(course.id);
      }
      await fetchCourses();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleDeleteCourse = async (course: Course) => {
    const confirmed = window.confirm("Удалить курс? Удаление возможно только если в курсе нет разделов.");
    if (!confirmed) return;
    setError(null);
    try {
      await teacherApi.deleteCourse(course.id);
      if (selectedCourseId === course.id) {
        setSelectedCourse(null);
        setSelectedCourseId(null);
      }
      await fetchCourses();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handlePublishSectionToggle = async (section: Section) => {
    if (!selectedCourse) return;
    setError(null);
    try {
      if (section.status === "published") {
        await teacherApi.unpublishSection(section.id);
      } else {
        await teacherApi.publishSection(section.id);
      }
      await selectCourse(selectedCourse.id);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleDeleteSection = async (section: Section) => {
    if (!selectedCourse) return;
    const confirmed = window.confirm("Удалить раздел? Удаление возможно только если в разделе нет юнитов.");
    if (!confirmed) return;
    setError(null);
    try {
      await teacherApi.deleteSection(section.id);
      await selectCourse(selectedCourse.id);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleSectionClick = (section: Section) => {
    setSelectedSectionId(section.id);
    setSelectedSectionTitle(section.title);
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
    setSavingEdit(true);
    try {
      if (editDialog.kind === "course") {
        await teacherApi.updateCourse(editDialog.id, {
          title,
          description: normalizeDescription(editDescription),
        });
        await fetchCourses();
        if (selectedCourseId === editDialog.id) {
          await selectCourse(editDialog.id);
        }
      } else if (selectedCourse) {
        const updated = await teacherApi.updateSection(editDialog.id, {
          title,
          description: normalizeDescription(editDescription),
        });
        if (selectedSectionId === updated.id) {
          setSelectedSectionTitle(updated.title);
        }
        await selectCourse(selectedCourse.id);
      }
      setEditDialog(null);
    } catch (err) {
      setEditError(getApiErrorMessage(err));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleBackToList = () => {
    if (initialSectionId) {
      router.push("/teacher");
      return;
    }
    setSelectedSectionId(null);
    setSelectedSectionTitle(null);
  };

  return (
    <>
      {error ? (
        <div className={styles.error} role="status" aria-live="polite">
          {error}
        </div>
      ) : null}

      {selectedSectionId ? (
        <TeacherSectionGraphPanel
          sectionId={selectedSectionId}
          sectionTitle={selectedSectionTitle}
          courseTitle={selectedCourse?.title ?? null}
          onBack={handleBackToList}
        />
      ) : (
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.breadcrumbs}>
              {selectedCourse ? (
                <>
                  <button
                    type="button"
                    className={styles.breadcrumbLink}
                    onClick={() => {
                      setSelectedCourse(null);
                      setSelectedCourseId(null);
                      setShowSectionForm(false);
                      setSectionTitle("");
                      setSectionDescription("");
                    }}
                  >
                    Курсы
                  </button>
                  <span className={styles.breadcrumbDivider}>/</span>
                  <span className={styles.breadcrumbCurrent}>{selectedCourse.title}</span>
                </>
              ) : (
                <span className={styles.breadcrumbCurrent}>Курсы</span>
              )}
            </div>
            <div className={styles.panelActions}>
              {selectedCourse ? (
                <Button
                  onClick={() => {
                    setShowSectionForm((prev) => !prev);
                    setSectionFormError(null);
                    setSectionDescription("");
                  }}
                >
                  Новый раздел
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setShowCourseForm((prev) => !prev);
                    setCourseFormError(null);
                    setCourseDescription("");
                  }}
                >
                  Создать курс
                </Button>
              )}
            </div>
          </div>

          <div className={styles.panelBody}>
            {selectedCourse ? (
              <>
                {showSectionForm ? (
                  <div className={styles.inlineForm}>
                    <label className={styles.label}>
                      Название раздела
                      <Input
                        value={sectionTitle}
                        onChange={(event) => setSectionTitle(event.target.value)}
                        name="sectionTitle"
                        autoComplete="off"
                        placeholder="Например, Дроби и проценты…"
                      />
                    </label>
                    <label className={styles.label}>
                      Описание раздела
                      <Textarea
                        value={sectionDescription}
                        onChange={(event) => setSectionDescription(event.target.value)}
                        name="sectionDescription"
                        rows={3}
                        placeholder="Коротко опишите, что изучают в этом разделе..."
                      />
                    </label>
                    {sectionFormError ? (
                      <div className={styles.formError}>{sectionFormError}</div>
                    ) : null}
                    <div className={styles.actions}>
                      <Button onClick={handleCreateSection} disabled={!sectionTitle.trim() || creatingSection}>
                        Сохранить раздел
                      </Button>
                      <Button variant="ghost" onClick={() => setShowSectionForm(false)}>
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : null}

                {loadingSections ? (
                  <div className={styles.empty}>Загрузка разделов…</div>
                ) : sortedSections.length === 0 ? (
                  <div className={styles.empty}>Разделов пока нет.</div>
                ) : (
                  <div className={styles.cardGrid}>
                    {sortedSections.map((section) => (
                      <div key={section.id} className={styles.card}>
                        <button type="button" className={styles.cardMain} onClick={() => handleSectionClick(section)}>
                          <div className={styles.cardTitleRow}>
                            <div className={styles.cardTitle}>{section.title}</div>
                          </div>
                          <div className={styles.cardMetaGroup}>
                            <div className={styles.cardMeta}>
                              {section.description ? section.description : "Без описания"}
                            </div>
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
                              aria-label={
                                section.status === "published"
                                  ? "Снять раздел с публикации"
                                  : "Опубликовать раздел"
                              }
                              onClick={() => handlePublishSectionToggle(section)}
                            >
                              {section.status === "published" ? (
                                <EyeOff size={16} aria-hidden="true" />
                              ) : (
                                <Eye size={16} aria-hidden="true" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              className={styles.cardIconAction}
                              title="Редактировать раздел"
                              aria-label="Редактировать раздел"
                              onClick={() => handleStartEditSection(section)}
                            >
                              <Pencil size={16} aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              className={styles.cardIconAction}
                              title="Удалить раздел"
                              aria-label="Удалить раздел"
                              onClick={() => handleDeleteSection(section)}
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                {showCourseForm ? (
                  <div className={styles.inlineForm}>
                    <label className={styles.label}>
                      Название курса
                      <Input
                        value={courseTitle}
                        onChange={(event) => setCourseTitle(event.target.value)}
                        name="courseTitle"
                        autoComplete="off"
                        placeholder="Например, Математика 7 класс…"
                      />
                    </label>
                    <label className={styles.label}>
                      Описание курса
                      <Textarea
                        value={courseDescription}
                        onChange={(event) => setCourseDescription(event.target.value)}
                        name="courseDescription"
                        rows={3}
                        placeholder="Коротко опишите курс..."
                      />
                    </label>
                    {courseFormError ? <div className={styles.formError}>{courseFormError}</div> : null}
                    <div className={styles.actions}>
                      <Button onClick={handleCreateCourse} disabled={!courseTitle.trim() || creatingCourse}>
                        Сохранить курс
                      </Button>
                      <Button variant="ghost" onClick={() => setShowCourseForm(false)}>
                        Отмена
                      </Button>
                    </div>
                  </div>
                ) : null}

                {loadingCourses ? (
                  <div className={styles.empty}>Загрузка курсов…</div>
                ) : courses.length === 0 ? (
                  <div className={styles.empty}>Пока нет курсов. Создайте первый.</div>
                ) : (
                  <div className={styles.cardGrid}>
                    {courses.map((course) => (
                      <div
                        key={course.id}
                        className={`${styles.card} ${selectedCourseId === course.id ? styles.cardActive : ""}`}
                      >
                        <button
                          type="button"
                          className={styles.cardMain}
                          onClick={() => {
                            setShowCourseForm(false);
                            setCourseTitle("");
                            setCourseFormError(null);
                            void selectCourse(course.id);
                          }}
                        >
                          <div className={styles.cardTitleRow}>
                            <div className={styles.cardTitle}>{course.title}</div>
                          </div>
                          <div className={styles.cardMetaGroup}>
                            <div className={styles.cardMeta}>
                              {course.description ? course.description : "Без описания"}
                            </div>
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
                              aria-label={
                                course.status === "published" ? "Снять курс с публикации" : "Опубликовать курс"
                              }
                              onClick={() => void handlePublishCourseToggle(course)}
                            >
                              {course.status === "published" ? (
                                <EyeOff size={16} aria-hidden="true" />
                              ) : (
                                <Eye size={16} aria-hidden="true" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              className={styles.cardIconAction}
                              title="Редактировать курс"
                              aria-label="Редактировать курс"
                              onClick={() => handleStartEditCourse(course)}
                            >
                              <Pencil size={16} aria-hidden="true" />
                            </Button>
                            <Button
                              variant="ghost"
                              className={styles.cardIconAction}
                              title="Удалить курс"
                              aria-label="Удалить курс"
                              onClick={() => void handleDeleteCourse(course)}
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}

      {editDialog ? (
        <div className={styles.inlineForm} role="dialog" aria-label="Редактирование">
          <label className={styles.label}>
            Название
            <Input
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              name="editTitle"
              autoComplete="off"
              placeholder="Введите название..."
            />
          </label>
          <label className={styles.label}>
            Описание
            <Textarea
              value={editDescription}
              onChange={(event) => setEditDescription(event.target.value)}
              name="editDescription"
              rows={3}
              placeholder="Введите описание..."
            />
          </label>
          {editError ? <div className={styles.formError}>{editError}</div> : null}
          <div className={styles.actions}>
            <Button onClick={handleSaveEdit} disabled={!editTitle.trim() || savingEdit}>
              {savingEdit ? "Сохранение..." : "Сохранить изменения"}
            </Button>
            <Button variant="ghost" onClick={() => setEditDialog(null)}>
              Отмена
            </Button>
          </div>
        </div>
      ) : null}
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
