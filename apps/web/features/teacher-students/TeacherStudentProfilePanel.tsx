"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import LiteTex from "@/components/LiteTex";
import {
  teacherApi,
  type TeacherStudentProfileResponse,
  type TeacherStudentTreeTask,
  type TeacherStudentTreeUnit,
} from "@/lib/api/teacher";
import { getStudentTaskStatusLabel } from "@/lib/status-labels";
import { getApiErrorMessage } from "@/features/teacher-content/shared/api-errors";
import styles from "./teacher-student-profile-panel.module.css";
import TeacherStudentUnitPreviewPanel from "./TeacherStudentUnitPreviewPanel";

type Props = {
  studentId: string;
  fallbackName: string;
  onBack: () => void;
  onRefreshStudents: () => Promise<void>;
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getUnitStateSummary(unit: TeacherStudentTreeUnit) {
  const creditedCount = unit.tasks.filter((task) => task.state.isCredited).length;
  const blockedCount = unit.tasks.filter((task) => task.state.status === "blocked").length;
  const canCreditCount = unit.tasks.filter((task) => task.state.canTeacherCredit).length;
  return { creditedCount, blockedCount, canCreditCount };
}

export default function TeacherStudentProfilePanel({
  studentId,
  fallbackName,
  onBack,
  onRefreshStudents,
}: Props) {
  const [details, setDetails] = useState<TeacherStudentProfileResponse | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(undefined);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [previewUnitId, setPreviewUnitId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [previewData, setPreviewData] = useState<Awaited<
    ReturnType<typeof teacherApi.getStudentUnitPreview>
  > | null>(null);
  const [creditBusyTaskId, setCreditBusyTaskId] = useState<string | null>(null);
  const [expandedTaskIds, setExpandedTaskIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await teacherApi.getStudentProfile(studentId, {
        courseId: selectedCourseId,
      });
      setDetails(data);
      await onRefreshStudents();
    } catch (err) {
      setError(getApiErrorMessage(err));
      setDetails(null);
    } finally {
      setLoading(false);
    }
  }, [onRefreshStudents, selectedCourseId, studentId]);

  useEffect(() => {
    setSelectedCourseId(undefined);
    setSelectedSectionId(null);
    setSelectedUnitId(null);
    setPreviewUnitId(null);
    setPreviewData(null);
    setPreviewError(null);
    setPreviewExpanded(false);
    setExpandedTaskIds(new Set());
  }, [studentId]);

  useEffect(() => {
    loadDetails();
  }, [loadDetails]);

  const courseTree = details?.courseTree ?? null;

  const sections = useMemo(() => {
    if (!courseTree) return [];
    return courseTree.sections;
  }, [courseTree]);

  useEffect(() => {
    if (!sections.length) {
      setSelectedSectionId(null);
      return;
    }
    if (selectedSectionId && sections.some((section) => section.id === selectedSectionId)) return;
    setSelectedSectionId(sections[0].id);
  }, [sections, selectedSectionId]);

  const selectedSection = useMemo(() => {
    if (!selectedSectionId) return null;
    return sections.find((section) => section.id === selectedSectionId) ?? null;
  }, [sections, selectedSectionId]);

  const sectionUnits = useMemo(() => {
    if (!selectedSection) return [] as TeacherStudentTreeUnit[];
    return selectedSection.units;
  }, [selectedSection]);

  useEffect(() => {
    if (!sectionUnits.length) {
      setSelectedUnitId(null);
      return;
    }
    if (selectedUnitId && sectionUnits.some((unit) => unit.id === selectedUnitId)) return;
    setSelectedUnitId(sectionUnits[0].id);
  }, [sectionUnits, selectedUnitId]);

  const selectedUnit = useMemo(() => {
    if (!selectedUnitId) return null;
    return sectionUnits.find((unit) => unit.id === selectedUnitId) ?? null;
  }, [sectionUnits, selectedUnitId]);

  const displayName = useMemo(() => {
    const firstName = details?.profile.firstName?.trim();
    const lastName = details?.profile.lastName?.trim();
    if (firstName || lastName) {
      return [lastName, firstName].filter(Boolean).join(" ");
    }
    return details?.profile.login ?? fallbackName;
  }, [details?.profile.firstName, details?.profile.lastName, details?.profile.login, fallbackName]);

  const resetPreviewState = useCallback(() => {
    setPreviewUnitId(null);
    setPreviewData(null);
    setPreviewError(null);
    setPreviewLoading(false);
    setPreviewExpanded(false);
  }, []);

  const handleSelectSection = useCallback(
    (sectionId: string) => {
      setSelectedSectionId(sectionId);
      setSelectedUnitId(null);
      setExpandedTaskIds(new Set());
      resetPreviewState();
    },
    [resetPreviewState],
  );

  const handleSelectUnit = useCallback(
    (unitId: string) => {
      setSelectedUnitId(unitId);
      setExpandedTaskIds(new Set());
      if (previewUnitId && previewUnitId !== unitId) {
        resetPreviewState();
      }
    },
    [previewUnitId, resetPreviewState],
  );

  const handleToggleTaskStatement = useCallback((taskId: string) => {
    setExpandedTaskIds((previous) => {
      const next = new Set(previous);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const handleOpenUnitPreview = useCallback(
    async (unitId: string) => {
      setPreviewUnitId(unitId);
      setPreviewExpanded(true);
      setPreviewLoading(true);
      setPreviewError(null);
      try {
        const data = await teacherApi.getStudentUnitPreview(studentId, unitId);
        setPreviewData(data);
      } catch (err) {
        setPreviewData(null);
        setPreviewError(getApiErrorMessage(err));
      } finally {
        setPreviewLoading(false);
      }
    },
    [studentId],
  );

  const handleCreditTask = useCallback(
    async (task: TeacherStudentTreeTask) => {
      if (creditBusyTaskId) return;
      setCreditBusyTaskId(task.id);
      setError(null);
      try {
        await teacherApi.creditStudentTask(studentId, task.id);
        await loadDetails();
        if (previewUnitId) {
          await handleOpenUnitPreview(previewUnitId);
        }
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setCreditBusyTaskId(null);
      }
    },
    [creditBusyTaskId, handleOpenUnitPreview, loadDetails, previewUnitId, studentId],
  );

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
        <Button variant="ghost" onClick={onBack}>
          Назад к ученикам
        </Button>
      </header>

      {error ? (
        <div className={styles.error} role="status" aria-live="polite">
          {error}
        </div>
      ) : null}

      {loading ? <div className={styles.loading}>Загрузка…</div> : null}

      {!loading && !details ? <div className={styles.empty}>Не удалось загрузить профиль ученика.</div> : null}

      {!loading && details ? (
        <>
          <div className={styles.courseFilterRow}>
            <label className={styles.fieldLabel}>
              Курс
              <select
                className={styles.select}
                value={selectedCourseId ?? details.selectedCourseId ?? ""}
                onChange={(event) => {
                  const next = event.target.value || undefined;
                  setSelectedCourseId(next);
                  setSelectedSectionId(null);
                  setSelectedUnitId(null);
                  setExpandedTaskIds(new Set());
                  resetPreviewState();
                }}
              >
                {details.courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <section className={styles.layout}>
            <aside className={styles.sectionColumn}>
              <div className={styles.columnTitle}>Разделы</div>
              {sections.length === 0 ? (
                <div className={styles.empty}>Опубликованный курс не найден.</div>
              ) : (
                <div className={styles.sectionsList}>
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      className={`${styles.sectionButton} ${
                        selectedSectionId === section.id ? styles.sectionButtonActive : ""
                      }`}
                      onClick={() => handleSelectSection(section.id)}
                    >
                      <span className={styles.sectionButtonTitle}>{section.title}</span>
                      <span className={styles.sectionButtonMeta}>Юнитов: {section.units.length}</span>
                    </button>
                  ))}
                </div>
              )}
            </aside>

            <aside className={styles.unitsColumn}>
              <div className={styles.columnTitle}>Юниты</div>
              {!selectedSection ? (
                <div className={styles.empty}>Выберите раздел в первой колонке.</div>
              ) : sectionUnits.length === 0 ? (
                <div className={styles.empty}>В этом разделе нет опубликованных юнитов.</div>
              ) : (
                <div className={styles.unitsList}>
                  {sectionUnits.map((unit) => {
                    const summary = getUnitStateSummary(unit);
                    return (
                      <button
                        key={unit.id}
                        type="button"
                        className={`${styles.unitButton} ${
                          selectedUnitId === unit.id ? styles.unitButtonActive : ""
                        }`}
                        onClick={() => handleSelectUnit(unit.id)}
                      >
                        <span className={styles.unitTitle}>{unit.title}</span>
                        <span className={styles.unitMeta}>Зачтено {summary.creditedCount}/{unit.tasks.length}</span>
                        <span className={styles.unitStatsRow}>
                          <span className={styles.unitStatChip}>К зачету: {summary.canCreditCount}</span>
                          <span className={styles.unitStatChip}>Блок: {summary.blockedCount}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </aside>

            <section className={styles.tasksColumn}>
              <div className={styles.columnTitle}>Задачи</div>
              {selectedUnit ? (
                <>
                  <header className={styles.unitHeader}>
                    <h3 className={styles.unitHeaderTitle}>{selectedUnit.title}</h3>
                    <Button
                      variant="ghost"
                      onClick={() => handleOpenUnitPreview(selectedUnit.id)}
                      disabled={previewLoading}
                    >
                      Открыть юнит ученику
                    </Button>
                  </header>

                  <section className={styles.previewBlock}>
                    <div className={styles.previewHeader}>
                      <div className={styles.previewTitle}>Превью юнита (read-only)</div>
                      <div className={styles.previewActions}>
                        {previewUnitId === selectedUnit.id && previewData ? (
                          <Button variant="ghost" onClick={() => setPreviewExpanded((current) => !current)}>
                            {previewExpanded ? "Свернуть" : "Показать"}
                          </Button>
                        ) : null}
                        {previewUnitId === selectedUnit.id ? (
                          <Button variant="ghost" onClick={resetPreviewState}>
                            Сбросить
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    {previewUnitId !== selectedUnit.id ? (
                      <div className={styles.previewHint}>Нажмите «Открыть юнит ученику», чтобы загрузить превью.</div>
                    ) : null}

                    {previewLoading ? <div className={styles.loading}>Загрузка превью…</div> : null}
                    {previewError ? <div className={styles.error}>{previewError}</div> : null}

                    {previewUnitId === selectedUnit.id && previewData && previewExpanded ? (
                      <TeacherStudentUnitPreviewPanel unit={previewData} />
                    ) : null}
                  </section>

                  <div className={styles.tasksList}>
                    {selectedUnit.tasks.length === 0 ? (
                      <div className={styles.empty}>В этом юните нет опубликованных задач.</div>
                    ) : (
                      selectedUnit.tasks.map((task, index) => {
                        const isExpanded = expandedTaskIds.has(task.id);

                        return (
                          <article key={task.id} className={styles.taskItem}>
                            <div className={styles.taskHead}>
                              <div className={styles.taskMain}>
                                <div className={styles.taskTitleRow}>
                                  <span className={styles.taskIndex}>{index + 1}</span>
                                  {task.title ? <div className={styles.taskTitle}>{task.title}</div> : null}
                                  <span className={styles.answerTypeBadge}>{answerTypeLabel[task.answerType]}</span>
                                  {task.isRequired ? <span className={styles.requiredFlag}>Обязательная</span> : null}
                                </div>

                                <div className={styles.taskMetaLine}>
                                  <span
                                    className={`${styles.statusBadge} ${styles[statusClassName[task.state.status]]}`}
                                  >
                                    {getStudentTaskStatusLabel(task.state.status)}
                                  </span>
                                  <span>Попытки: {task.state.attemptsUsed}</span>
                                  {task.state.requiredSkippedFlag ? (
                                    <span className={styles.requiredSkipped}>Обязательная пропущена</span>
                                  ) : null}
                                  {task.state.blockedUntil ? (
                                    <span>Блок до {formatDateTime(task.state.blockedUntil)}</span>
                                  ) : null}
                                </div>
                              </div>

                              <div className={styles.taskActions}>
                                <Button variant="ghost" onClick={() => handleToggleTaskStatement(task.id)}>
                                  {isExpanded ? "Скрыть" : "Показать"}
                                </Button>
                                {task.state.canTeacherCredit ? (
                                  <Button
                                    variant="ghost"
                                    onClick={() => handleCreditTask(task)}
                                    disabled={creditBusyTaskId === task.id}
                                  >
                                    Зачесть
                                  </Button>
                                ) : null}
                              </div>
                            </div>

                            {isExpanded ? (
                              <div className={styles.taskStatement}>
                                <LiteTex value={task.statementLite} block />
                              </div>
                            ) : null}
                          </article>
                        );
                      })
                    )}
                  </div>
                </>
              ) : (
                <div className={styles.empty}>Выберите юнит во второй колонке.</div>
              )}
            </section>
          </section>
        </>
      ) : null}
    </section>
  );
}
