"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import LiteTex from "@/components/LiteTex";
import {
  teacherApi,
  type TeacherPhotoSubmission,
  type TeacherStudentPhotoQueueItem,
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

const reviewStatusLabel: Record<TeacherPhotoSubmission["status"], string> = {
  submitted: "На проверке",
  accepted: "Принято",
  rejected: "Отклонено",
};

const reviewStatusClassName: Record<TeacherPhotoSubmission["status"], string> = {
  submitted: "photoReviewStatusSubmitted",
  accepted: "photoReviewStatusAccepted",
  rejected: "photoReviewStatusRejected",
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

  const [photoQueueItems, setPhotoQueueItems] = useState<TeacherStudentPhotoQueueItem[]>([]);
  const [photoQueueTotal, setPhotoQueueTotal] = useState(0);
  const [photoQueueLoading, setPhotoQueueLoading] = useState(false);
  const [photoQueueError, setPhotoQueueError] = useState<string | null>(null);

  const [photoReviewTaskId, setPhotoReviewTaskId] = useState<string | null>(null);
  const [photoReviewItems, setPhotoReviewItems] = useState<TeacherPhotoSubmission[]>([]);
  const [photoReviewLoading, setPhotoReviewLoading] = useState(false);
  const [photoReviewError, setPhotoReviewError] = useState<string | null>(null);
  const [photoReviewNotice, setPhotoReviewNotice] = useState<string | null>(null);
  const [photoReviewBusySubmissionId, setPhotoReviewBusySubmissionId] = useState<string | null>(null);
  const [photoRejectReasonBySubmission, setPhotoRejectReasonBySubmission] = useState<Record<string, string>>({});
  const [photoPreviewUrlByAssetKey, setPhotoPreviewUrlByAssetKey] = useState<Record<string, string>>({});

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

  const loadPhotoQueue = useCallback(async () => {
    setPhotoQueueLoading(true);
    setPhotoQueueError(null);
    try {
      const response = await teacherApi.listStudentPhotoQueue(studentId, {
        status: "submitted",
        limit: 50,
        offset: 0,
      });
      setPhotoQueueItems(response.items);
      setPhotoQueueTotal(response.total);
    } catch (err) {
      setPhotoQueueItems([]);
      setPhotoQueueTotal(0);
      setPhotoQueueError(getApiErrorMessage(err));
    } finally {
      setPhotoQueueLoading(false);
    }
  }, [studentId]);

  const loadPhotoTaskHistory = useCallback(
    async (taskId: string) => {
      setPhotoReviewLoading(true);
      setPhotoReviewError(null);
      try {
        const response = await teacherApi.listStudentTaskPhotoSubmissions(studentId, taskId);
        setPhotoReviewItems(response.items);
      } catch (err) {
        setPhotoReviewItems([]);
        setPhotoReviewError(getApiErrorMessage(err));
      } finally {
        setPhotoReviewLoading(false);
      }
    },
    [studentId],
  );

  const getPhotoPreviewUrl = useCallback(
    async (taskId: string, assetKey: string) => {
      const cached = photoPreviewUrlByAssetKey[assetKey];
      if (cached) return cached;
      const response = await teacherApi.presignStudentTaskPhotoView(studentId, taskId, assetKey, 300);
      setPhotoPreviewUrlByAssetKey((previous) => ({ ...previous, [assetKey]: response.url }));
      return response.url;
    },
    [photoPreviewUrlByAssetKey, studentId],
  );

  useEffect(() => {
    setSelectedCourseId(undefined);
    setSelectedSectionId(null);
    setSelectedUnitId(null);
    setPreviewUnitId(null);
    setPreviewData(null);
    setPreviewError(null);
    setPreviewExpanded(false);
    setExpandedTaskIds(new Set());
    setPhotoQueueItems([]);
    setPhotoQueueTotal(0);
    setPhotoQueueError(null);
    setPhotoReviewTaskId(null);
    setPhotoReviewItems([]);
    setPhotoReviewError(null);
    setPhotoReviewNotice(null);
    setPhotoReviewBusySubmissionId(null);
    setPhotoRejectReasonBySubmission({});
    setPhotoPreviewUrlByAssetKey({});
  }, [studentId]);

  useEffect(() => {
    void loadDetails();
  }, [loadDetails]);

  useEffect(() => {
    void loadPhotoQueue();
  }, [loadPhotoQueue]);

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

  const queuedPhotoTaskIds = useMemo(() => {
    return new Set(photoQueueItems.map((item) => item.taskId));
  }, [photoQueueItems]);

  const selectedReviewQueueItem = useMemo(() => {
    if (!photoReviewTaskId) return null;
    return photoQueueItems.find((item) => item.taskId === photoReviewTaskId) ?? null;
  }, [photoQueueItems, photoReviewTaskId]);

  const selectedReviewTaskTitle = useMemo(() => {
    if (selectedReviewQueueItem?.taskTitle) return selectedReviewQueueItem.taskTitle;
    if (!photoReviewTaskId) return null;
    for (const section of sections) {
      for (const unit of section.units) {
        const task = unit.tasks.find((item) => item.id === photoReviewTaskId);
        if (task?.title) return task.title;
      }
    }
    return null;
  }, [photoReviewTaskId, sections, selectedReviewQueueItem?.taskTitle]);

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

  const handleOpenPhotoReview = useCallback(
    async (taskId: string, unitId: string) => {
      const sectionWithUnit = sections.find((section) => section.units.some((unit) => unit.id === unitId));
      if (sectionWithUnit) {
        setSelectedSectionId(sectionWithUnit.id);
      }
      setSelectedUnitId(unitId);
      setPhotoReviewTaskId(taskId);
      setPhotoReviewError(null);
      setPhotoReviewNotice(null);
      await loadPhotoTaskHistory(taskId);
    },
    [loadPhotoTaskHistory, sections],
  );

  const handleCreditTask = useCallback(
    async (task: TeacherStudentTreeTask) => {
      if (creditBusyTaskId) return;
      setCreditBusyTaskId(task.id);
      setError(null);
      try {
        await teacherApi.creditStudentTask(studentId, task.id);
        await Promise.all([loadDetails(), loadPhotoQueue()]);
        if (photoReviewTaskId === task.id) {
          await loadPhotoTaskHistory(task.id);
        }
        if (previewUnitId) {
          await handleOpenUnitPreview(previewUnitId);
        }
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setCreditBusyTaskId(null);
      }
    },
    [
      creditBusyTaskId,
      handleOpenUnitPreview,
      loadDetails,
      loadPhotoQueue,
      loadPhotoTaskHistory,
      photoReviewTaskId,
      previewUnitId,
      studentId,
    ],
  );

  const handleAcceptSubmission = useCallback(
    async (submissionId: string) => {
      if (!photoReviewTaskId || photoReviewBusySubmissionId) return;
      setPhotoReviewBusySubmissionId(submissionId);
      setPhotoReviewError(null);
      try {
        await teacherApi.acceptStudentTaskPhotoSubmission(studentId, photoReviewTaskId, submissionId);
        setPhotoReviewNotice("Фото принято. Статус задачи и прогресс ученика обновлены.");
        await Promise.all([loadDetails(), loadPhotoQueue(), loadPhotoTaskHistory(photoReviewTaskId)]);
        if (previewUnitId) {
          await handleOpenUnitPreview(previewUnitId);
        }
      } catch (err) {
        setPhotoReviewError(getApiErrorMessage(err));
      } finally {
        setPhotoReviewBusySubmissionId(null);
      }
    },
    [
      handleOpenUnitPreview,
      loadDetails,
      loadPhotoQueue,
      loadPhotoTaskHistory,
      photoReviewBusySubmissionId,
      photoReviewTaskId,
      previewUnitId,
      studentId,
    ],
  );

  const handleRejectSubmission = useCallback(
    async (submissionId: string) => {
      if (!photoReviewTaskId || photoReviewBusySubmissionId) return;
      setPhotoReviewBusySubmissionId(submissionId);
      setPhotoReviewError(null);
      try {
        await teacherApi.rejectStudentTaskPhotoSubmission(
          studentId,
          photoReviewTaskId,
          submissionId,
          photoRejectReasonBySubmission[submissionId],
        );
        setPhotoReviewNotice("Фото отклонено. Ученик может отправить ответ заново.");
        await Promise.all([loadDetails(), loadPhotoQueue(), loadPhotoTaskHistory(photoReviewTaskId)]);
        if (previewUnitId) {
          await handleOpenUnitPreview(previewUnitId);
        }
      } catch (err) {
        setPhotoReviewError(getApiErrorMessage(err));
      } finally {
        setPhotoReviewBusySubmissionId(null);
      }
    },
    [
      handleOpenUnitPreview,
      loadDetails,
      loadPhotoQueue,
      loadPhotoTaskHistory,
      photoRejectReasonBySubmission,
      photoReviewBusySubmissionId,
      photoReviewTaskId,
      previewUnitId,
      studentId,
    ],
  );

  const handleOpenPhotoAsset = useCallback(
    async (taskId: string, assetKey: string) => {
      try {
        const url = await getPhotoPreviewUrl(taskId, assetKey);
        window.open(url, "_blank", "noopener,noreferrer");
      } catch (err) {
        setPhotoReviewError(getApiErrorMessage(err));
      }
    },
    [getPhotoPreviewUrl],
  );

  useEffect(() => {
    let cancelled = false;

    const loadPreviewUrls = async () => {
      if (!photoReviewTaskId || photoReviewItems.length === 0) return;

      const keys = Array.from(new Set(photoReviewItems.flatMap((submission) => submission.assetKeys)));
      const missingKeys = keys.filter((assetKey) => !photoPreviewUrlByAssetKey[assetKey]);
      if (!missingKeys.length) return;

      await Promise.all(
        missingKeys.map(async (assetKey) => {
          try {
            const response = await teacherApi.presignStudentTaskPhotoView(
              studentId,
              photoReviewTaskId,
              assetKey,
              300,
            );
            if (cancelled) return;
            setPhotoPreviewUrlByAssetKey((previous) => ({ ...previous, [assetKey]: response.url }));
          } catch {
            /* fallback остаётся кнопкой "Открыть файл" */
          }
        }),
      );
    };

    void loadPreviewUrls();

    return () => {
      cancelled = true;
    };
  }, [photoPreviewUrlByAssetKey, photoReviewItems, photoReviewTaskId, studentId]);

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
                  setPhotoReviewTaskId(null);
                  setPhotoReviewItems([]);
                  setPhotoReviewError(null);
                  setPhotoReviewNotice(null);
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

          <section className={styles.photoQueueBlock} aria-label="Фото-задачи на проверке">
            <header className={styles.photoQueueHeader}>
              <div>
                <h3 className={styles.photoQueueTitle}>Фото-задачи на проверке</h3>
                <p className={styles.photoQueueHint}>
                  Решение учителя влияет на прогресс юнита и разблокировку downstream по графу.
                </p>
              </div>
              <div className={styles.photoQueueCounter}>В очереди: {photoQueueTotal}</div>
            </header>

            {photoQueueError ? (
              <div className={styles.error} role="status" aria-live="polite">
                {photoQueueError}
              </div>
            ) : null}

            {photoQueueLoading ? <div className={styles.loading}>Загрузка очереди…</div> : null}

            {!photoQueueLoading && !photoQueueItems.length ? (
              <div className={styles.empty}>Новых фото-задач на проверке нет.</div>
            ) : null}

            {photoQueueItems.length > 0 ? (
              <div className={styles.photoQueueList}>
                {photoQueueItems.map((item) => (
                  <article key={item.submissionId} className={styles.photoQueueItem}>
                    <div className={styles.photoQueueItemMain}>
                      <div className={styles.photoQueueItemTitle}>{item.taskTitle ?? "Задача без названия"}</div>
                      <div className={styles.photoQueueItemMeta}>
                        <span>{item.unitTitle}</span>
                        <span>Отправлено: {formatDateTime(item.submittedAt)}</span>
                        <span>Файлов: {item.assetKeysCount}</span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => void handleOpenPhotoReview(item.taskId, item.unitId)}
                    >
                      Проверить
                    </Button>
                  </article>
                ))}
              </div>
            ) : null}
          </section>

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
                        className={`${styles.unitButton} ${selectedUnitId === unit.id ? styles.unitButtonActive : ""}`}
                        onClick={() => handleSelectUnit(unit.id)}
                      >
                        <span className={styles.unitTitle}>{unit.title}</span>
                        <span className={styles.unitMeta}>
                          Зачтено {summary.creditedCount}/{unit.tasks.length}
                        </span>
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
                      <TeacherStudentUnitPreviewPanel
                        unit={previewData}
                        onOpenPhotoReview={(taskId, unitId) => void handleOpenPhotoReview(taskId, unitId)}
                      />
                    ) : null}
                  </section>

                  <section className={styles.photoReviewBlock}>
                    <header className={styles.photoReviewHeader}>
                      <div>
                        <div className={styles.photoReviewTitle}>Ревью фото-задачи</div>
                        <div className={styles.photoReviewSubTitle}>
                          {selectedReviewTaskTitle ?? "Выберите задачу из очереди или списка юнита."}
                        </div>
                      </div>
                      {photoReviewTaskId ? (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setPhotoReviewTaskId(null);
                            setPhotoReviewItems([]);
                            setPhotoReviewError(null);
                            setPhotoReviewNotice(null);
                          }}
                        >
                          Скрыть
                        </Button>
                      ) : null}
                    </header>

                    {photoReviewNotice ? <div className={styles.photoReviewNotice}>{photoReviewNotice}</div> : null}
                    {photoReviewError ? <div className={styles.error}>{photoReviewError}</div> : null}

                    {!photoReviewTaskId ? (
                      <div className={styles.photoReviewHint}>Откройте фото-задачу для просмотра сабмитов.</div>
                    ) : photoReviewLoading ? (
                      <div className={styles.loading}>Загрузка сабмитов…</div>
                    ) : photoReviewItems.length === 0 ? (
                      <div className={styles.empty}>Сабмиты не найдены.</div>
                    ) : (
                      <div className={styles.photoReviewList}>
                        {photoReviewItems.map((submission) => (
                          <article key={submission.id} className={styles.photoReviewItem}>
                            <div className={styles.photoReviewMetaRow}>
                              <span
                                className={`${styles.photoReviewStatusChip} ${styles[reviewStatusClassName[submission.status]]}`}
                              >
                                {reviewStatusLabel[submission.status]}
                              </span>
                              <span>Отправлено: {formatDateTime(submission.submittedAt)}</span>
                              {submission.reviewedAt ? <span>Проверено: {formatDateTime(submission.reviewedAt)}</span> : null}
                            </div>

                            {submission.rejectedReason ? (
                              <div className={styles.photoReviewRejectReason}>Причина: {submission.rejectedReason}</div>
                            ) : null}

                            <div className={styles.photoReviewAssets}>
                              {submission.assetKeys.map((assetKey) => {
                                const previewUrl = photoPreviewUrlByAssetKey[assetKey];
                                return (
                                  <article key={assetKey} className={styles.photoReviewAssetCard}>
                                    {previewUrl ? (
                                      <img
                                        className={styles.photoReviewAssetImage}
                                        src={previewUrl}
                                        alt="Фото-ответ ученика"
                                        loading="lazy"
                                      />
                                    ) : (
                                      <div className={styles.photoReviewAssetPlaceholder}>Превью</div>
                                    )}
                                    <div className={styles.photoReviewAssetActions}>
                                      {previewUrl ? (
                                        <a
                                          className={styles.photoReviewAssetLink}
                                          href={previewUrl}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          Открыть
                                        </a>
                                      ) : (
                                        <button
                                          type="button"
                                          className={styles.photoReviewAssetButton}
                                          onClick={() =>
                                            void handleOpenPhotoAsset(photoReviewTaskId, assetKey)
                                          }
                                        >
                                          Открыть файл
                                        </button>
                                      )}
                                    </div>
                                  </article>
                                );
                              })}
                            </div>

                            {submission.status === "submitted" ? (
                              <div className={styles.photoReviewActions}>
                                <textarea
                                  className={styles.photoRejectInput}
                                  value={photoRejectReasonBySubmission[submission.id] ?? ""}
                                  onChange={(event) =>
                                    setPhotoRejectReasonBySubmission((previous) => ({
                                      ...previous,
                                      [submission.id]: event.target.value,
                                    }))
                                  }
                                  placeholder="Причина отклонения (необязательно)"
                                  rows={2}
                                />
                                <div className={styles.photoReviewButtons}>
                                  <Button
                                    onClick={() => void handleAcceptSubmission(submission.id)}
                                    disabled={photoReviewBusySubmissionId === submission.id}
                                  >
                                    Принять
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    onClick={() => void handleRejectSubmission(submission.id)}
                                    disabled={photoReviewBusySubmissionId === submission.id}
                                  >
                                    Отклонить
                                  </Button>
                                </div>
                              </div>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    )}
                  </section>

                  <div className={styles.tasksList}>
                    {selectedUnit.tasks.length === 0 ? (
                      <div className={styles.empty}>В этом юните нет опубликованных задач.</div>
                    ) : (
                      selectedUnit.tasks.map((task, index) => {
                        const isExpanded = expandedTaskIds.has(task.id);
                        const hasPendingPhoto = task.answerType === "photo" && queuedPhotoTaskIds.has(task.id);

                        return (
                          <article key={task.id} className={styles.taskItem}>
                            <div className={styles.taskHead}>
                              <div className={styles.taskMain}>
                                <div className={styles.taskTitleRow}>
                                  <span className={styles.taskIndex}>{index + 1}</span>
                                  {task.title ? <div className={styles.taskTitle}>{task.title}</div> : null}
                                  <span className={styles.answerTypeBadge}>{answerTypeLabel[task.answerType]}</span>
                                  {task.isRequired ? <span className={styles.requiredFlag}>Обязательная</span> : null}
                                  {hasPendingPhoto ? <span className={styles.photoPendingFlag}>На проверке</span> : null}
                                </div>

                                <div className={styles.taskMetaLine}>
                                  <span className={`${styles.statusBadge} ${styles[statusClassName[task.state.status]]}`}>
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
                                {task.answerType === "photo" ? (
                                  <Button
                                    variant="ghost"
                                    onClick={() => void handleOpenPhotoReview(task.id, selectedUnit.id)}
                                  >
                                    Проверить
                                  </Button>
                                ) : null}
                                {task.state.canTeacherCredit ? (
                                  <Button
                                    variant="ghost"
                                    onClick={() => void handleCreditTask(task)}
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
