"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import LiteTex from "@/components/LiteTex";
import Button from "@/components/ui/Button";
import {
  teacherApi,
  type TeacherReviewInboxItem,
  type TeacherStudentProfileResponse,
  type TeacherStudentTreeTask,
  type TeacherStudentTreeUnit,
} from "@/lib/api/teacher";
import { getStudentTaskStatusLabel, getStudentUnitStatusLabel } from "@/lib/status-labels";
import { formatApiErrorPayload } from "@/features/teacher-content/shared/api-errors";
import { buildReviewSearch } from "@/features/teacher-review/review-query";
import styles from "./teacher-student-profile-panel.module.css";

type Props = {
  studentId: string;
  fallbackName: string;
  onBack: () => void;
  onRefreshStudents?: () => Promise<void>;
};

const answerTypeLabel: Record<TeacherStudentTreeTask["answerType"], string> = {
  numeric: "Числовая",
  single_choice: "Один выбор",
  multi_choice: "Несколько выборов",
  photo: "Фото",
};

const statusClassName: Record<TeacherStudentTreeTask["state"]["status"], string> = {
  not_started: "statusNeutral",
  in_progress: "statusNeutral",
  pending_review: "statusWarning",
  accepted: "statusSuccess",
  rejected: "statusDanger",
  blocked: "statusDanger",
  credited_without_progress: "statusWarning",
  correct: "statusSuccess",
  teacher_credited: "statusSuccess",
};

const unitStatusClassName: Record<TeacherStudentTreeUnit["state"]["status"], string> = {
  locked: "statusDanger",
  available: "statusNeutral",
  in_progress: "statusWarning",
  completed: "statusSuccess",
};

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatPercent = (value: number) => `${Math.round(value)}%`;

const getDisplayName = (
  firstName?: string | null,
  lastName?: string | null,
  login?: string | null,
  fallback?: string,
) => {
  const parts = [lastName?.trim(), firstName?.trim()].filter(Boolean);
  if (parts.length) return parts.join(" ");
  return login ?? fallback ?? "Ученик";
};

const countPendingInUnit = (unit: TeacherStudentTreeUnit) =>
  unit.tasks.reduce((acc, task) => acc + task.pendingPhotoReviewCount, 0);

