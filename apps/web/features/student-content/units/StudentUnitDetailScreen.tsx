"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { studentApi, type Task, type TaskState, type UnitVideo, type UnitWithTasks } from "@/lib/api/student";
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
import { useStudentUnitRenderedContent } from "./hooks/use-student-unit-rendered-content";
import { useStudentTaskNavigation } from "./hooks/use-student-task-navigation";
import { useStudentTaskAttempt } from "./hooks/use-student-task-attempt";
import { useStudentPhotoSubmit } from "./hooks/use-student-photo-submit";
import { useStudentTaskMediaPreview } from "./hooks/use-student-task-media-preview";
import { StudentUnitHtmlPanel } from "./components/StudentUnitHtmlPanel";
import { StudentUnitPdfPanel } from "./components/StudentUnitPdfPanel";
import { StudentTaskTabs } from "./components/StudentTaskTabs";
import { StudentTaskCardShell } from "./components/StudentTaskCardShell";
import { StudentTaskAnswerForm } from "./components/StudentTaskAnswerForm";
import { StudentTaskMediaPreview } from "./components/StudentTaskMediaPreview";

type Props = {
  unitId: string;
};

type TabKey = "theory" | "method" | "tasks" | "video" | "attachments";
type UnitTabs = Array<{ key: TabKey; label: string }>;
type AttemptStateModel = ReturnType<typeof useStudentTaskAttempt>;
type PhotoStateModel = ReturnType<typeof useStudentPhotoSubmit>;
type MediaStateModel = ReturnType<typeof useStudentTaskMediaPreview>;
type UnitRenderedContentStateModel = ReturnType<typeof useStudentUnitRenderedContent>;
type StudentTaskNavigationModel = ReturnType<typeof useStudentTaskNavigation>;

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

const normalizePercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

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

const getStudentUnitRetry = (failureCount: number, error: Error) => {
  if (error instanceof ApiError) {
    if (error.status === 409 && error.code === "UNIT_LOCKED") return false;
    if (error.status === 404) return false;
  }
  return failureCount < 2;
};

const getOrderedTasks = (unit: UnitWithTasks | null) => {
  if (!unit?.tasks) return [];
  return [...unit.tasks].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
};

const getProgressMetrics = (unit: UnitWithTasks | null, orderedTasks: Task[]) => {
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
};

const getUnitTabs = ({
  hasMethod,
  hasAttachments,
  videoCount,
}: {
  hasMethod: boolean;
  hasAttachments: boolean;
  videoCount: number;
}): UnitTabs => [
  { key: "theory", label: "Теория" },
  ...(hasMethod ? ([{ key: "method", label: "Методика" }] as const) : []),
  { key: "tasks", label: "Задачи" },
  ...(videoCount ? ([{ key: "video", label: "Видео" }] as const) : []),
  ...(hasAttachments ? ([{ key: "attachments", label: "Вложения" }] as const) : []),
];

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

function StudentUnitLockedGate({
  onGoToGraph,
  onBack,
}: {
  onGoToGraph: () => void;
  onBack: () => void;
}) {
  return (
    <section className={styles.lockedGate} role="status" aria-live="polite">
      <div className={styles.lockedGateTitle}>Юнит заблокирован</div>
      <div className={styles.lockedGateText}>
        Юнит пока заблокирован. Сначала завершите предыдущие юниты в графе раздела.
      </div>
      <div className={styles.lockedGateActions}>
        <Button onClick={onGoToGraph}>К графу раздела</Button>
        <Button variant="ghost" onClick={onBack}>
          ← Назад
        </Button>
      </div>
    </section>
  );
}

function StudentUnitProgressCard({
  completionMeter,
  solvedMeter,
  requiredDone,
  requiredTotal,
  requiredMeter,
  countedTasks,
  solvedTasks,
  totalTasks,
}: {
  completionMeter: number;
  solvedMeter: number;
  requiredDone: number;
  requiredTotal: number;
  requiredMeter: number;
  countedTasks: number;
  solvedTasks: number;
  totalTasks: number;
}) {
  return (
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
            <span className={styles.progressStatLabel}>Ключевые</span>
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
  );
}

