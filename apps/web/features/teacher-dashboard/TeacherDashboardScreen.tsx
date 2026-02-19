"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import DashboardShell from "@/components/DashboardShell";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
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
    label: "Создание и редактирование",
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
  const [sectionTitle, setSectionTitle] = useState("");
  const [courseFormError, setCourseFormError] = useState<string | null>(null);
  const [sectionFormError, setSectionFormError] = useState<string | null>(null);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [creatingSection, setCreatingSection] = useState(false);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [showSectionForm, setShowSectionForm] = useState(false);
  const coursesRequestIdRef = useRef(0);
  const sectionsRequestIdRef = useRef(0);

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
        description: null,
      });
      setCourseTitle("");
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
        sortOrder: 0,
      });
      setSectionTitle("");
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
                  }}
                >
                  Новый раздел
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setShowCourseForm((prev) => !prev);
                    setCourseFormError(null);
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
                          <div className={styles.cardMeta}>{course.description ? course.description : "Без описания"}</div>
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