export default function TeacherStudentProfilePanel({
  studentId,
  fallbackName,
  onBack,
  onRefreshStudents,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const focusedCourseId = searchParams.get("courseId")?.trim() || null;
  const focusedSectionId = searchParams.get("sectionId")?.trim() || null;
  const focusedUnitId = searchParams.get("unitId")?.trim() || null;
  const focusedTaskId = searchParams.get("taskId")?.trim() || null;

  const [details, setDetails] = useState<TeacherStudentProfileResponse | null>(null);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(focusedCourseId);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(focusedSectionId);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(focusedUnitId);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(focusedTaskId);
  const [creditBusyTaskId, setCreditBusyTaskId] = useState<string | null>(null);
  const [overrideBusyUnitId, setOverrideBusyUnitId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reviewPreviewItems, setReviewPreviewItems] = useState<TeacherReviewInboxItem[]>([]);
  const [reviewTotal, setReviewTotal] = useState(0);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    setActiveCourseId(focusedCourseId);
    setSelectedSectionId(focusedSectionId);
    setSelectedUnitId(focusedUnitId);
    setSelectedTaskId(focusedTaskId);
    setActionNotice(null);
    setError(null);
  }, [focusedCourseId, focusedSectionId, focusedTaskId, focusedUnitId, studentId]);

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

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await teacherApi.getStudentProfile(studentId, {
        courseId: activeCourseId ?? undefined,
      });
      setDetails(data);
      if (onRefreshStudents) {
        await onRefreshStudents();
      }
    } catch (err) {
      setError(formatApiErrorPayload(err));
      setDetails(null);
    } finally {
      setLoading(false);
    }
  }, [activeCourseId, onRefreshStudents, studentId]);

  const loadReviewPreview = useCallback(async () => {
    setReviewLoading(true);
    setReviewError(null);
    try {
      const response = await teacherApi.listTeacherPhotoInbox({
        status: "pending_review",
        studentId,
        sort: "oldest",
        limit: 3,
        offset: 0,
      });
      setReviewPreviewItems(response.items);
      setReviewTotal(response.total);
    } catch (err) {
      setReviewPreviewItems([]);
      setReviewTotal(0);
      setReviewError(formatApiErrorPayload(err));
    } finally {
      setReviewLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  useEffect(() => {
    void loadReviewPreview();
  }, [loadReviewPreview]);

  const courseTree = details?.courseTree ?? null;

  useEffect(() => {
    if (!courseTree) {
      setSelectedSectionId(null);
      setSelectedUnitId(null);
      setSelectedTaskId(null);
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
  }, [courseTree, selectedSectionId, selectedTaskId, selectedUnitId]);

  const selectedCourse = useMemo(() => {
    if (!details) return null;
    const courseId = activeCourseId ?? details.selectedCourseId ?? null;
    if (!courseId) return null;
    return details.courses.find((course) => course.id === courseId) ?? null;
  }, [activeCourseId, details]);

  const selectedSection = useMemo(() => {
    if (!courseTree || !selectedSectionId) return null;
    return courseTree.sections.find((section) => section.id === selectedSectionId) ?? null;
  }, [courseTree, selectedSectionId]);

  const selectedUnit = useMemo(() => {
    if (!selectedSection || !selectedUnitId) return null;
    return selectedSection.units.find((unit) => unit.id === selectedUnitId) ?? null;
  }, [selectedSection, selectedUnitId]);

  const displayName = useMemo(
    () => getDisplayName(details?.profile.firstName, details?.profile.lastName, details?.profile.login, fallbackName),
    [details?.profile.firstName, details?.profile.lastName, details?.profile.login, fallbackName],
  );

  const stage: "courses" | "sections" | "units" | "tasks" = !activeCourseId
    ? "courses"
    : !selectedSectionId
      ? "sections"
      : !selectedUnitId
        ? "units"
        : "tasks";

  const openReviewInbox = useCallback(
    (params?: { courseId?: string; sectionId?: string; unitId?: string; taskId?: string }) => {
      const search = buildReviewSearch({
        status: "pending_review",
        sort: "oldest",
        studentId,
        courseId: params?.courseId,
        sectionId: params?.sectionId,
        unitId: params?.unitId,
        taskId: params?.taskId,
      });
      router.push(`/teacher/review${search ? `?${search}` : ""}`);
    },
    [router, studentId],
  );

  const handleOverrideOpenUnit = useCallback(
    async (unitId: string) => {
      if (overrideBusyUnitId) return;
      setOverrideBusyUnitId(unitId);
      setError(null);
      setActionNotice(null);
      try {
        await teacherApi.overrideOpenUnit(studentId, unitId);
        setActionNotice("Доступ к юниту открыт вручную. Статусы обновлены.");
        await Promise.all([loadDetails(), loadReviewPreview()]);
      } catch (err) {
        setError(formatApiErrorPayload(err));
      } finally {
        setOverrideBusyUnitId(null);
      }
    },
    [loadDetails, loadReviewPreview, overrideBusyUnitId, studentId],
  );

  const handleCreditTask = useCallback(
    async (task: TeacherStudentTreeTask) => {
      if (creditBusyTaskId) return;
      setCreditBusyTaskId(task.id);
      setError(null);
      setActionNotice(null);
      try {
        await teacherApi.creditTask(studentId, task.id);
        setActionNotice("Задача зачтена. Прогресс и доступность пересчитаны.");
        await Promise.all([loadDetails(), loadReviewPreview()]);
      } catch (err) {
        setError(formatApiErrorPayload(err));
      } finally {
        setCreditBusyTaskId(null);
      }
    },
    [creditBusyTaskId, loadDetails, loadReviewPreview, studentId],
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

  return (
    <section className={styles.panel}>
      <header className={styles.header}>
        <div className={styles.headerMain}>
          <h2 className={styles.title}>{displayName}</h2>
          <p className={styles.subtitle}>
            {details
              ? `Логин: ${details.profile.login} · Ведущий учитель: ${details.profile.leadTeacherLogin}`
              : ""}
          </p>
        </div>
        <div className={styles.headerActions}>
          <span className={reviewTotal > 0 ? styles.headerAttentionBadge : styles.headerAttentionMuted}>
            {reviewTotal > 0 ? `Требует внимания: ${reviewTotal}` : "Требующих проверки нет"}
          </span>
          <Button variant="ghost" onClick={onBack}>
            Назад к ученикам
          </Button>
        </div>
      </header>

      <section className={styles.needsReviewBlock} aria-label="Требуется проверка">
        <header className={styles.needsReviewHeader}>
          <div>
            <h3 className={styles.needsReviewTitle}>Требуется проверка</h3>
            <p className={styles.needsReviewHint}>Очередь фото-проверок вынесена в отдельный workflow.</p>
          </div>
          <div className={styles.needsReviewCounter}>На проверке: {reviewTotal}</div>
        </header>

        {reviewError ? (
          <div className={styles.error} role="status" aria-live="polite">
            {reviewError}
          </div>
        ) : null}

        {reviewLoading ? <div className={styles.loading}>Загрузка очереди…</div> : null}

        {!reviewLoading && reviewTotal === 0 ? <div className={styles.neutralState}>Нет задач на проверке</div> : null}

        {reviewPreviewItems.length ? (
          <div className={styles.previewList}>
            {reviewPreviewItems.map((item) => (
              <article key={item.submissionId} className={styles.previewItem}>
                <div className={styles.previewPath}>
                  {item.course.title} / {item.section.title} / {item.unit.title}
                </div>
                <div className={styles.previewTask}>{item.task.title ?? `Задача ${item.task.id}`}</div>
                <div className={styles.previewMeta}>Отправлено: {formatDateTime(item.submittedAt)}</div>
              </article>
            ))}
          </div>
        ) : null}

        <Button onClick={() => openReviewInbox()} disabled={reviewTotal === 0 && !reviewPreviewItems.length}>
          Открыть очередь проверок ({reviewTotal})
        </Button>
      </section>

      <section className={styles.drilldown}>
        <header className={styles.drillHeader}>
          <div>
            <div className={styles.columnTitle}>Drilldown Навигация</div>
            <h3 className={styles.stageTitle}>Курс → Раздел → Юнит → Задача</h3>
          </div>
          <div className={styles.breadcrumbs}>
            <button type="button" className={styles.breadcrumbButton} onClick={goCoursesRoot}>
              Профиль
            </button>
            {selectedCourse ? (
              <button
                type="button"
                className={`${styles.breadcrumbButton} ${activeCourseId ? styles.breadcrumbActive : ""}`}
                onClick={goSectionsRoot}
              >
                {selectedCourse.title}
              </button>
            ) : null}
            {selectedSection ? (
              <button
                type="button"
                className={`${styles.breadcrumbButton} ${selectedSectionId ? styles.breadcrumbActive : ""}`}
                onClick={goUnitsRoot}
              >
                {selectedSection.title}
              </button>
            ) : null}
            {selectedUnit ? (
              <button
                type="button"
                className={`${styles.breadcrumbButton} ${selectedUnitId ? styles.breadcrumbActive : ""}`}
                onClick={() => {
                  if (!activeCourseId || !selectedSectionId || !selectedUnitId) return;
                  setSelectedTaskId(null);
                  syncContext({
                    courseId: activeCourseId,
                    sectionId: selectedSectionId,
                    unitId: selectedUnitId,
                  });
                }}
              >
                {selectedUnit.title}
              </button>
            ) : null}
          </div>
        </header>

        {error ? (
          <div className={styles.error} role="status" aria-live="polite">
            {error}
          </div>
        ) : null}

        {actionNotice ? (
          <div className={styles.notice} role="status" aria-live="polite">
            {actionNotice}
          </div>
        ) : null}

        {loading ? <div className={styles.loading}>Загрузка структуры…</div> : null}

        {!loading && !details ? <div className={styles.empty}>Не удалось загрузить профиль ученика.</div> : null}

        {!loading && details ? (
          <>
            {stage === "courses" ? (
              <section>
                <p className={styles.stageSubtitle}>Выберите курс ученика</p>
                <div className={styles.list}>
                  {details.courses.map((course) => (
                    <article key={course.id} className={styles.card}>
                      <div className={styles.cardTitle}>{course.title}</div>
                      <div className={styles.metaRow}>
                        Шаг 1/4: курс открывает структуру Раздел → Юнит → Задачи
                      </div>
                      <div className={styles.actions}>
                        <Button variant="ghost" onClick={() => openCourse(course.id)}>
                          Открыть курс
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {stage === "sections" ? (
              <section>
                <p className={styles.stageSubtitle}>Курс: {selectedCourse?.title ?? courseTree?.title ?? "-"}</p>
                {!courseTree || courseTree.sections.length === 0 ? (
                  <div className={styles.empty}>В курсе нет опубликованных разделов.</div>
                ) : (
                  <div className={styles.list}>
                    {courseTree.sections.map((section) => {
                      const sectionPendingCount = section.units.reduce(
                        (acc, unit) => acc + countPendingInUnit(unit),
                        0,
                      );
                      return (
                        <article key={section.id} className={styles.card}>
                          <div className={styles.cardTitle}>{section.title}</div>
                          <div className={styles.metaRow}>Юнитов: {section.units.length}</div>
                          <div className={styles.metaRow}>На проверке фото: {sectionPendingCount}</div>
                          <div className={styles.actions}>
                            <Button variant="ghost" onClick={() => openSection(section.id)}>
                              Открыть раздел
                            </Button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : null}

            {stage === "units" ? (
              <section>
                <p className={styles.stageSubtitle}>Раздел: {selectedSection?.title ?? "-"}</p>
                {!selectedSection || selectedSection.units.length === 0 ? (
                  <div className={styles.empty}>В разделе нет опубликованных юнитов.</div>
                ) : (
                  <div className={styles.list}>
                    {selectedSection.units.map((unit) => (
                      <article
                        key={unit.id}
                        className={`${styles.card} ${styles.clickableCard}`}
                        onClick={() => openUnit(unit.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openUnit(unit.id);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <div className={styles.cardTitle}>{unit.title}</div>
                        <div className={styles.metaRow}>
                          <span className={`${styles.statusBadge} ${styles[unitStatusClassName[unit.state.status]]}`}>
                            {getStudentUnitStatusLabel(unit.state.status)}
                          </span>
                          <span>Прогресс: {formatPercent(unit.state.completionPercent)}</span>
                          <span>Решено: {formatPercent(unit.state.solvedPercent)}</span>
                        </div>
                        <div className={styles.metaRow}>На проверке фото: {countPendingInUnit(unit)}</div>
                        <div className={styles.metaRow}>Нажмите карточку, чтобы открыть задачи юнита</div>
                        {unit.state.overrideOpened ? (
                          <div className={styles.unitOverrideFlag}>Открыт вручную</div>
                        ) : null}
                        <div className={styles.actions}>
                          {unit.state.status === "locked" ? (
                            <Button
                              variant="ghost"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleOverrideOpenUnit(unit.id);
                              }}
                              disabled={overrideBusyUnitId === unit.id || unit.state.overrideOpened}
                            >
                              {unit.state.overrideOpened
                                ? "Юнит открыт"
                                : overrideBusyUnitId === unit.id
                                  ? "Открываем юнит…"
                                  : "Открыть юнит"}
                            </Button>
                          ) : null}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {stage === "tasks" ? (
              <section>
                <p className={styles.stageSubtitle}>Юнит: {selectedUnit?.title ?? "-"}</p>
                {!selectedUnit ? (
                  <div className={styles.empty}>Юнит не найден.</div>
                ) : selectedUnit.tasks.length === 0 ? (
                  <div className={styles.empty}>В этом юните нет опубликованных задач.</div>
                ) : (
                  <div className={styles.list}>
                    {selectedUnit.tasks.map((task, index) => {
                      const hasPendingPhoto = task.answerType === "photo" && task.pendingPhotoReviewCount > 0;
                      const statementExpanded = selectedTaskId === task.id;
                      return (
                        <article key={task.id} className={styles.card}>
                          <div className={styles.cardTitle}>{task.title ?? `Задача ${index + 1}`}</div>
                          <div className={styles.metaRow}>
                            <span className={styles.answerTypeBadge}>{answerTypeLabel[task.answerType]}</span>
                            {task.isRequired ? <span className={styles.requiredFlag}>Обязательная</span> : null}
                            {hasPendingPhoto ? (
                              <span className={styles.photoPendingFlag}>На проверке: {task.pendingPhotoReviewCount}</span>
                            ) : null}
                          </div>
                          <div className={styles.metaRow}>
                            <span className={`${styles.statusBadge} ${styles[statusClassName[task.state.status]]}`}>
                              {getStudentTaskStatusLabel(task.state.status)}
                            </span>
                            <span>Попытки: {task.state.attemptsUsed}</span>
                          </div>
                          <div className={styles.inlineActions}>
                            <button
                              type="button"
                              className={styles.inlineActionButton}
                              onClick={() => toggleTaskStatement(task.id)}
                            >
                              {statementExpanded ? "Скрыть условие" : "Показать условие"}
                            </button>
                            {hasPendingPhoto ? (
                              <button
                                type="button"
                                className={styles.inlineActionButton}
                                onClick={() =>
                                  openReviewInbox({
                                    courseId: selectedCourse?.id ?? courseTree?.id,
                                    sectionId: selectedSection?.id,
                                    unitId: selectedUnit.id,
                                    taskId: task.id,
                                  })
                                }
                              >
                                К проверке фото
                              </button>
                            ) : null}
                          </div>
                          <div className={styles.actions}>
                            {task.state.canTeacherCredit ? (
                              <Button
                                variant="ghost"
                                onClick={() => void handleCreditTask(task)}
                                disabled={creditBusyTaskId === task.id}
                              >
                                {creditBusyTaskId === task.id ? "Зачёт…" : "Зачесть задачу"}
                              </Button>
                            ) : null}
                          </div>
                          {statementExpanded ? (
                            <div className={styles.taskStatement}>
                              <LiteTex value={task.statementLite} block />
                            </div>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : null}
          </>
        ) : null}
      </section>
    </section>
  );
}