function StudentUnitVideoPanel({ videos }: { videos: UnitVideo[] }) {
  if (videos.length === 0) {
    return <div className={styles.stub}>Видео пока не добавлены.</div>;
  }

  return (
    <div className={styles.videoList}>
      {videos.map((video) => {
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
      })}
    </div>
  );
}

function StudentTaskStatusNotices({ activeState }: { activeState: TaskState | null }) {
  return (
    <>
      {activeState?.requiredSkipped ? (
        <div className={styles.taskMeta}>
          <span className={styles.requiredBadge}>Ключевая пропущена</span>
        </div>
      ) : null}

      {activeState?.status === "credited_without_progress" ? (
        <div className={styles.notice}>Задача зачтена без прогресса.</div>
      ) : null}

      {activeState?.status === "teacher_credited" ? (
        <div className={styles.notice}>Задача зачтена учителем.</div>
      ) : null}
    </>
  );
}

function StudentPhotoActions({
  taskId,
  photo,
}: {
  taskId: string;
  photo: PhotoStateModel;
}) {
  if (!photo.canUploadPhoto) {
    return null;
  }

  return (
    <div className={styles.photoActions}>
      <Button variant="ghost" onClick={() => photo.openPhotoFileDialog(taskId)} disabled={photo.isPhotoLoading}>
        Загрузить фото
      </Button>
      <Button onClick={() => photo.submitPhotoTask(taskId)} disabled={photo.isPhotoLoading || photo.photoSelectedFiles.length === 0}>
        {photo.isPhotoLoading ? "Отправка..." : "Отправить"}
      </Button>
    </div>
  );
}

function StudentTaskAttemptControls({
  isPhotoTask,
  attempt,
}: {
  isPhotoTask: boolean;
  attempt: AttemptStateModel;
}) {
  if (isPhotoTask) {
    return null;
  }

  return (
    <>
      {!attempt.isTaskCredited ? (
        <Button onClick={attempt.handleSubmitAttempt} disabled={attempt.isAttemptDisabled || !attempt.isAnswerReady}>
          Проверить
        </Button>
      ) : null}

      {!attempt.isTaskCredited && attempt.showIncorrectBadge ? (
        <span className={styles.taskResultIncorrect}>Неверно</span>
      ) : null}

      {attempt.isBlocked && attempt.blockedUntilIso ? (
        <BlockedCountdown blockedUntilIso={attempt.blockedUntilIso} />
      ) : null}
    </>
  );
}

function StudentTaskProgressControls({
  nextTaskId,
  isPhotoTask,
  hasTaskSolutionPdf,
  attempt,
  media,
  onSelectTask,
}: {
  nextTaskId: string | null;
  isPhotoTask: boolean;
  hasTaskSolutionPdf: boolean;
  attempt: AttemptStateModel;
  media: MediaStateModel;
  onSelectTask: (taskId: string | null) => void;
}) {
  if (isPhotoTask) {
    return null;
  }

  return (
    <>
      {attempt.isTaskCredited && nextTaskId ? (
        <Button variant="ghost" onClick={() => onSelectTask(nextTaskId)}>
          Следующая
        </Button>
      ) : null}

      {attempt.isTaskCredited && hasTaskSolutionPdf ? (
        <Button variant="ghost" onClick={media.toggleSolutionVisibility}>
          {media.isSolutionVisible ? "Скрыть решение" : "Показать решение"}
        </Button>
      ) : null}

      {attempt.showCorrectBadge ? (
        <span className={styles.taskResultCorrect}>Верно</span>
      ) : null}

      <div className={styles.attemptsLeftBadge}>Осталось попыток: {attempt.attemptsLeft}</div>
    </>
  );
}

function StudentTaskActions({
  nextTaskId,
  isPhotoTask,
  hasTaskSolutionPdf,
  attempt,
  media,
  onSelectTask,
}: {
  nextTaskId: string | null;
  isPhotoTask: boolean;
  hasTaskSolutionPdf: boolean;
  attempt: AttemptStateModel;
  media: MediaStateModel;
  onSelectTask: (taskId: string | null) => void;
}) {
  return (
    <div className={styles.taskActions}>
      <StudentTaskAttemptControls isPhotoTask={isPhotoTask} attempt={attempt} />
      <StudentTaskProgressControls
        nextTaskId={nextTaskId}
        isPhotoTask={isPhotoTask}
        hasTaskSolutionPdf={hasTaskSolutionPdf}
        attempt={attempt}
        media={media}
        onSelectTask={onSelectTask}
      />
    </div>
  );
}

