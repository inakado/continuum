import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  teacherApi,
  type LatexCompileJobStatusResponse,
  type Task,
  type UnitWithTasks,
} from "@/lib/api/teacher";
import { getApiErrorMessage } from "../../shared/api-errors";

const COMPILE_POLL_INTERVAL_MS = 1500;
const COMPILE_POLL_TIMEOUT_MS = 120_000;
const APPLY_RACE_RETRY_COUNT = 2;
const APPLY_RACE_DELAY_MS = 900;

export type CompileState = {
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
  key: string | null;
};

export type TaskSolutionCompileStatus = "idle" | "queued" | "running" | "succeeded" | "failed";

export type TaskSolutionCompileState = {
  status: TaskSolutionCompileStatus;
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
  key: string | null;
  previewUrl: string | null;
};

export type CompileErrorModalTarget = "theory" | "method" | "task_solution";

export type CompileErrorModalState = {
  target: CompileErrorModalTarget;
  jobId: string;
  code: string;
  message: string;
  log: string | null;
  logSnippet: string | null;
  logTruncated: boolean;
  logLimitBytes: number | null;
  openedAt: number;
};

const createInitialTaskSolutionState = (task?: Task | null): TaskSolutionCompileState => ({
  status: "idle",
  loading: false,
  error: null,
  updatedAt: null,
  key: task?.solutionPdfAssetKey ?? null,
  previewUrl: null,
});

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

const buildPdfPreviewSrc = (url: string): string => url;

const getCompileErrorMessage = (error: unknown) =>
  error instanceof Error && error.message ? error.message : getApiErrorMessage(error);

export const compileTargetLabels: Record<CompileErrorModalTarget, string> = {
  theory: "Теория",
  method: "Методика",
  task_solution: "Решение",
};

export const formatLogTailLimit = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "250KB";
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }
  const kb = Math.max(1, Math.round(bytes / 1024));
  return `${kb}KB`;
};

const updateTaskSolutionCompileStatus = (
  setTaskSolutionCompileState: Dispatch<SetStateAction<TaskSolutionCompileState>>,
  status: TaskSolutionCompileStatus,
  loading: boolean,
) => {
  setTaskSolutionCompileState((prev) => ({
    ...prev,
    status,
    loading,
  }));
};

const pollLatexCompileJob = async ({
  jobId,
  onStatus,
}: {
  jobId: string;
  onStatus?: (status: LatexCompileJobStatusResponse["status"]) => void;
}) => {
  const startedAt = Date.now();
  let finalStatus = await teacherApi.getLatexCompileJob(jobId, 600);

  while (finalStatus.status === "queued" || finalStatus.status === "running") {
    if (Date.now() - startedAt > COMPILE_POLL_TIMEOUT_MS) {
      throw new Error("Истекло время ожидания компиляции.");
    }
    onStatus?.(finalStatus.status);
    await wait(COMPILE_POLL_INTERVAL_MS);
    finalStatus = await teacherApi.getLatexCompileJob(jobId, 600);
  }

  return finalStatus;
};

const findTaskInUnit = (unit: UnitWithTasks | null, taskId: string) =>
  unit?.tasks.find((task) => task.id === taskId) ?? null;

const resolveTaskSolutionAfterRefresh = async ({
  taskId,
  fetchUnit,
}: {
  taskId: string;
  fetchUnit: () => Promise<UnitWithTasks | null>;
}) => {
  let refreshedTask: Task | null = null;
  for (let attempt = 0; attempt <= APPLY_RACE_RETRY_COUNT; attempt += 1) {
    const refreshedUnit = await fetchUnit();
    refreshedTask = findTaskInUnit(refreshedUnit, taskId);
    if (refreshedTask?.solutionPdfAssetKey) break;
    if (attempt < APPLY_RACE_RETRY_COUNT) {
      await wait(APPLY_RACE_DELAY_MS);
    }
  }
  return refreshedTask;
};

const resolveTaskSolutionPreview = async (taskId: string, task: Task | null) => {
  if (!task?.solutionPdfAssetKey) return null;
  try {
    const preview = await teacherApi.getTaskSolutionPdfPresignedUrl(taskId, 600);
    return buildPdfPreviewSrc(preview.url);
  } catch {
    return null;
  }
};

type Params = {
  unit: UnitWithTasks | null;
  setUnit: Dispatch<SetStateAction<UnitWithTasks | null>>;
  theoryText: string;
  methodText: string;
  editingTask: Task | null;
  fetchUnit: () => Promise<UnitWithTasks | null>;
};

