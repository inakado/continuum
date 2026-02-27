"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { studentApi, type TaskState, type UnitWithTasks } from "@/lib/api/student";
import { ApiError } from "@/lib/api/client";
import { learningPhotoQueryKeys } from "@/lib/query/keys";
import { getStudentErrorMessage } from "../shared/student-errors";
import StudentNotFound from "../shared/StudentNotFound";
import styles from "./student-unit-detail.module.css";
import DashboardShell from "@/components/DashboardShell";
import Tabs from "@/components/ui/Tabs";
import { toYouTubeEmbed } from "@/lib/video-embed";
import Button from "@/components/ui/Button";
import { useStudentLogout } from "../auth/use-student-logout";
import { useStudentIdentity } from "../shared/use-student-identity";
import { useStudentUnitPdfPreview } from "./hooks/use-student-unit-pdf-preview";
import { useStudentTaskNavigation } from "./hooks/use-student-task-navigation";
import { useStudentTaskAttempt } from "./hooks/use-student-task-attempt";
import { useStudentPhotoSubmit } from "./hooks/use-student-photo-submit";
import { useStudentTaskMediaPreview } from "./hooks/use-student-task-media-preview";
import { StudentUnitPdfPanel } from "./components/StudentUnitPdfPanel";
import { StudentTaskTabs } from "./components/StudentTaskTabs";
import { StudentTaskCardShell } from "./components/StudentTaskCardShell";
import { StudentTaskAnswerForm } from "./components/StudentTaskAnswerForm";
import { StudentTaskMediaPreview } from "./components/StudentTaskMediaPreview";

type Props = {
  unitId: string;
};

type TabKey = "theory" | "method" | "tasks" | "video" | "attachments";

const CREDITED_TASK_STATUSES = new Set<TaskState["status"]>([
  "correct",
  "accepted",
  "credited_without_progress",
  "teacher_credited",
]);

const SOLVED_TASK_STATUSES = new Set<TaskState["status"]>(["correct", "accepted", "teacher_credited"]);