function StudentUnitTasksPanel({
  orderedTasks,
  taskNavigation,
  activeState,
  attempt,
  photo,
  media,
  onGoToStudentGraph,
}: {
  orderedTasks: Task[];
  taskNavigation: StudentTaskNavigationModel;
  activeState: TaskState | null;
  attempt: AttemptStateModel;
  photo: PhotoStateModel;
  media: MediaStateModel;
  onGoToStudentGraph: () => void;
}) {
  if (!orderedTasks.length) {
    return <div className={styles.stub}>Задач пока нет.</div>;
  }

  if (!taskNavigation.activeTask) {
    return null;
  }

  const activeTask = taskNavigation.activeTask;
  const isPhotoTask = activeTask.answerType === "photo";
  const hasTaskSolutionPdf = Boolean(activeTask.solutionPdfAssetKey);
  const showSolutionPanel =
    !isPhotoTask && attempt.isTaskCredited && hasTaskSolutionPdf && media.isSolutionVisible;
  const nextTaskId = orderedTasks[taskNavigation.activeTaskIndex + 1]?.id ?? null;

  return (
    <div className={styles.tasks}>
      <StudentTaskTabs
        tasks={orderedTasks}
        activeTaskIndex={taskNavigation.activeTaskIndex}
        onSelectTask={taskNavigation.setActiveTaskId}
      />

      <StudentTaskCardShell task={activeTask} taskIndex={taskNavigation.activeTaskIndex}>
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
          onGoToStudentGraph={onGoToStudentGraph}
        />

        <StudentTaskStatusNotices activeState={activeState} />

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

        {isPhotoTask ? <StudentPhotoActions taskId={activeTask.id} photo={photo} /> : null}

        <StudentTaskActions
          nextTaskId={nextTaskId}
          isPhotoTask={isPhotoTask}
          hasTaskSolutionPdf={hasTaskSolutionPdf}
          attempt={attempt}
          media={media}
          onSelectTask={taskNavigation.setActiveTaskId}
        />
      </StudentTaskCardShell>
    </div>
  );
}

function StudentUnitTabContent({
  activeTab,
  unit,
  videos,
  unitRenderedContent,
  orderedTasks,
  taskNavigation,
  activeState,
  attempt,
  photo,
  media,
  onGoToStudentGraph,
}: {
  activeTab: TabKey;
  unit: UnitWithTasks | null;
  videos: UnitVideo[];
  unitRenderedContent: UnitRenderedContentStateModel;
  orderedTasks: Task[];
  taskNavigation: StudentTaskNavigationModel;
  activeState: TaskState | null;
  attempt: AttemptStateModel;
  photo: PhotoStateModel;
  media: MediaStateModel;
  onGoToStudentGraph: () => void;
}) {
  if (activeTab === "theory") {
    if (unitRenderedContent.theoryContent?.html) {
      return (
        <StudentUnitHtmlPanel
          content={unitRenderedContent.theoryContent}
          getFreshPdfUrl={async () => (await unitRenderedContent.refreshTheoryContent())?.pdfUrl ?? null}
          previewError={unitRenderedContent.theoryError}
          previewLoading={unitRenderedContent.theoryLoading}
          unavailableText="HTML теории пока не опубликован учителем."
        />
      );
    }

    return (
      <StudentUnitPdfPanel
        previewError={unitRenderedContent.theoryError}
        previewUrl={unitRenderedContent.theoryContent?.pdfUrl ?? null}
        previewLoading={unitRenderedContent.theoryLoading}
        unavailableText="PDF теории пока не опубликован учителем."
        refreshKey={unit?.theoryPdfAssetKey ?? undefined}
        getFreshUrl={async () => (await unitRenderedContent.refreshTheoryContent())?.pdfUrl ?? null}
        zoom={unitRenderedContent.pdfZoomByTarget.theory}
        onZoomChange={(zoom) => unitRenderedContent.setPdfZoom("theory", zoom)}
      />
    );
  }

  if (activeTab === "method") {
    if (unitRenderedContent.methodContent?.html) {
      return (
        <StudentUnitHtmlPanel
          content={unitRenderedContent.methodContent}
          getFreshPdfUrl={async () => (await unitRenderedContent.refreshMethodContent())?.pdfUrl ?? null}
          previewError={unitRenderedContent.methodError}
          previewLoading={unitRenderedContent.methodLoading}
          unavailableText="HTML методики пока не опубликован учителем."
        />
      );
    }

    return (
      <StudentUnitPdfPanel
        previewError={unitRenderedContent.methodError}
        previewUrl={unitRenderedContent.methodContent?.pdfUrl ?? null}
        previewLoading={unitRenderedContent.methodLoading}
        unavailableText="PDF методики пока не опубликован учителем."
        refreshKey={unit?.methodPdfAssetKey ?? undefined}
        getFreshUrl={async () => (await unitRenderedContent.refreshMethodContent())?.pdfUrl ?? null}
        zoom={unitRenderedContent.pdfZoomByTarget.method}
        onZoomChange={(zoom) => unitRenderedContent.setPdfZoom("method", zoom)}
      />
    );
  }

  if (activeTab === "video") {
    return <StudentUnitVideoPanel videos={videos} />;
  }

  if (activeTab === "attachments") {
    return <div className={styles.stub}>Вложения будут добавлены позже.</div>;
  }

  return (
    <StudentUnitTasksPanel
      orderedTasks={orderedTasks}
      taskNavigation={taskNavigation}
      activeState={activeState}
      attempt={attempt}
      photo={photo}
      media={media}
      onGoToStudentGraph={onGoToStudentGraph}
    />
  );
}