export const useTeacherUnitLatexCompile = ({
  unit,
  setUnit,
  theoryText,
  methodText,
  editingTask,
  fetchUnit,
}: Params) => {
  const [previewUrls, setPreviewUrls] = useState<Record<"theory" | "method", string | null>>({
    theory: null,
    method: null,
  });
  const [compileState, setCompileState] = useState<Record<"theory" | "method", CompileState>>({
    theory: { loading: false, error: null, updatedAt: null, key: null },
    method: { loading: false, error: null, updatedAt: null, key: null },
  });

  const [taskSolutionLatex, setTaskSolutionLatex] = useState("");
  const [taskSolutionCompileState, setTaskSolutionCompileState] = useState<TaskSolutionCompileState>(
    createInitialTaskSolutionState(),
  );

  const [compileErrorModalState, setCompileErrorModalState] = useState<CompileErrorModalState | null>(null);
  const [isCompileErrorModalOpen, setIsCompileErrorModalOpen] = useState(false);
  const [compileErrorCopyState, setCompileErrorCopyState] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (!unit) {
      setPreviewUrls({ theory: null, method: null });
      setCompileState({
        theory: { loading: false, error: null, updatedAt: null, key: null },
        method: { loading: false, error: null, updatedAt: null, key: null },
      });
      return;
    }

    let cancelled = false;
    setCompileState((prev) => ({
      theory: { ...prev.theory, key: unit.theoryPdfAssetKey ?? null },
      method: { ...prev.method, key: unit.methodPdfAssetKey ?? null },
    }));

    void (async () => {
      const targets = ["theory", "method"] as const;
      const entries = await Promise.all(
        targets.map(async (target) => {
          const key = target === "theory" ? unit.theoryPdfAssetKey : unit.methodPdfAssetKey;
          if (!key) return [target, null] as const;
          try {
            const response = await teacherApi.getUnitPdfPresignedUrl(unit.id, target, 600);
            return [target, response.url ? buildPdfPreviewSrc(response.url) : null] as const;
          } catch {
            return [target, null] as const;
          }
        }),
      );

      if (cancelled) return;

      const nextPreviewUrls: Record<"theory" | "method", string | null> = {
        theory: null,
        method: null,
      };
      for (const [target, url] of entries) nextPreviewUrls[target] = url;
      setPreviewUrls(nextPreviewUrls);
    })();

    return () => {
      cancelled = true;
    };
  }, [unit?.id, unit?.theoryPdfAssetKey, unit?.methodPdfAssetKey]);

  const refreshPreviewUrl = useCallback(
    async (target: "theory" | "method") => {
      if (!unit?.id) return null;
      const response = await teacherApi.getUnitPdfPresignedUrl(unit.id, target, 600);
      const nextUrl = response.url ? buildPdfPreviewSrc(response.url) : null;
      setPreviewUrls((prev) => ({ ...prev, [target]: nextUrl }));
      return nextUrl;
    },
    [unit?.id],
  );

  const refreshTheoryPreviewUrl = useCallback(() => refreshPreviewUrl("theory"), [refreshPreviewUrl]);
  const refreshMethodPreviewUrl = useCallback(() => refreshPreviewUrl("method"), [refreshPreviewUrl]);

  const refreshTaskSolutionPreviewUrl = useCallback(async () => {
    if (!editingTask?.id) return null;
    const response = await teacherApi.getTaskSolutionPdfPresignedUrl(editingTask.id, 600);
    setTaskSolutionCompileState((prev) => ({
      ...prev,
      key: response.key,
      previewUrl: buildPdfPreviewSrc(response.url),
    }));
    return buildPdfPreviewSrc(response.url);
  }, [editingTask?.id]);

  useEffect(() => {
    if (!editingTask) {
      setTaskSolutionLatex("");
      setTaskSolutionCompileState(createInitialTaskSolutionState());
      return;
    }

    let cancelled = false;
    setTaskSolutionLatex(editingTask.solutionRichLatex ?? "");
    setTaskSolutionCompileState(createInitialTaskSolutionState(editingTask));

    if (!editingTask.solutionPdfAssetKey) return;

    void (async () => {
      try {
        const response = await teacherApi.getTaskSolutionPdfPresignedUrl(editingTask.id, 600);
        if (cancelled) return;
        setTaskSolutionCompileState((prev) => ({
          ...prev,
          key: response.key,
          previewUrl: buildPdfPreviewSrc(response.url),
        }));
      } catch {
        if (cancelled) return;
        setTaskSolutionCompileState((prev) => ({
          ...prev,
          previewUrl: null,
        }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editingTask?.id, editingTask?.solutionPdfAssetKey, editingTask?.solutionRichLatex]);

  const openCompileErrorModal = useCallback(
    ({
      target,
      jobId,
      errorDetails,
    }: {
      target: CompileErrorModalTarget;
      jobId: string;
      errorDetails?: LatexCompileJobStatusResponse["error"];
    }) => {
      const log = errorDetails?.log ?? errorDetails?.logSnippet ?? null;
      const logSnippet =
        errorDetails?.logSnippet ??
        (typeof errorDetails?.log === "string" && errorDetails.log
          ? errorDetails.log.length <= 1200
            ? errorDetails.log
            : `...${errorDetails.log.slice(-1200)}`
          : null);

      setCompileErrorModalState({
        target,
        jobId,
        code: errorDetails?.code ?? "LATEX_COMPILE_FAILED",
        message: errorDetails?.message ?? "LaTeX compilation failed",
        log,
        logSnippet,
        logTruncated: errorDetails?.logTruncated === true,
        logLimitBytes:
          typeof errorDetails?.logLimitBytes === "number" && errorDetails.logLimitBytes > 0
            ? Math.floor(errorDetails.logLimitBytes)
            : null,
        openedAt: Date.now(),
      });
      setCompileErrorCopyState("idle");
      setIsCompileErrorModalOpen(true);
    },
    [],
  );

  const closeCompileErrorModal = useCallback(() => {
    setIsCompileErrorModalOpen(false);
    setCompileErrorCopyState("idle");
  }, []);

  const reopenCompileErrorModal = useCallback(
    (target: CompileErrorModalTarget) => {
      if (!compileErrorModalState || compileErrorModalState.target !== target) return;
      setCompileErrorCopyState("idle");
      setIsCompileErrorModalOpen(true);
    },
    [compileErrorModalState],
  );

  const copyCompileErrorLog = useCallback(async () => {
    if (!compileErrorModalState) return;

    const header = [
      `Target: ${compileTargetLabels[compileErrorModalState.target]}`,
      `Job: ${compileErrorModalState.jobId}`,
      `Code: ${compileErrorModalState.code}`,
      `Message: ${compileErrorModalState.message}`,
      `Opened: ${new Date(compileErrorModalState.openedAt).toLocaleString("ru-RU")}`,
    ];
    const body = compileErrorModalState.log ?? compileErrorModalState.logSnippet ?? "";
    const text = body ? `${header.join("\n")}\n\n${body}` : header.join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCompileErrorCopyState("copied");
    } catch {
      setCompileErrorCopyState("failed");
    }
  }, [compileErrorModalState]);

  useEffect(() => {
    if (compileErrorCopyState !== "copied") return;
    const timerId = window.setTimeout(() => {
      setCompileErrorCopyState("idle");
    }, 1800);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [compileErrorCopyState]);

  const runCompile = useCallback(
    async (target: "theory" | "method") => {
      if (!unit) return;
      const tex = target === "theory" ? theoryText : methodText;
      if (!tex.trim()) {
        setCompileState((prev) => ({
          ...prev,
          [target]: {
            ...prev[target],
            error: "Введите LaTeX перед компиляцией.",
          },
        }));
        return;
      }

      setCompileState((prev) => ({
        ...prev,
        [target]: {
          ...prev[target],
          loading: true,
          error: null,
        },
      }));

      try {
        const queued = await teacherApi.enqueueUnitLatexCompile(unit.id, { tex, target, ttlSec: 600 });
        const startedAt = Date.now();
        let finalStatus = await teacherApi.getLatexCompileJob(queued.jobId, 600);

        while (finalStatus.status === "queued" || finalStatus.status === "running") {
          if (Date.now() - startedAt > COMPILE_POLL_TIMEOUT_MS) {
            throw new Error("Истекло время ожидания компиляции.");
          }
          await wait(COMPILE_POLL_INTERVAL_MS);
          finalStatus = await teacherApi.getLatexCompileJob(queued.jobId, 600);
        }

        if (finalStatus.status === "failed") {
          openCompileErrorModal({
            target,
            jobId: queued.jobId,
            errorDetails: finalStatus.error,
          });
          setCompileState((prev) => ({
            ...prev,
            [target]: {
              ...prev[target],
              loading: false,
              error: "Компиляция не удалась. Откройте лог.",
            },
          }));
          return;
        }

        if (finalStatus.status !== "succeeded" || !finalStatus.assetKey) {
          throw new Error("Невозможно применить результат компиляции.");
        }

        const refreshedUnit = await teacherApi.getUnit(unit.id);
        setUnit((prev) => (prev ? { ...prev, ...refreshedUnit } : prev));

        const actualAssetKey =
          target === "theory" ? refreshedUnit.theoryPdfAssetKey : refreshedUnit.methodPdfAssetKey;

        let previewUrl: string | null = null;
        if (actualAssetKey && actualAssetKey === finalStatus.assetKey && finalStatus.presignedUrl) {
          previewUrl = buildPdfPreviewSrc(finalStatus.presignedUrl);
        } else if (actualAssetKey) {
          try {
            const fallbackPresign = await teacherApi.getUnitPdfPresignedUrl(unit.id, target, 600);
            previewUrl = fallbackPresign.url ? buildPdfPreviewSrc(fallbackPresign.url) : null;
          } catch {
            previewUrl = null;
          }
        }

        setPreviewUrls((prev) => ({
          ...prev,
          [target]: previewUrl,
        }));
        setCompileState((prev) => ({
          ...prev,
          [target]: {
            loading: false,
            error: null,
            updatedAt: Date.now(),
            key: actualAssetKey ?? finalStatus.assetKey,
          },
        }));
      } catch (err) {
        const compileErrorMessage =
          err instanceof Error && err.message ? err.message : getApiErrorMessage(err);
        setCompileState((prev) => ({
          ...prev,
          [target]: {
            ...prev[target],
            loading: false,
            error: compileErrorMessage,
          },
        }));
      }
    },
    [methodText, openCompileErrorModal, setUnit, theoryText, unit],
  );

  const runTaskSolutionCompile = useCallback(async () => {
    if (!editingTask) return;

    const taskId = editingTask.id;
    const latex = taskSolutionLatex.trim();
    if (!latex) {
      setTaskSolutionCompileState((prev) => ({
        ...prev,
        status: "failed",
        loading: false,
        error: "Введите LaTeX перед компиляцией.",
      }));
      return;
    }

    setTaskSolutionCompileState((prev) => ({
      ...prev,
      status: "queued",
      loading: true,
      error: null,
    }));

    try {
      const queued = await teacherApi.compileTaskSolutionLatex(taskId, { latex, ttlSec: 600 });
      const finalStatus = await pollLatexCompileJob({
        jobId: queued.jobId,
        onStatus: (status) => updateTaskSolutionCompileStatus(setTaskSolutionCompileState, status, true),
      });

      if (finalStatus.status === "failed") {
        openCompileErrorModal({
          target: "task_solution",
          jobId: queued.jobId,
          errorDetails: finalStatus.error,
        });
        setTaskSolutionCompileState((prev) => ({
          ...prev,
          status: "failed",
          loading: false,
          error: "Компиляция не удалась. Откройте лог.",
        }));
        return;
      }

      if (finalStatus.status !== "succeeded" || !finalStatus.assetKey) {
        throw new Error("Компиляция завершилась без валидного результата.");
      }

      let refreshedTask = await resolveTaskSolutionAfterRefresh({ taskId, fetchUnit });

      if (!refreshedTask?.solutionPdfAssetKey) {
        try {
          await teacherApi.applyLatexCompileJob(queued.jobId);
        } catch {
          // auto-apply остаётся основным путём; fallback тихий
        }
        refreshedTask = await resolveTaskSolutionAfterRefresh({ taskId, fetchUnit });
      }

      const previewUrl = await resolveTaskSolutionPreview(taskId, refreshedTask);
      const resolvedAssetKey = refreshedTask?.solutionPdfAssetKey ?? finalStatus.assetKey ?? null;

      setTaskSolutionCompileState((prev) => ({
        ...prev,
        status: "succeeded",
        loading: false,
        error: refreshedTask?.solutionPdfAssetKey ? null : "PDF ещё применяем… обновите через секунду.",
        updatedAt: Date.now(),
        key: resolvedAssetKey,
        previewUrl,
      }));
    } catch (err) {
      setTaskSolutionCompileState((prev) => ({
        ...prev,
        status: "failed",
        loading: false,
        error: getCompileErrorMessage(err),
      }));
    }
  }, [editingTask, fetchUnit, openCompileErrorModal, taskSolutionLatex]);

  const compileErrorLogHint = useMemo(() => {
    if (!compileErrorModalState?.logTruncated) return null;
    return `Лог обрезан до последних ${formatLogTailLimit(compileErrorModalState.logLimitBytes ?? 256_000)}.`;
  }, [compileErrorModalState?.logLimitBytes, compileErrorModalState?.logTruncated]);

  return {
    previewUrls,
    compileState,
    runCompile,
    refreshTheoryPreviewUrl,
    refreshMethodPreviewUrl,
    taskSolutionLatex,
    setTaskSolutionLatex,
    taskSolutionCompileState,
    runTaskSolutionCompile,
    refreshTaskSolutionPreviewUrl,
    compileErrorModalState,
    isCompileErrorModalOpen,
    setIsCompileErrorModalOpen,
    compileErrorCopyState,
    closeCompileErrorModal,
    reopenCompileErrorModal,
    copyCompileErrorLog,
    compileErrorLogHint,
  };
};
