"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight, GraduationCap } from "lucide-react";
import LiteTex from "@/components/LiteTex";
import Button from "@/components/ui/Button";
import {
  teacherApi,
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
  locked: "unitStatusLocked",
  available: "unitStatusAvailable",
  in_progress: "unitStatusInProgress",
  completed: "unitStatusCompleted",
};

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

  const [reviewTotal, setReviewTotal] = useState(0);

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
    } catch (err) {
      setError(formatApiErrorPayload(err));
      setDetails(null);
    } finally {
      setLoading(false);
    }
  }, [activeCourseId, studentId]);

  const loadReviewPreview = useCallback(async () => {
    try {
      const response = await teacherApi.listTeacherPhotoInbox({
        status: "pending_review",
        studentId,
        sort: "oldest",
        limit: 1,
        offset: 0,
      });
      setReviewTotal(response.total);
    } catch {
      setReviewTotal(0);
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
    if (!details || !activeCourseId) return null;
    const courseId = activeCourseId;
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
        void onRefreshStudents?.();
      } catch (err) {
        setError(formatApiErrorPayload(err));
      } finally {
        setOverrideBusyUnitId(null);
      }
    },
    [loadDetails, loadReviewPreview, onRefreshStudents, overrideBusyUnitId, studentId],
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
        void onRefreshStudents?.();
      } catch (err) {
        setError(formatApiErrorPayload(err));
      } finally {
        setCreditBusyTaskId(null);
      }
    },
    [creditBusyTaskId, loadDetails, loadReviewPreview, onRefreshStudents, studentId],
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
          {details ? (
            <div className={styles.headerMetaRow}>
              <span className={styles.headerMetaItem}>
                <span className={styles.headerMetaGlyph} aria-hidden="true">
                  @
                </span>
                <span className={styles.headerMetaValue}>{details.profile.login}</span>
              </span>
              <span className={styles.headerMetaItem}>
                <GraduationCap className={styles.headerMetaIcon} aria-hidden="true" />
                <span className={styles.headerMetaValue}>{details.profile.leadTeacherLogin ?? "—"}</span>
              </span>
            </div>
          ) : null}
        </div>
        <div className={styles.headerActions}>
          <Button
            variant="ghost"
            className={styles.reviewQueueButton}
            data-pending={reviewTotal > 0 ? "true" : "false"}
            onClick={() => openReviewInbox()}
          >
            Фото на проверке: {reviewTotal}
          </Button>
        </div>
      </header>

      <section className={styles.drilldown}>
        <header className={styles.drillHeader}>
          <h3 className={styles.stageTitle}>Материалы и прогресс</h3>
          <nav className={styles.pathNav} aria-label="Иерархия контента">
            <button
              type="button"
              className={`${styles.pathButton} ${
                !selectedCourse && !selectedSection && !selectedUnit ? styles.pathCurrent : ""
              }`}
              onClick={goCoursesRoot}
            >
              Курсы
            </button>
            {selectedCourse ? (
              <>
                <span className={styles.pathSeparator}>›</span>
                <button
                  type="button"
                  className={`${styles.pathButton} ${
                    selectedCourse && !selectedSection && !selectedUnit ? styles.pathCurrent : ""
                  }`}
                  onClick={goSectionsRoot}
                >
                  {selectedCourse.title}
                </button>
              </>
            ) : null}
            {selectedSection ? (
              <>
                <span className={styles.pathSeparator}>›</span>
                <button
                  type="button"
                  className={`${styles.pathButton} ${
                    selectedSection && !selectedUnit ? styles.pathCurrent : ""
                  }`}
                  onClick={goUnitsRoot}
                >
                  {selectedSection.title}
                </button>
              </>
            ) : null}
            {selectedUnit ? (
              <>
                <span className={styles.pathSeparator}>›</span>
                <button
                  type="button"
                  className={`${styles.pathButton} ${styles.pathCurrent}`}
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
              </>
            ) : null}
          </nav>
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
                <div className={styles.list}>
                  {details.courses.map((course) => (
                    <article
                      key={course.id}
                      className={`${styles.card} ${styles.clickableCard}`}
                      onClick={() => openCourse(course.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openCourse(course.id);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className={styles.cardTitle}>{course.title}</div>
                      <div className={styles.metaRow}>Откройте курс, чтобы посмотреть разделы и юниты.</div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}

            {stage === "sections" ? (
              <section>
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
                        <article
                          key={section.id}
                          className={`${styles.card} ${styles.clickableCard}`}
                          onClick={() => openSection(section.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openSection(section.id);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                        >
                          <div className={styles.cardTitle}>{section.title}</div>
                          <div className={styles.metaRow}>Юнитов: {section.units.length}</div>
                          <div className={styles.metaRow}>На проверке фото: {sectionPendingCount}</div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            ) : null}

            {stage === "units" ? (
              <section>
                {!selectedSection || selectedSection.units.length === 0 ? (
                  <div className={styles.empty}>В разделе нет опубликованных юнитов.</div>
                ) : (
                  <div className={styles.unitsTableWrap}>
                    <table className={styles.unitsTable}>
                      <thead>
                        <tr>
                          <th scope="col">Юнит</th>
                          <th scope="col">Статус</th>
                          <th scope="col">Прогресс</th>
                          <th scope="col">Решено</th>
                          <th scope="col">Фото</th>
                          <th scope="col" className={styles.unitsActionsHeader}>
                            Действия
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedSection.units.map((unit) => {
                          const pendingPhotoCount = countPendingInUnit(unit);
                          return (
                            <tr key={unit.id}>
                              <td className={styles.unitTitleCell}>
                                <button
                                  type="button"
                                  className={styles.unitTitleButton}
                                  onClick={() => openUnit(unit.id)}
                                >
                                  {unit.title}
                                </button>
                                {unit.state.overrideOpened ? (
                                  <div className={styles.unitTitleMeta}>Открыт вручную</div>
                                ) : null}
                              </td>
                              <td className={styles.tableCenterCell}>
                                <span
                                  className={`${styles.statusBadge} ${styles[unitStatusClassName[unit.state.status]]}`}
                                >
                                  {getStudentUnitStatusLabel(unit.state.status)}
                                </span>
                              </td>
                              <td className={styles.tableCenterCell}>
                                <div className={styles.unitProgressCell}>
                                  <div className={styles.progressTrack} aria-hidden="true">
                                    <span
                                      className={styles.progressFill}
                                      style={{
                                        width: `${Math.max(0, Math.min(unit.state.completionPercent, 100))}%`,
                                      }}
                                    />
                                  </div>
                                  <span className={styles.progressValue}>
                                    {formatPercent(unit.state.completionPercent)}
                                  </span>
                                </div>
                              </td>
                              <td
                                className={`${styles.tableCenterCell} ${
                                  unit.state.solvedPercent >= 100 ? styles.solvedAccent : ""
                                }`}
                              >
                                {formatPercent(unit.state.solvedPercent)}
                              </td>
                              <td className={styles.tableCenterCell}>
                                {pendingPhotoCount > 0 ? (
                                  <span className={`${styles.photoPendingFlag} ${styles.photoPendingStrong}`}>
                                    {pendingPhotoCount}
                                  </span>
                                ) : (
                                  <span className={styles.tableMuted}>0</span>
                                )}
                              </td>
                              <td className={styles.unitActionsCell}>
                                {unit.state.status === "locked" ? (
                                  <Button
                                    variant="ghost"
                                    className={`${styles.inlineActionButton} ${styles.inlineActionAccent}`}
                                    onClick={() => void handleOverrideOpenUnit(unit.id)}
                                    disabled={overrideBusyUnitId === unit.id || unit.state.overrideOpened}
                                  >
                                    {unit.state.overrideOpened
                                      ? "Открыт"
                                      : overrideBusyUnitId === unit.id
                                        ? "Открываем…"
                                        : "Открыть вручную"}
                                  </Button>
                                ) : (
                                  <span className={styles.tableMuted}>—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ) : null}

            {stage === "tasks" ? (
              <section>
                <p className={styles.stageSubtitle}>Задачи юнита: {selectedUnit?.title ?? "-"}</p>
                {!selectedUnit ? (
                  <div className={styles.empty}>Юнит не найден.</div>
                ) : selectedUnit.tasks.length === 0 ? (
                  <div className={styles.empty}>В этом юните нет опубликованных задач.</div>
                ) : (
                  <div className={styles.tasksTableWrap}>
                    <table className={styles.tasksTable}>
                      <thead>
                        <tr>
                          <th scope="col" className={styles.tasksNumberHeader}>
                            №
                          </th>
                          <th scope="col" className={styles.tasksTypeHeader}>
                            Тип
                          </th>
                          <th scope="col" className={styles.tasksStatusHeader}>
                            Статус
                          </th>
                          <th scope="col" className={styles.tasksAttemptsHeader}>
                            Попытки
                          </th>
                          <th scope="col" className={styles.tasksPhotoHeader}>
                            Фото
                          </th>
                          <th scope="col" className={styles.tasksActionsHeader}>
                            Действия
                          </th>
                          <th scope="col" className={styles.tasksExpandHeader} />
                        </tr>
                      </thead>
                      <tbody>
                        {selectedUnit.tasks.map((task, index) => {
                          const hasPendingPhoto = task.answerType === "photo" && task.pendingPhotoReviewCount > 0;
                          const statementExpanded = selectedTaskId === task.id;
                          const taskRowClassName = [
                            statementExpanded ? styles.taskRowExpanded : "",
                            task.isRequired ? styles.requiredTaskRow : "",
                          ]
                            .filter(Boolean)
                            .join(" ");
                          return (
                            <Fragment key={task.id}>
                              <tr className={taskRowClassName || undefined}>
                                <td className={styles.taskNumberCell}>
                                  <span className={styles.taskNumberValue}>{index + 1}</span>
                                </td>
                                <td className={styles.tableCenterCell}>
                                  <span className={styles.answerTypeBadge}>{answerTypeLabel[task.answerType]}</span>
                                </td>
                                <td className={styles.tableCenterCell}>
                                  <span className={`${styles.statusBadge} ${styles[statusClassName[task.state.status]]}`}>
                                    {getStudentTaskStatusLabel(task.state.status)}
                                  </span>
                                </td>
                                <td className={styles.tableCenterCell}>{task.state.attemptsUsed}</td>
                                <td className={styles.tableCenterCell}>
                                  {hasPendingPhoto ? (
                                    <button
                                      type="button"
                                      className={`${styles.photoPendingFlag} ${styles.photoPendingButton}`}
                                      onClick={() =>
                                        openReviewInbox({
                                          courseId: selectedCourse?.id ?? courseTree?.id,
                                          sectionId: selectedSection?.id,
                                          unitId: selectedUnit.id,
                                          taskId: task.id,
                                        })
                                      }
                                      title="Открыть проверку фото"
                                    >
                                      {task.pendingPhotoReviewCount}
                                    </button>
                                  ) : (
                                    <span className={styles.tableMuted}>0</span>
                                  )}
                                </td>
                                <td className={styles.taskActionsCell}>
                                  <div className={styles.tableActions}>
                                    {task.state.canTeacherCredit ? (
                                      <Button
                                        variant="ghost"
                                        className={`${styles.inlineActionButton} ${styles.inlineActionAccent}`}
                                        onClick={() => void handleCreditTask(task)}
                                        disabled={creditBusyTaskId === task.id}
                                      >
                                        {creditBusyTaskId === task.id ? "Зачёт…" : "Зачесть"}
                                      </Button>
                                    ) : (
                                      <span className={styles.tableMuted}>—</span>
                                    )}
                                  </div>
                                </td>
                                <td className={styles.statementToggleCell}>
                                  <button
                                    type="button"
                                    className={styles.statementToggleButton}
                                    onClick={() => toggleTaskStatement(task.id)}
                                    aria-label={statementExpanded ? "Скрыть условие" : "Показать условие"}
                                    title={statementExpanded ? "Скрыть условие" : "Показать условие"}
                                  >
                                    {statementExpanded ? (
                                      <ChevronDown className={styles.statementToggleIcon} aria-hidden="true" />
                                    ) : (
                                      <ChevronRight className={styles.statementToggleIcon} aria-hidden="true" />
                                    )}
                                  </button>
                                </td>
                              </tr>
                              {statementExpanded ? (
                                <tr className={styles.taskStatementRow}>
                                  <td colSpan={7} className={styles.taskStatementCell}>
                                    <LiteTex value={task.statementLite} block />
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
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