const useStudentUnitQueryState = (unitId: string) => {
  const unitQuery = useQuery<UnitWithTasks>({
    queryKey: learningPhotoQueryKeys.studentUnit(unitId),
    queryFn: () => studentApi.getUnit(unitId),
    retry: getStudentUnitRetry,
  });

  const unit = unitQuery.data ?? null;
  const unitError = unitQuery.error;
  const isLockedAccess =
    unitQuery.isError && unitError instanceof ApiError && unitError.status === 409 && unitError.code === "UNIT_LOCKED";
  const error = unitQuery.isError && !isLockedAccess ? getStudentErrorMessage(unitError) : null;
  const notFound = error === "Не найдено или недоступно";

  return {
    unit,
    isLockedAccess,
    error,
    notFound,
  };
};

const useStudentUnitTabsState = (unit: UnitWithTasks | null) => {
  const [activeTab, setActiveTab] = useState<TabKey>("tasks");
  const videos = useMemo(() => (unit?.videosJson ?? []).filter((video) => video.embedUrl.trim().length > 0), [unit?.videosJson]);
  const hasMethod = Boolean(unit?.methodPdfAssetKey || unit?.methodHtmlAssetKey || unit?.methodRichLatex);
  const hasAttachments = Boolean(unit?.attachmentsJson && unit.attachmentsJson.length > 0);
  const tabs = useMemo(
    () =>
      getUnitTabs({
        hasMethod,
        hasAttachments,
        videoCount: videos.length,
      }),
    [hasAttachments, hasMethod, videos.length],
  );

  useEffect(() => {
    if (!tabs.find((tab) => tab.key === activeTab)) {
      setActiveTab(tabs[0]?.key ?? "tasks");
    }
  }, [activeTab, tabs]);

  return {
    activeTab,
    setActiveTab,
    videos,
    tabs,
  };
};

const useStudentUnitTaskState = (orderedTasks: Task[], unitId: string) => {
  const taskNavigation = useStudentTaskNavigation(orderedTasks);
  const activeState = taskNavigation.activeTask?.state ?? null;
  const attempt = useStudentTaskAttempt({ activeTask: taskNavigation.activeTask, unitId });
  const photo = useStudentPhotoSubmit({ activeTask: taskNavigation.activeTask, activeState, unitId });
  const media = useStudentTaskMediaPreview({ activeTask: taskNavigation.activeTask });

  return {
    taskNavigation,
    activeState,
    attempt,
    photo,
    media,
  };
};

