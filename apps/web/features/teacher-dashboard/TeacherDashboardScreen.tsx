"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { teacherApi, Course, CourseWithSections, Section } from "@/lib/api/teacher";
import { getApiErrorMessage } from "@/features/teacher-content/shared/api-errors";
import TeacherSectionGraphPanel from "./TeacherSectionGraphPanel";
import styles from "./teacher-dashboard.module.css";

type ActiveSection = "edit" | "students" | "analytics";

type TeacherDashboardScreenProps = {
  active: ActiveSection;
  initialSectionId?: string;
};

type ContentConfig = {
  title: string;
  subtitle: string;
};

export default function TeacherDashboardScreen({ active, initialSectionId }: TeacherDashboardScreenProps) {
  const router = useRouter();
  const isEditMode = active === "edit";
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
  const [courseFormError, setCourseFormError] = useState<string | null>(null);
  const [sectionFormError, setSectionFormError] = useState<string | null>(null);
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [creatingSection, setCreatingSection] = useState(false);

  const content = useMemo<ContentConfig>(() => {
    switch (active) {
      case "students":
        return {
          title: "Ученики",
          subtitle: "Раздел в разработке",
        };
      case "analytics":
        return {
          title: "Аналитика",
          subtitle: "Раздел в разработке",
        };
      case "edit":
      default:
        return {
          title: "Создание и редактирование",
          subtitle: "Выберите курс и раздел, чтобы перейти к графу",
        };
    }
  }, [active]);

  const navItems = [
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
      label: "Аналитика",
      href: "/teacher/analytics",
      active: active === "analytics",
    },
  ];

  const sortedSections = useMemo(() => {
    if (!selectedCourse) return [];
    return [...selectedCourse.sections].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [selectedCourse]);

  const fetchCourses = useCallback(async () => {
    if (!isEditMode) return;
    setLoadingCourses(true);
    setError(null);
    try {
      const data = await teacherApi.listCourses();
      setCourses(data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoadingCourses(false);
    }
  }, [isEditMode]);

  const selectCourse = useCallback(async (courseId: string) => {
    if (!isEditMode) return;
    setSelectedCourseId(courseId);
    setSelectedCourse(null);
    setLoadingSections(true);
    setSectionTitle("");
    setSectionFormError(null);
    try {
      const data = await teacherApi.getCourse(courseId);
      setSelectedCourse(data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoadingSections(false);
    }
  }, [isEditMode]);

  useEffect(() => {
    fetchCourses();
  }, [fetchCourses]);

  useEffect(() => {
    if (initialSectionId && isEditMode) {
      setSelectedSectionId(initialSectionId);
    }
  }, [initialSectionId, isEditMode]);

  const handleCreateCourse = async () => {
    if (!courseTitle.trim() || creatingCourse) return;
    setCourseFormError(null);
    setCreatingCourse(true);
    try {
      const created = await teacherApi.createCourse({
        title: courseTitle.trim(),
        description: courseDescription.trim() || null,
      });
      setCourseTitle("");
      setCourseDescription("");
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
      await selectCourse(selectedCourse.id);
    } catch (err) {
      setSectionFormError(getApiErrorMessage(err));
    } finally {
      setCreatingSection(false);
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
    <DashboardShell title="Преподаватель" subtitle="Панель" navItems={navItems}>
      <div className={styles.content}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{content.title}</h1>
            <p className={styles.subtitle}>{content.subtitle}</p>
          </div>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}

        {active !== "edit" ? (
          <div className={styles.placeholder}>
            <div className={styles.placeholderTitle}>{content.title}</div>
            <div className={styles.placeholderSubtitle}>{content.subtitle}</div>
          </div>
        ) : selectedSectionId ? (
          <TeacherSectionGraphPanel
            sectionId={selectedSectionId}
            sectionTitle={selectedSectionTitle}
            onBack={handleBackToList}
          />
        ) : (
          <div className={styles.panels}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={styles.panelKicker}>Курсы</div>
                  <div className={styles.panelTitle}>Структура контента</div>
                </div>
              </div>
              <div className={styles.panelBody}>
                <div className={styles.formStack}>
                  <label className={styles.label}>
                    Название курса
                    <Input
                      value={courseTitle}
                      onChange={(event) => setCourseTitle(event.target.value)}
                      placeholder="Например, Математика 7 класс"
                    />
                  </label>
                  <label className={styles.label}>
                    Описание
                    <Input
                      value={courseDescription}
                      onChange={(event) => setCourseDescription(event.target.value)}
                      placeholder="Короткая заметка (опционально)"
                    />
                  </label>
                  {courseFormError ? (
                    <div className={styles.formError}>{courseFormError}</div>
                  ) : null}
                  <div className={styles.actions}>
                    <Button
                      onClick={handleCreateCourse}
                      disabled={!courseTitle.trim() || creatingCourse}
                    >
                      Создать курс
                    </Button>
                    <Button variant="ghost" onClick={fetchCourses} disabled={loadingCourses}>
                      Обновить список
                    </Button>
                  </div>
                </div>

                <div className={styles.list}>
                  {loadingCourses ? (
                    <div className={styles.empty}>Загрузка курсов...</div>
                  ) : courses.length === 0 ? (
                    <div className={styles.empty}>Пока нет курсов. Создайте первый.</div>
                  ) : (
                    courses.map((course) => (
                      <button
                        key={course.id}
                        type="button"
                        onClick={() => selectCourse(course.id)}
                        className={`${styles.listItem} ${
                          selectedCourseId === course.id ? styles.listItemActive : ""
                        }`}
                      >
                        <div className={styles.itemInfo}>
                          <div className={styles.itemTitle}>{course.title}</div>
                          <div className={styles.itemMeta}>
                            {course.description ? course.description : "Без описания"}
                          </div>
                        </div>
                        <span
                          className={styles.status}
                          data-status={course.status}
                        >
                          {course.status === "published" ? "Опубликован" : "Черновик"}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <div className={styles.panelKicker}>Разделы</div>
                  <div className={styles.panelTitle}>
                    {selectedCourse ? selectedCourse.title : "Выберите курс"}
                  </div>
                </div>
              </div>
              <div className={styles.panelBody}>
                {!selectedCourse ? (
                  <div className={styles.empty}>Нажмите на курс слева, чтобы увидеть разделы.</div>
                ) : loadingSections ? (
                  <div className={styles.empty}>Загрузка разделов...</div>
                ) : (
                  <>
                    <div className={styles.formStack}>
                      <label className={styles.label}>
                        Название раздела
                        <Input
                          value={sectionTitle}
                          onChange={(event) => setSectionTitle(event.target.value)}
                          placeholder="Например, Дроби и проценты"
                        />
                      </label>
                      {sectionFormError ? (
                        <div className={styles.formError}>{sectionFormError}</div>
                      ) : null}
                      <div className={styles.actions}>
                        <Button
                          onClick={handleCreateSection}
                          disabled={!sectionTitle.trim() || creatingSection}
                        >
                          Создать раздел
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => selectCourse(selectedCourse.id)}
                        >
                          Обновить разделы
                        </Button>
                      </div>
                    </div>

                    <div className={styles.list}>
                      {sortedSections.length === 0 ? (
                        <div className={styles.empty}>Разделов пока нет.</div>
                      ) : (
                        sortedSections.map((section) => (
                          <button
                            key={section.id}
                            type="button"
                            className={styles.listItem}
                            onClick={() => handleSectionClick(section)}
                          >
                            <div className={styles.itemInfo}>
                              <div className={styles.itemTitle}>{section.title}</div>
                              <div className={styles.itemMeta}>Перейти к графу раздела</div>
                            </div>
                            <span className={styles.status} data-status={section.status}>
                              {section.status === "published" ? "Опубликован" : "Черновик"}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