const formatRemainingDuration = (remainingMs: number) => {
  const totalSeconds = Math.ceil(Math.max(0, remainingMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}с`;
  if (seconds === 0) return `${minutes}м`;
  return `${minutes}м ${seconds}с`;
};

function BlockedCountdown({ blockedUntilIso }: { blockedUntilIso: string }) {
  const blockedUntilMs = useMemo(() => new Date(blockedUntilIso).getTime(), [blockedUntilIso]);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!Number.isFinite(blockedUntilMs)) return;
    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [blockedUntilMs]);

  const remainingMs = blockedUntilMs - nowMs;
  if (remainingMs <= 0) return null;
  return <span className={styles.blockedInline}>Блокировка: {formatRemainingDuration(remainingMs)}</span>;
}

export default function StudentUnitDetailScreen({ unitId }: Props) {
  const tabsId = useId();
  const router = useRouter();
  const handleLogout = useStudentLogout();
  const identity = useStudentIdentity();

  const unitQuery = useQuery<UnitWithTasks>({
    queryKey: learningPhotoQueryKeys.studentUnit(unitId),
    queryFn: () => studentApi.getUnit(unitId),
    retry: (failureCount, error) => {
      if (error instanceof ApiError) {
        if (error.status === 409 && error.code === "UNIT_LOCKED") return false;
        if (error.status === 404) return false;
      }
      return failureCount < 2;
    },
  });

  const unit = unitQuery.data ?? null;
  const unitError = unitQuery.error;
  const isLockedAccess =
    unitQuery.isError && unitError instanceof ApiError && unitError.status === 409 && unitError.code === "UNIT_LOCKED";
  const lockedAccessMessage = isLockedAccess ? "Юнит пока заблокирован" : null;
  const error = unitQuery.isError && !isLockedAccess ? getStudentErrorMessage(unitError) : null;
  const notFound = error === "Не найдено или недоступно";

  const [activeTab, setActiveTab] = useState<TabKey>("tasks");

  const unitPdfPreview = useStudentUnitPdfPreview({ unit, unitId });

  const navItems = useMemo(
    () => [
      {
        label: "Курсы",
        href: "/student?view=courses",
        active: true,
      },
    ],
    [],
  );

  const videos = useMemo(
    () => (unit?.videosJson ?? []).filter((v) => v.embedUrl.trim().length > 0),
    [unit?.videosJson],
  );
  const hasMethod = Boolean(unit?.methodPdfAssetKey || unit?.methodRichLatex);
  const hasAttachments = Boolean(unit?.attachmentsJson && unit.attachmentsJson.length > 0);

  const tabs = useMemo(() => {
    const nextTabs: { key: TabKey; label: string }[] = [
      { key: "theory", label: "Теория" },
      ...(hasMethod ? ([{ key: "method", label: "Методика" }] as const) : []),
      { key: "tasks", label: "Задачи" },
      ...(videos.length ? ([{ key: "video", label: "Видео" }] as const) : []),
      ...(hasAttachments ? ([{ key: "attachments", label: "Вложения" }] as const) : []),
    ];
    return nextTabs;
  }, [hasMethod, hasAttachments, videos.length]);

  useEffect(() => {
    if (!tabs.find((tab) => tab.key === activeTab)) {
      setActiveTab(tabs[0]?.key ?? "tasks");
    }
  }, [activeTab, tabs]);

  const activePanelId = `${tabsId}-${activeTab}-panel`;
  const activeTabId = `${tabsId}-${activeTab}`;

  const orderedTasks = useMemo(() => {
    if (!unit?.tasks) return [];
    return [...unit.tasks].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [unit?.tasks]);

  const completionPercent = unit?.completionPercent ?? 0;
  const solvedPercent = unit?.solvedPercent ?? 0;
  const { totalTasks, countedTasks, solvedTasks, requiredTotal, requiredDone } = useMemo(() => {
    let countedFallback = 0;
    let solvedFallback = 0;
    let requiredTotalFallback = 0;
    let requiredDoneFallback = 0;

    for (const task of orderedTasks) {
      const status = task.state?.status ?? "not_started";
      const isCredited = CREDITED_TASK_STATUSES.has(status);
      if (isCredited) countedFallback += 1;
      if (SOLVED_TASK_STATUSES.has(status)) solvedFallback += 1;
      if (!task.isRequired) continue;
      requiredTotalFallback += 1;
      if (isCredited) requiredDoneFallback += 1;
    }

    return {
      totalTasks: unit?.totalTasks ?? orderedTasks.length,
      countedTasks: unit?.countedTasks ?? countedFallback,
      solvedTasks: unit?.solvedTasks ?? solvedFallback,
      requiredTotal: requiredTotalFallback,
      requiredDone: requiredDoneFallback,
    };
  }, [orderedTasks, unit?.countedTasks, unit?.solvedTasks, unit?.totalTasks]);

  const normalizePercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
  const completionMeter = normalizePercent(completionPercent);
  const solvedMeter = normalizePercent(solvedPercent);
  const requiredMeter = requiredTotal > 0 ? normalizePercent((requiredDone / requiredTotal) * 100) : 100;
  const getProgressFillStyle = (percent: number) => {
    const level = normalizePercent(percent);
    const startColor =
      level >= 80
        ? "color-mix(in srgb, #22c55e 82%, var(--border-primary))"
        : level >= 55
          ? "color-mix(in srgb, #22c55e 68%, var(--border-primary))"
          : level >= 30
            ? "color-mix(in srgb, #22c55e 56%, var(--border-primary))"
            : "color-mix(in srgb, #22c55e 44%, var(--surface-2))";

    const endColor =
      level >= 80
        ? "color-mix(in srgb, #22c55e 92%, var(--border-primary))"
        : level >= 55
          ? "color-mix(in srgb, #22c55e 80%, var(--border-primary))"
          : level >= 30
            ? "color-mix(in srgb, #22c55e 68%, var(--border-primary))"
            : "color-mix(in srgb, #22c55e 56%, var(--border-primary))";

    return {
      width: `${level}%`,
      background: `linear-gradient(90deg, ${startColor}, ${endColor})`,
    };
  };

  const { activeTaskIndex, activeTask, setActiveTaskId } = useStudentTaskNavigation(orderedTasks);
  const activeState = activeTask?.state ?? null;

  const attempt = useStudentTaskAttempt({ activeTask, unitId });
  const photo = useStudentPhotoSubmit({ activeTask, activeState, unitId });
  const media = useStudentTaskMediaPreview({ activeTask });

  const isPhotoTask = activeTask?.answerType === "photo";
  const hasTaskSolutionPdf = Boolean(activeTask?.solutionPdfAssetKey);
  const showSolutionPanel =
    !isPhotoTask && attempt.isTaskCredited && hasTaskSolutionPdf && media.isSolutionVisible;

  return (
    <DashboardShell
      title={identity.displayName || "Профиль"}
      navItems={navItems}
      appearance="glass"
      onLogout={handleLogout}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h1 className={styles.title}>{unit?.title ?? "Юнит"}</h1>
          </div>
        </div>

        {notFound ? <StudentNotFound /> : null}
        {error && !notFound ? (
          <div className={styles.error} role="status" aria-live="polite">
            {error}
          </div>
        ) : null}

        {lockedAccessMessage ? (
          <section className={styles.lockedGate} role="status" aria-live="polite">
            <div className={styles.lockedGateTitle}>Юнит заблокирован</div>
            <div className={styles.lockedGateText}>
              {lockedAccessMessage}. Сначала завершите предыдущие юниты в графе раздела.
            </div>
            <div className={styles.lockedGateActions}>
              <Button onClick={() => router.push("/student")}>К графу раздела</Button>
              <Button variant="ghost" onClick={() => router.back()}>
                ← Назад
              </Button>
            </div>
          </section>
        ) : (
          <>
            {unit && activeTab !== "theory" && activeTab !== "method" ? (
              <section className={styles.progressCard} aria-label="Прогресс юнита">
                <div className={styles.progressGrid}>
                  <article className={styles.progressStat}>
                    <div className={styles.progressStatHead}>
                      <span className={styles.progressStatLabel}>Выполнение</span>
                      <span className={styles.progressStatValue}>{completionMeter}%</span>
                    </div>
                    <div className={styles.progressLine}>
                      <span className={styles.progressLineFill} style={getProgressFillStyle(completionMeter)} />
                    </div>
                  </article>

                  <article className={styles.progressStat}>
                    <div className={styles.progressStatHead}>
                      <span className={styles.progressStatLabel}>Решено</span>
                      <span className={styles.progressStatValue}>{solvedMeter}%</span>
                    </div>
                    <div className={styles.progressLine}>
                      <span className={styles.progressLineFill} style={getProgressFillStyle(solvedMeter)} />
                    </div>
                  </article>

                  <article className={styles.progressStat}>
                    <div className={styles.progressStatHead}>
                      <span className={styles.progressStatLabel}>Обязательные</span>
                      <span className={styles.progressStatValue}>
                        {requiredDone}/{requiredTotal}
                      </span>
                    </div>
                    <div className={styles.progressLine}>
                      <span className={styles.progressLineFill} style={getProgressFillStyle(requiredMeter)} />
                    </div>
                  </article>
                </div>

                <div className={styles.progressDivider} />

                <div className={styles.progressMeta}>
                  <div className={styles.progressMetaItem}>
                    Учтено: <strong>{countedTasks}/{totalTasks}</strong>
                  </div>
                  <div className={styles.progressMetaItem}>
                    Решено задач: <strong>{solvedTasks}/{totalTasks}</strong>
                  </div>
                </div>
              </section>
            ) : null}

            <div className={styles.tabsRow}>
              <Tabs
                idBase={tabsId}
                tabs={tabs}
                active={activeTab}
                onChange={setActiveTab}
                ariaLabel="Вкладки юнита"
                className={styles.unitTabs}
              />
              <Button variant="ghost" onClick={() => router.back()} className={styles.backInline}>
                ← Назад
              </Button>
            </div>

            <div id={activePanelId} role="tabpanel" aria-labelledby={activeTabId}>
              {activeTab === "theory" ? (
                <StudentUnitPdfPanel
                  previewError={unitPdfPreview.theoryPreviewError}
                  previewUrl={unitPdfPreview.theoryPreviewUrl}
                  previewLoading={unitPdfPreview.theoryPreviewLoading}
                  unavailableText="PDF теории пока не опубликован учителем."
                  refreshKey={unit?.theoryPdfAssetKey ?? undefined}
                  getFreshUrl={unitPdfPreview.refreshTheoryPreviewUrl}
                  zoom={unitPdfPreview.pdfZoomByTarget.theory}
                  onZoomChange={(zoom) => unitPdfPreview.setPdfZoom("theory", zoom)}
                />
              ) : activeTab === "method" ? (
                <StudentUnitPdfPanel
                  previewError={unitPdfPreview.methodPreviewError}
                  previewUrl={unitPdfPreview.methodPreviewUrl}
                  previewLoading={unitPdfPreview.methodPreviewLoading}
                  unavailableText="PDF методики пока не опубликован учителем."
                  refreshKey={unit?.methodPdfAssetKey ?? undefined}
                  getFreshUrl={unitPdfPreview.refreshMethodPreviewUrl}
                  zoom={unitPdfPreview.pdfZoomByTarget.method}
                  onZoomChange={(zoom) => unitPdfPreview.setPdfZoom("method", zoom)}
                />
              ) : activeTab === "video" ? (
                <div className={styles.videoList}>
                  {videos.length === 0 ? (
                    <div className={styles.stub}>Видео пока не добавлены.</div>
                  ) : (
                    videos.map((video) => {
                      const embed = toYouTubeEmbed(video.embedUrl);
                      return (
                        <div key={video.id} className={styles.videoCard}>
                          <div className={styles.videoTitle}>{video.title}</div>
                          {embed ? (
                            <iframe
                              className={styles.videoFrame}
                              src={embed}
                              title={video.title}
                              loading="lazy"
                              referrerPolicy="strict-origin-when-cross-origin"
                              sandbox="allow-scripts allow-same-origin allow-presentation"
                              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                            />
                          ) : (
                            <div className={styles.stub}>Неподдерживаемая ссылка на видео.</div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              ) : activeTab === "attachments" ? (
                <div className={styles.stub}>Вложения будут добавлены позже.</div>
              ) : (
                <div className={styles.tasks}>
                  {orderedTasks.length ? (
                    <>
                      <StudentTaskTabs
                        tasks={orderedTasks}
                        activeTaskIndex={activeTaskIndex}
                        onSelectTask={setActiveTaskId}
                      />

                      {activeTask ? (
                        <StudentTaskCardShell task={activeTask} taskIndex={activeTaskIndex}>
                          <StudentTaskMediaPreview
                            hasStatementImage={Boolean(activeTask.hasStatementImage)}
                            statementImageLoading={media.activeTaskStatementImageLoading}
                            statementImageError={media.activeTaskStatementImageError}
                            statementImageUrl={media.activeTaskStatementImageUrl}
                            onStatementImageLoadError={media.handleStatementImageLoadError}
                            showSolutionPanel={showSolutionPanel}
                            solutionLoading={media.activeTaskSolutionLoading}
                            solutionError={media.activeTaskSolutionError}
                            solutionErrorCode={media.activeTaskSolutionErrorCode}
                            solutionUrl={media.activeTaskSolutionPdfUrl}
                            solutionRefreshKey={activeTask.solutionPdfAssetKey ?? undefined}
                            getFreshSolutionUrl={media.refreshTaskSolutionPreviewUrl}
                            onGoToStudentGraph={() => router.push("/student")}
                          />

                          {activeState?.requiredSkipped ? (
                            <div className={styles.taskMeta}>
                              <span className={styles.requiredBadge}>Обязательная пропущена</span>
                            </div>
                          ) : null}

                          {activeState?.status === "credited_without_progress" ? (
                            <div className={styles.notice}>Задача зачтена без прогресса.</div>
                          ) : null}

                          {activeState?.status === "teacher_credited" ? (
                            <div className={styles.notice}>Задача зачтена учителем.</div>
                          ) : null}

                          <StudentTaskAnswerForm
                            task={activeTask}
                            isTaskCredited={attempt.isTaskCredited}
                            numericValues={attempt.activeNumericAnswers}
                            attemptPerPartByKey={attempt.attemptPerPartByKey}
                            choiceItems={attempt.activeTaskChoices}
                            singleAnswer={attempt.activeSingleAnswer}
                            multiAnswers={attempt.activeMultiAnswers}
                            onNumericChange={attempt.updateNumericValue}
                            onSingleChoiceChange={attempt.updateSingleValue}
                            onMultiChoiceToggle={attempt.toggleMultiValue}
                          />

                          {isPhotoTask ? (
                            <div className={styles.photoActions}>
                              {photo.canUploadPhoto ? (
                                <Button
                                  variant="ghost"
                                  onClick={() => photo.openPhotoFileDialog(activeTask.id)}
                                  disabled={photo.isPhotoLoading}
                                >
                                  Загрузить фото
                                </Button>
                              ) : null}
                              {photo.canUploadPhoto ? (
                                <Button
                                  onClick={() => photo.submitPhotoTask(activeTask.id)}
                                  disabled={photo.isPhotoLoading || photo.photoSelectedFiles.length === 0}
                                >
                                  {photo.isPhotoLoading ? "Отправка..." : "Отправить"}
                                </Button>
                              ) : null}
                            </div>
                          ) : null}

                          <div className={styles.taskActions}>
                            {!isPhotoTask && !attempt.isTaskCredited ? (
                              <Button onClick={attempt.handleSubmitAttempt} disabled={attempt.isAttemptDisabled || !attempt.isAnswerReady}>
                                Проверить
                              </Button>
                            ) : null}

                            {!isPhotoTask && !attempt.isTaskCredited && attempt.showIncorrectBadge ? (
                              <span className={styles.taskResultIncorrect}>Неверно</span>
                            ) : null}

                            {!isPhotoTask && attempt.isBlocked && attempt.blockedUntilIso ? (
                              <BlockedCountdown blockedUntilIso={attempt.blockedUntilIso} />
                            ) : null}

                            {!isPhotoTask && attempt.isTaskCredited && activeTaskIndex < orderedTasks.length - 1 ? (
                              <Button
                                variant="ghost"
                                onClick={() => setActiveTaskId(orderedTasks[activeTaskIndex + 1]?.id ?? null)}
                              >
                                Следующая
                              </Button>
                            ) : null}

                            {!isPhotoTask && attempt.isTaskCredited && hasTaskSolutionPdf ? (
                              <Button variant="ghost" onClick={media.toggleSolutionVisibility}>
                                {media.isSolutionVisible ? "Скрыть решение" : "Показать решение"}
                              </Button>
                            ) : null}

                            {!isPhotoTask && attempt.showCorrectBadge ? (
                              <span className={styles.taskResultCorrect}>Верно</span>
                            ) : null}

                            {!isPhotoTask ? (
                              <div className={styles.attemptsLeftBadge}>Осталось попыток: {attempt.attemptsLeft}</div>
                            ) : null}
                          </div>
                        </StudentTaskCardShell>
                      ) : null}
                    </>
                  ) : (
                    <div className={styles.stub}>Задач пока нет.</div>
                  )}
                </div>
              )}
            </div>

            <input
              ref={photo.photoFileInputRef}
              className={styles.photoFileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              tabIndex={-1}
              aria-hidden="true"
              onChange={photo.handlePhotoFileSelection}
            />
          </>
        )}
      </div>
    </DashboardShell>
  );
}