const useStudentUnitScreenState = (unitId: string) => {
  const queryState = useStudentUnitQueryState(unitId);
  const tabsState = useStudentUnitTabsState(queryState.unit);
  const unitRenderedContent = useStudentUnitRenderedContent({ unit: queryState.unit, unitId });
  const orderedTasks = useMemo(() => getOrderedTasks(queryState.unit), [queryState.unit]);
  const progressMetrics = useMemo(() => getProgressMetrics(queryState.unit, orderedTasks), [orderedTasks, queryState.unit]);
  const completionMeter = normalizePercent(queryState.unit?.completionPercent ?? 0);
  const solvedMeter = normalizePercent(queryState.unit?.solvedPercent ?? 0);
  const requiredMeter =
    progressMetrics.requiredTotal > 0
      ? normalizePercent((progressMetrics.requiredDone / progressMetrics.requiredTotal) * 100)
      : 100;
  const shouldShowProgressCard = Boolean(queryState.unit) && tabsState.activeTab !== "theory" && tabsState.activeTab !== "method";
  const taskState = useStudentUnitTaskState(orderedTasks, unitId);

  return {
    ...queryState,
    ...tabsState,
    unitRenderedContent,
    orderedTasks,
    progressMetrics,
    completionMeter,
    solvedMeter,
    requiredMeter,
    shouldShowProgressCard,
    ...taskState,
  };
};

function StudentUnitBody({
  tabsId,
  unit,
  state,
  onBack,
  onGoToStudentGraph,
}: {
  tabsId: string;
  unit: UnitWithTasks | null;
  state: ReturnType<typeof useStudentUnitScreenState>;
  onBack: () => void;
  onGoToStudentGraph: () => void;
}) {
  const activePanelId = `${tabsId}-${state.activeTab}-panel`;
  const activeTabId = `${tabsId}-${state.activeTab}`;

  if (state.isLockedAccess) {
    return <StudentUnitLockedGate onGoToGraph={onGoToStudentGraph} onBack={onBack} />;
  }

  return (
    <>
      {state.shouldShowProgressCard ? (
        <StudentUnitProgressCard
          completionMeter={state.completionMeter}
          solvedMeter={state.solvedMeter}
          requiredDone={state.progressMetrics.requiredDone}
          requiredTotal={state.progressMetrics.requiredTotal}
          requiredMeter={state.requiredMeter}
          countedTasks={state.progressMetrics.countedTasks}
          solvedTasks={state.progressMetrics.solvedTasks}
          totalTasks={state.progressMetrics.totalTasks}
        />
      ) : null}

      <div className={styles.tabsRow}>
        <Tabs
          idBase={tabsId}
          tabs={state.tabs}
          active={state.activeTab}
          onChange={state.setActiveTab}
          ariaLabel="Вкладки юнита"
          className={styles.unitTabs}
        />
        <Button variant="ghost" onClick={onBack} className={styles.backInline}>
          ← Назад
        </Button>
      </div>

      <div id={activePanelId} role="tabpanel" aria-labelledby={activeTabId}>
        <StudentUnitTabContent
          activeTab={state.activeTab}
          unit={unit}
          videos={state.videos}
          unitRenderedContent={state.unitRenderedContent}
          orderedTasks={state.orderedTasks}
          taskNavigation={state.taskNavigation}
          activeState={state.activeState}
          attempt={state.attempt}
          photo={state.photo}
          media={state.media}
          onGoToStudentGraph={onGoToStudentGraph}
        />
      </div>

      <input
        ref={state.photo.photoFileInputRef}
        className={styles.photoFileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        onChange={state.photo.handlePhotoFileSelection}
      />
    </>
  );
}

export default function StudentUnitDetailScreen({ unitId }: Props) {
  const tabsId = useId();
  const router = useRouter();
  const handleLogout = useStudentLogout();
  const identity = useStudentIdentity();
  const state = useStudentUnitScreenState(unitId);

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
            <h1 className={styles.title}>{state.unit?.title ?? "Юнит"}</h1>
          </div>
        </div>

        {state.notFound ? <StudentNotFound /> : null}
        {state.error && !state.notFound ? (
          <div className={styles.error} role="status" aria-live="polite">
            {state.error}
          </div>
        ) : null}

        <StudentUnitBody
          tabsId={tabsId}
          unit={state.unit}
          state={state}
          onBack={() => router.back()}
          onGoToStudentGraph={() => router.push("/student")}
        />
      </div>
    </DashboardShell>
  );
}
