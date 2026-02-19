"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ChangeEvent } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import {
  studentApi,
  UnitWithTasks,
  AttemptRequest,
  TaskState,
} from "@/lib/api/student";
import { getStudentErrorMessage } from "../shared/student-errors";
import StudentNotFound from "../shared/StudentNotFound";
import styles from "./student-unit-detail.module.css";
import DashboardShell from "@/components/DashboardShell";
import Tabs from "@/components/ui/Tabs";
import { toYouTubeEmbed } from "@/lib/video-embed";
import Button from "@/components/ui/Button";
import LiteTex from "@/components/LiteTex";
import { useStudentLogout } from "../auth/use-student-logout";
import { useStudentIdentity } from "../shared/use-student-identity";
import { ApiError } from "@/lib/api/client";

type Props = {
  unitId: string;
};

type TabKey = "theory" | "method" | "tasks" | "video" | "attachments";
const PDF_ZOOM_MIN = 0.5;
const PDF_ZOOM_MAX = 1.4;
const PDF_ZOOM_STEP = 0.1;
const PDF_ZOOM_DEFAULT = 0.8;
const PHOTO_MAX_FILES = 5;
const PHOTO_MAX_SIZE_BYTES = 20 * 1024 * 1024;
const PHOTO_ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PHOTO_REVIEWABLE_STATUS = new Set<TaskState["status"]>(["not_started", "in_progress", "rejected"]);
const CREDITED_TASK_STATUSES = new Set<TaskState["status"]>([
  "correct",
  "accepted",
  "credited_without_progress",
  "teacher_credited",
]);
const SOLVED_TASK_STATUSES = new Set<TaskState["status"]>(["correct", "accepted", "teacher_credited"]);
const PdfCanvasPreview = dynamic(() => import("@/components/PdfCanvasPreview"), {
  ssr: false,
  loading: () => <div className={styles.stub}>Загрузка PDF...</div>,
});

const formatRemainingDuration = (remainingMs: number) => {
  const totalSeconds = Math.ceil(Math.max(0, remainingMs) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds}с`;
  if (seconds === 0) return `${minutes}м`;
  return `${minutes}м ${seconds}с`;
};

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${bytes} B`;
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
  const [unit, setUnit] = useState<UnitWithTasks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [lockedAccessMessage, setLockedAccessMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("tasks");
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [numericAnswers, setNumericAnswers] = useState<Record<string, Record<string, string>>>({});
  const [singleAnswers, setSingleAnswers] = useState<Record<string, string>>({});
  const [multiAnswers, setMultiAnswers] = useState<Record<string, string[]>>({});
  const [showSolutionByTask, setShowSolutionByTask] = useState<Record<string, boolean>>({});
  const [taskSolutionPdfUrlByTask, setTaskSolutionPdfUrlByTask] = useState<Record<string, string | null>>({});
  const [taskSolutionLoadingByTask, setTaskSolutionLoadingByTask] = useState<Record<string, boolean>>({});
  const [taskSolutionErrorByTask, setTaskSolutionErrorByTask] = useState<Record<string, string | null>>({});
  const [taskSolutionErrorCodeByTask, setTaskSolutionErrorCodeByTask] = useState<
    Record<string, string | null>
  >({});
  const [attemptLoading, setAttemptLoading] = useState<Record<string, boolean>>({});
  const [attemptPerPart, setAttemptPerPart] = useState<
    Record<string, { partKey: string; correct: boolean }[] | null>
  >({});
  const [attemptFlash, setAttemptFlash] = useState<Record<string, "incorrect" | null>>({});
  const [previewUrls, setPreviewUrls] = useState<Record<"theory" | "method", string | null>>({
    theory: null,
    method: null,
  });
  const [previewLoadingByTarget, setPreviewLoadingByTarget] = useState<
    Record<"theory" | "method", boolean>
  >({
    theory: false,
    method: false,
  });
  const [previewErrorByTarget, setPreviewErrorByTarget] = useState<
    Record<"theory" | "method", string | null>
  >({
    theory: null,
    method: null,
  });
  const [pdfZoomByTarget, setPdfZoomByTarget] = useState<Record<"theory" | "method", number>>({
    theory: PDF_ZOOM_DEFAULT,
    method: PDF_ZOOM_DEFAULT,
  });
  const flashTimeoutsRef = useRef<Record<string, number>>({});
  const photoFileInputRef = useRef<HTMLInputElement | null>(null);
  const [photoSelectedFilesByTask, setPhotoSelectedFilesByTask] = useState<Record<string, File[]>>({});
  const [photoLoadingByTask, setPhotoLoadingByTask] = useState<Record<string, boolean>>({});
  const [photoFileDialogTaskId, setPhotoFileDialogTaskId] = useState<string | null>(null);

  const fetchUnit = useCallback(async () => {
    setError(null);
    setNotFound(false);
    setLockedAccessMessage(null);
    try {
      const data = await studentApi.getUnit(unitId);
      setUnit(data);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.code === "UNIT_LOCKED") {
        setUnit(null);
        setNotFound(false);
        setError(null);
        setLockedAccessMessage("Юнит пока заблокирован");
        return;
      }
      const message = getStudentErrorMessage(err);
      if (message === "Не найдено или недоступно") setNotFound(true);
      setError(message);
    }
  }, [unitId]);

  useEffect(() => {
    fetchUnit();
  }, [fetchUnit]);

  useEffect(() => {
    let disposed = false;
    const loadPreviewUrls = async () => {
      if (!unit?.id) {
        setPreviewUrls({ theory: null, method: null });
        setPreviewLoadingByTarget({ theory: false, method: false });
        setPreviewErrorByTarget({ theory: null, method: null });
        return;
      }

      const keyByTarget: Record<"theory" | "method", string | null | undefined> = {
        theory: unit.theoryPdfAssetKey,
        method: unit.methodPdfAssetKey,
      };
      setPreviewLoadingByTarget({
        theory: Boolean(keyByTarget.theory),
        method: Boolean(keyByTarget.method),
      });
      setPreviewErrorByTarget({ theory: null, method: null });

      const targets = ["theory", "method"] as const;
      const entries = await Promise.all(
        targets.map(async (target) => {
          const key = keyByTarget[target];
          if (!key) return [target, null, null] as const;
          try {
            const response = await studentApi.getUnitPdfPresignedUrl(unit.id, target, 180);
            return [target, response.url, null] as const;
          } catch (err) {
            return [target, null, getStudentErrorMessage(err)] as const;
          }
        }),
      );

      if (disposed) return;

      const nextUrls: Record<"theory" | "method", string | null> = { theory: null, method: null };
      const nextErrors: Record<"theory" | "method", string | null> = { theory: null, method: null };
      for (const [target, url, previewError] of entries) {
        nextUrls[target] = url;
        nextErrors[target] = previewError;
      }

      setPreviewUrls(nextUrls);
      setPreviewErrorByTarget(nextErrors);
      setPreviewLoadingByTarget({ theory: false, method: false });
    };

    loadPreviewUrls();
    return () => {
      disposed = true;
    };
  }, [unit?.id, unit?.methodPdfAssetKey, unit?.theoryPdfAssetKey]);

  const refreshPreviewUrl = useCallback(
    async (target: "theory" | "method") => {
      if (!unit?.id) return null;
      const response = await studentApi.getUnitPdfPresignedUrl(unit.id, target, 180);
      const nextUrl = response.url ?? null;
      setPreviewUrls((prev) => ({ ...prev, [target]: nextUrl }));
      setPreviewErrorByTarget((prev) => ({ ...prev, [target]: null }));
      return nextUrl;
    },
    [unit?.id],
  );

  const refreshTheoryPreviewUrl = useCallback(
    () => refreshPreviewUrl("theory"),
    [refreshPreviewUrl],
  );
  const refreshMethodPreviewUrl = useCallback(
    () => refreshPreviewUrl("method"),
    [refreshPreviewUrl],
  );

  const loadTaskSolutionPdf = useCallback(async (taskId: string) => {
    setTaskSolutionLoadingByTask((prev) => ({ ...prev, [taskId]: true }));
    setTaskSolutionErrorByTask((prev) => ({ ...prev, [taskId]: null }));
    setTaskSolutionErrorCodeByTask((prev) => ({ ...prev, [taskId]: null }));
    try {
      const response = await studentApi.getTaskSolutionPdfPresignForStudent(taskId, 180);
      setTaskSolutionPdfUrlByTask((prev) => ({ ...prev, [taskId]: response.url }));
      return response.url;
    } catch (err) {
      const code = err instanceof ApiError ? err.code ?? null : null;
      setTaskSolutionPdfUrlByTask((prev) => ({ ...prev, [taskId]: null }));
      setTaskSolutionErrorByTask((prev) => ({ ...prev, [taskId]: getStudentErrorMessage(err) }));
      setTaskSolutionErrorCodeByTask((prev) => ({ ...prev, [taskId]: code }));
      throw err;
    } finally {
      setTaskSolutionLoadingByTask((prev) => ({ ...prev, [taskId]: false }));
    }
  }, []);

  const validatePhotoFiles = useCallback((files: File[]) => {
    if (files.length === 0) return "Выберите хотя бы один файл.";
    if (files.length > PHOTO_MAX_FILES) {
      return `Можно выбрать не более ${PHOTO_MAX_FILES} файлов.`;
    }
    for (const file of files) {
      if (!PHOTO_ALLOWED_TYPES.has(file.type.toLowerCase())) {
        return "Разрешены только JPEG, PNG и WEBP.";
      }
      if (file.size > PHOTO_MAX_SIZE_BYTES) {
        return `Файл ${file.name} превышает лимит ${formatBytes(PHOTO_MAX_SIZE_BYTES)}.`;
      }
    }
    return null;
  }, []);

  const openPhotoFileDialog = useCallback((taskId: string) => {
    setPhotoFileDialogTaskId(taskId);
    photoFileInputRef.current?.click();
  }, []);

  const submitPhotoTask = useCallback(
    async (taskId: string, filesOverride?: File[]) => {
      const files = filesOverride ?? photoSelectedFilesByTask[taskId] ?? [];
      const validationError = validatePhotoFiles(files);
      if (validationError) {
        return;
      }

      setPhotoLoadingByTask((prev) => ({ ...prev, [taskId]: true }));

      try {
        const presigned = await studentApi.presignPhotoUpload(
          taskId,
          files.map((file) => ({
            filename: file.name,
            contentType: file.type,
            sizeBytes: file.size,
          })),
        );

        await Promise.all(
          presigned.uploads.map(async (upload, index) => {
            const file = files[index];
            if (!file) {
              throw new Error("Ошибка сопоставления файла и presigned URL.");
            }
            const headers = new Headers(upload.headers ?? {});
            if (!headers.has("Content-Type")) {
              headers.set("Content-Type", file.type);
            }

            const response = await fetch(upload.url, {
              method: "PUT",
              headers,
              body: file,
            });

            if (!response.ok) {
              throw new Error(`Не удалось загрузить файл ${file.name}.`);
            }
          }),
        );

        await studentApi.submitPhoto(
          taskId,
          presigned.uploads.map((item) => item.assetKey),
        );

        setPhotoSelectedFilesByTask((prev) => ({ ...prev, [taskId]: [] }));
        await fetchUnit();
      } catch {
      } finally {
        setPhotoLoadingByTask((prev) => ({ ...prev, [taskId]: false }));
      }
    },
    [fetchUnit, photoSelectedFilesByTask, validatePhotoFiles],
  );

  const handlePhotoFileSelection = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const taskId = photoFileDialogTaskId;
      if (!taskId) return;
      const files = Array.from(event.target.files ?? []);
      event.currentTarget.value = "";
      const validationError = validatePhotoFiles(files);
      if (validationError) {
        return;
      }
      setPhotoSelectedFilesByTask((prev) => ({ ...prev, [taskId]: files }));
    },
    [photoFileDialogTaskId, validatePhotoFiles],
  );

  useEffect(() => {
    return () => {
      Object.values(flashTimeoutsRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
    };
  }, []);

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
  const normalizePercent = useCallback((value: number) => Math.max(0, Math.min(100, Math.round(value))), []);
  const completionMeter = normalizePercent(completionPercent);
  const solvedMeter = normalizePercent(solvedPercent);
  const requiredMeter = requiredTotal > 0 ? normalizePercent((requiredDone / requiredTotal) * 100) : 100;
  const getProgressFillStyle = useCallback(
    (percent: number) => {
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
    },
    [normalizePercent],
  );

  const isCreditedStatus = useCallback(
    (status?: TaskState["status"] | null) =>
      CREDITED_TASK_STATUSES.has((status ?? "not_started") as TaskState["status"]),
    [],
  );

  const maxUnlockedIndex = useMemo(() => {
    if (!orderedTasks.length) return 0;
    const firstNotCredited = orderedTasks.findIndex(
      (task) => !isCreditedStatus(task.state?.status ?? "not_started"),
    );
    return firstNotCredited === -1 ? orderedTasks.length - 1 : firstNotCredited;
  }, [isCreditedStatus, orderedTasks]);

  useEffect(() => {
    if (!orderedTasks.length) {
      setActiveTaskId(null);
      return;
    }
    setActiveTaskId((prev) => {
      const fallbackId = orderedTasks[Math.min(maxUnlockedIndex, orderedTasks.length - 1)].id;
      if (!prev) return fallbackId;
      const index = orderedTasks.findIndex((task) => task.id === prev);
      if (index === -1) return fallbackId;
      if (index > maxUnlockedIndex) return fallbackId;
      return prev;
    });
  }, [maxUnlockedIndex, orderedTasks]);

  const activeTaskIndex = useMemo(() => {
    if (!orderedTasks.length) return 0;
    if (!activeTaskId) return 0;
    const index = orderedTasks.findIndex((task) => task.id === activeTaskId);
    return index >= 0 ? index : 0;
  }, [activeTaskId, orderedTasks]);

  const activeTask = useMemo(
    () => orderedTasks[activeTaskIndex],
    [activeTaskIndex, orderedTasks],
  );

  const activeState = activeTask?.state;
  const wrongAttempts = activeState?.wrongAttempts ?? 0;
  const attemptsLeft = Math.max(0, 6 - wrongAttempts);
  const blockedUntilIso = activeState?.blockedUntil ?? null;
  const blockedUntilMs = blockedUntilIso ? new Date(blockedUntilIso).getTime() : null;
  const [isBlocked, setIsBlocked] = useState(false);
  const isTaskCredited = isCreditedStatus(activeState?.status ?? "not_started");
  const hasTaskSolutionPdf = Boolean(activeTask?.solutionPdfAssetKey);
  const isChoiceTask =
    activeTask?.answerType === "single_choice" || activeTask?.answerType === "multi_choice";
  const showIncorrectBadge =
    Boolean(activeTask) && isChoiceTask && attemptFlash[activeTask.id] === "incorrect";
  const showCorrectBadge = activeState?.status === "correct";
  const isSolutionVisible = Boolean(activeTask && showSolutionByTask[activeTask.id]);
  const isPhotoTask = activeTask?.answerType === "photo";
  const activeTaskSolutionPdfUrl = activeTask ? (taskSolutionPdfUrlByTask[activeTask.id] ?? null) : null;
  const activeTaskSolutionLoading = activeTask ? Boolean(taskSolutionLoadingByTask[activeTask.id]) : false;
  const activeTaskSolutionError = activeTask ? (taskSolutionErrorByTask[activeTask.id] ?? null) : null;
  const activeTaskSolutionErrorCode = activeTask ? (taskSolutionErrorCodeByTask[activeTask.id] ?? null) : null;
  const photoSelectedFiles = activeTask ? (photoSelectedFilesByTask[activeTask.id] ?? []) : [];
  const isPhotoLoading = activeTask ? Boolean(photoLoadingByTask[activeTask.id]) : false;
  const canUploadPhoto =
    Boolean(activeTask) &&
    isPhotoTask &&
    PHOTO_REVIEWABLE_STATUS.has(activeState?.status ?? "not_started");

  const refreshTaskSolutionPreviewUrl = useCallback(async () => {
    if (!activeTask || activeTask.answerType === "photo") return null;
    try {
      return await loadTaskSolutionPdf(activeTask.id);
    } catch {
      return null;
    }
  }, [activeTask, loadTaskSolutionPdf]);

  useEffect(() => {
    if (!activeTask || activeTask.answerType === "photo") return;
    if (!isSolutionVisible) return;
    if (activeTaskSolutionPdfUrl || activeTaskSolutionLoading) return;
    void loadTaskSolutionPdf(activeTask.id).catch(() => {
      // сообщение уже выставлено в state
    });
  }, [
    activeTask,
    activeTaskSolutionLoading,
    activeTaskSolutionPdfUrl,
    isSolutionVisible,
    loadTaskSolutionPdf,
  ]);


  useEffect(() => {
    if (!activeTask) return;
    if (!isTaskCredited) return;
    if (activeTask.answerType === "numeric") {
      const next = (activeTask.numericPartsJson ?? []).reduce<Record<string, string>>(
        (acc, part) => {
          if (part.correctValue !== undefined) acc[part.key] = part.correctValue;
          return acc;
        },
        {},
      );
      if (Object.keys(next).length > 0) {
        setNumericAnswers((prev) => ({ ...prev, [activeTask.id]: next }));
      }
    }
    if (activeTask.answerType === "single_choice") {
      const key = activeTask.correctAnswerJson?.key ?? "";
      if (key) {
        setSingleAnswers((prev) => ({ ...prev, [activeTask.id]: key }));
      }
    }
    if (activeTask.answerType === "multi_choice") {
      const keys = activeTask.correctAnswerJson?.keys ?? [];
      if (keys.length > 0) {
        setMultiAnswers((prev) => ({ ...prev, [activeTask.id]: keys }));
      }
    }
  }, [activeTask, isTaskCredited]);

  useEffect(() => {
    if (!blockedUntilMs || !Number.isFinite(blockedUntilMs)) {
      setIsBlocked(false);
      return;
    }
    const remainingMs = blockedUntilMs - Date.now();
    if (remainingMs <= 0) {
      setIsBlocked(false);
      return;
    }
    setIsBlocked(true);
    const timeoutId = window.setTimeout(() => {
      setIsBlocked(false);
    }, remainingMs + 100);
    return () => window.clearTimeout(timeoutId);
  }, [blockedUntilMs, activeTask?.id]);

  const attemptPerPartResults = useMemo(() => {
    if (!activeTask) return null;
    return attemptPerPart[activeTask.id] ?? null;
  }, [activeTask, attemptPerPart]);

  const attemptPerPartByKey = useMemo(() => {
    if (!attemptPerPartResults) return null;
    return new Map(attemptPerPartResults.map((item) => [item.partKey, item.correct]));
  }, [attemptPerPartResults]);

  const updateNumericValue = useCallback((taskId: string, partKey: string, value: string) => {
    setNumericAnswers((prev) => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] ?? {}),
        [partKey]: value,
      },
    }));
  }, []);

  const updateSingleValue = useCallback((taskId: string, choiceKey: string) => {
    setSingleAnswers((prev) => ({ ...prev, [taskId]: choiceKey }));
  }, []);

  const toggleMultiValue = useCallback((taskId: string, choiceKey: string) => {
    setMultiAnswers((prev) => {
      const current = new Set(prev[taskId] ?? []);
      if (current.has(choiceKey)) {
        current.delete(choiceKey);
      } else {
        current.add(choiceKey);
      }
      return { ...prev, [taskId]: Array.from(current) };
    });
  }, []);

  const activeTaskChoices = useMemo(() => {
    if (!activeTask?.choicesJson) return [];
    const items = [...activeTask.choicesJson];
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }, [activeTask?.id, activeTask?.choicesJson]);

  const setPdfZoom = useCallback((target: "theory" | "method", zoom: number) => {
    const clamped = Math.max(PDF_ZOOM_MIN, Math.min(PDF_ZOOM_MAX, zoom));
    setPdfZoomByTarget((prev) => ({ ...prev, [target]: clamped }));
  }, []);

  const isAttemptDisabled = useMemo(() => {
    if (!activeTask) return true;
    if (attemptLoading[activeTask.id]) return true;
    if (activeTask.answerType === "photo") return true;
    if (activeState?.status === "correct") return true;
    if (activeState?.status === "credited_without_progress") return true;
    if (activeState?.status === "teacher_credited") return true;
    if (isBlocked) return true;
    return false;
  }, [activeTask, activeState?.status, attemptLoading, isBlocked]);

  const isAnswerReady = useMemo(() => {
    if (!activeTask) return false;
    if (activeTask.answerType === "numeric") {
      const parts = activeTask.numericPartsJson ?? [];
      if (!parts.length) return false;
      const values = numericAnswers[activeTask.id] ?? {};
      return parts.every((part) => (values[part.key] ?? "").trim().length > 0);
    }
    if (activeTask.answerType === "single_choice") {
      return Boolean(singleAnswers[activeTask.id]);
    }
    if (activeTask.answerType === "multi_choice") {
      return (multiAnswers[activeTask.id] ?? []).length > 0;
    }
    return false;
  }, [activeTask, multiAnswers, numericAnswers, singleAnswers]);

  const handleSubmitAttempt = useCallback(async () => {
    if (!activeTask) return;
    const taskId = activeTask.id;
    setAttemptPerPart((prev) => ({ ...prev, [taskId]: null }));
    setAttemptLoading((prev) => ({ ...prev, [taskId]: true }));
    try {
      let payload: AttemptRequest | null = null;
      if (activeTask.answerType === "numeric") {
        const values = numericAnswers[taskId] ?? {};
        payload = {
          answers: (activeTask.numericPartsJson ?? []).map((part) => ({
            partKey: part.key,
            value: values[part.key] ?? "",
          })),
        };
      }
      if (activeTask.answerType === "single_choice") {
        payload = { choiceKey: singleAnswers[taskId] };
      }
      if (activeTask.answerType === "multi_choice") {
        payload = { choiceKeys: multiAnswers[taskId] ?? [] };
      }
      if (!payload) return;

      const response = await studentApi.submitAttempt(taskId, payload);
      setAttemptPerPart((prev) => ({ ...prev, [taskId]: response.perPart ?? null }));
      if (activeTask.answerType === "single_choice" || activeTask.answerType === "multi_choice") {
        if (response.status !== "correct") {
          if (activeTask.answerType === "single_choice") {
            setSingleAnswers((prev) => ({ ...prev, [taskId]: "" }));
          } else {
            setMultiAnswers((prev) => ({ ...prev, [taskId]: [] }));
          }
          setAttemptFlash((prev) => ({ ...prev, [taskId]: "incorrect" }));
          if (flashTimeoutsRef.current[taskId]) {
            window.clearTimeout(flashTimeoutsRef.current[taskId]);
          }
          flashTimeoutsRef.current[taskId] = window.setTimeout(() => {
            setAttemptFlash((prev) => ({ ...prev, [taskId]: null }));
          }, 2500);
        } else {
          setAttemptFlash((prev) => ({ ...prev, [taskId]: null }));
        }
      }
      await fetchUnit();
    } catch (error) {
      if (error instanceof ApiError) {
        console.warn("Attempt failed", error.status, error.message);
      } else {
        console.warn("Attempt failed");
      }
    } finally {
      setAttemptLoading((prev) => ({ ...prev, [taskId]: false }));
    }
  }, [activeTask, fetchUnit, multiAnswers, numericAnswers, singleAnswers]);

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
                <div className={styles.pdfPanel}>
                  {previewErrorByTarget.theory ? (
                    <div className={styles.previewError} role="status" aria-live="polite">
                      {previewErrorByTarget.theory}
                    </div>
                  ) : null}
                  <div className={styles.pdfToolbar}>
                    <span className={styles.pdfToolbarLabel}>Масштаб</span>
                    <span className={styles.pdfZoomGroup}>
                      <button
                        type="button"
                        className={styles.pdfZoomButton}
                        onClick={() => setPdfZoom("theory", pdfZoomByTarget.theory - PDF_ZOOM_STEP)}
                        disabled={pdfZoomByTarget.theory <= PDF_ZOOM_MIN}
                      >
                        −
                      </button>
                      <span className={styles.pdfZoomValue}>{Math.round(pdfZoomByTarget.theory * 100)}%</span>
                      <button
                        type="button"
                        className={styles.pdfZoomButton}
                        onClick={() => setPdfZoom("theory", pdfZoomByTarget.theory + PDF_ZOOM_STEP)}
                        disabled={pdfZoomByTarget.theory >= PDF_ZOOM_MAX}
                      >
                        +
                      </button>
                    </span>
                    <button
                      type="button"
                      className={styles.pdfZoomReset}
                      onClick={() => setPdfZoom("theory", PDF_ZOOM_DEFAULT)}
                    >
                      100%
                    </button>
                  </div>
                  <div className={styles.pdfViewport}>
                    {previewUrls.theory ? (
                      <PdfCanvasPreview
                        className={styles.pdfFrame}
                        url={previewUrls.theory}
                        refreshKey={unit?.theoryPdfAssetKey ?? undefined}
                        getFreshUrl={refreshTheoryPreviewUrl}
                        zoom={pdfZoomByTarget.theory}
                        scrollFeel="inertial-heavy"
                        freezeWidth
                      />
                    ) : (
                      <div className={styles.stub}>
                        {previewLoadingByTarget.theory
                          ? "Загрузка PDF..."
                          : "PDF теории пока не опубликован учителем."}
                      </div>
                    )}
                  </div>
                </div>
              ) : activeTab === "method" ? (
                <div className={styles.pdfPanel}>
                  {previewErrorByTarget.method ? (
                    <div className={styles.previewError} role="status" aria-live="polite">
                      {previewErrorByTarget.method}
                    </div>
                  ) : null}
                  <div className={styles.pdfToolbar}>
                    <span className={styles.pdfToolbarLabel}>Масштаб</span>
                    <span className={styles.pdfZoomGroup}>
                      <button
                        type="button"
                        className={styles.pdfZoomButton}
                        onClick={() => setPdfZoom("method", pdfZoomByTarget.method - PDF_ZOOM_STEP)}
                        disabled={pdfZoomByTarget.method <= PDF_ZOOM_MIN}
                      >
                        −
                      </button>
                      <span className={styles.pdfZoomValue}>{Math.round(pdfZoomByTarget.method * 100)}%</span>
                      <button
                        type="button"
                        className={styles.pdfZoomButton}
                        onClick={() => setPdfZoom("method", pdfZoomByTarget.method + PDF_ZOOM_STEP)}
                        disabled={pdfZoomByTarget.method >= PDF_ZOOM_MAX}
                      >
                        +
                      </button>
                    </span>
                    <button
                      type="button"
                      className={styles.pdfZoomReset}
                      onClick={() => setPdfZoom("method", PDF_ZOOM_DEFAULT)}
                    >
                      100%
                    </button>
                  </div>
                  <div className={styles.pdfViewport}>
                    {previewUrls.method ? (
                      <PdfCanvasPreview
                        className={styles.pdfFrame}
                        url={previewUrls.method}
                        refreshKey={unit?.methodPdfAssetKey ?? undefined}
                        getFreshUrl={refreshMethodPreviewUrl}
                        zoom={pdfZoomByTarget.method}
                        scrollFeel="inertial-heavy"
                        freezeWidth
                      />
                    ) : (
                      <div className={styles.stub}>
                        {previewLoadingByTarget.method
                          ? "Загрузка PDF..."
                          : "PDF методики пока не опубликован учителем."}
                      </div>
                    )}
                  </div>
                </div>
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
                  <div className={styles.taskTabs}>
                    {orderedTasks.map((task, index) => {
                      const isActive = index === activeTaskIndex;
                      const isEnabled = index <= maxUnlockedIndex;
                      const isCorrect = task.state?.status === "correct";
                      return (
                        <button
                          key={task.id}
                          type="button"
                          className={`${styles.taskTab} ${
                            isActive ? styles.taskTabActive : ""
                          } ${isCorrect ? styles.taskTabDone : ""}`}
                          disabled={!isEnabled}
                          onClick={() => {
                            if (!isEnabled) return;
                            setActiveTaskId(task.id);
                          }}
                        >
                          <span>{index + 1}</span>
                        </button>
                      );
                    })}
                  </div>

                  {activeTask ? (
                    <div className={styles.taskCard}>
                      <div className={styles.taskHeader}>
                        <div className={styles.taskTitle}>Задача №{activeTaskIndex + 1}</div>
                        <div className={styles.taskHeaderBadges}>
                          {activeTask.isRequired ? (
                            <span className={styles.taskBadge}>Обязательная</span>
                          ) : null}
                        </div>
                      </div>
                      <div className={styles.taskStatement}>
                        <LiteTex value={activeTask.statementLite} block />
                      </div>

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

                      {activeTask.answerType === "numeric" ? (
                        <div className={styles.answerList}>
                          {(activeTask.numericPartsJson ?? []).length === 0 ? (
                            <div className={styles.stub}>Части ответа будут добавлены позже.</div>
                          ) : (
                            (activeTask.numericPartsJson ?? []).map((part, idx) => (
                              <div key={part.key} className={styles.answerRow}>
                                <div className={styles.answerInline}>
                                  <span className={styles.answerIndex}>{idx + 1}.</span>
                                  <span className={styles.answerLabelText}>
                                    <LiteTex value={part.labelLite ?? ""} />
                                  </span>
                                  <input
                                    className={styles.answerInputInline}
                                    value={numericAnswers[activeTask.id]?.[part.key] ?? ""}
                                    disabled={isTaskCredited}
                                    aria-label={`Ответ ${idx + 1}`}
                                    onChange={(event) =>
                                      updateNumericValue(activeTask.id, part.key, event.target.value)
                                    }
                                    placeholder="Ответ"
                                  />
                                  {attemptPerPartResults ? (
                                    <span
                                      className={`${styles.partResult} ${
                                        attemptPerPartByKey?.get(part.key)
                                          ? styles.partResultCorrect
                                          : styles.partResultIncorrect
                                      }`}
                                    >
                                      {
                                        attemptPerPartByKey?.get(part.key)
                                          ? "верно"
                                          : "ошибка"
                                      }
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      ) : null}

                      {activeTask.answerType === "single_choice" ||
                      activeTask.answerType === "multi_choice" ? (
                        <div className={styles.optionList}>
                          {(activeTask.choicesJson ?? []).length === 0 ? (
                            <div className={styles.stub}>Варианты ответа будут добавлены позже.</div>
                          ) : (
                            activeTaskChoices.map((choice, idx) => {
                              const isSingle = activeTask.answerType === "single_choice";
                              const selected = isSingle
                                ? singleAnswers[activeTask.id] === choice.key
                                : (multiAnswers[activeTask.id] ?? []).includes(choice.key);
                              return (
                                <label key={choice.key} className={styles.optionItem}>
                                  <input
                                    className={styles.optionInput}
                                    type={isSingle ? "radio" : "checkbox"}
                                    name={`task-${activeTask.id}`}
                                    checked={selected}
                                    disabled={isTaskCredited}
                                    onChange={() => {
                                      if (isSingle) {
                                        updateSingleValue(activeTask.id, choice.key);
                                      } else {
                                        toggleMultiValue(activeTask.id, choice.key);
                                      }
                                    }}
                                  />
                                  <span className={styles.optionIndex}>{idx + 1}.</span>
                                  <span className={styles.optionText}>
                                    <LiteTex value={choice.textLite} />
                                  </span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      ) : null}

                      {activeTask.answerType === "photo" ? (
                        <div className={styles.photoActions}>
                          {canUploadPhoto ? (
                            <Button
                              variant="ghost"
                              onClick={() => openPhotoFileDialog(activeTask.id)}
                              disabled={isPhotoLoading}
                            >
                              Загрузить фото
                            </Button>
                          ) : null}
                          {canUploadPhoto ? (
                            <Button
                              onClick={() => submitPhotoTask(activeTask.id)}
                              disabled={isPhotoLoading || photoSelectedFiles.length === 0}
                            >
                              {isPhotoLoading ? "Отправка..." : "Отправить"}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}

                      <div className={styles.taskActions}>
                        {!isPhotoTask && !isTaskCredited ? (
                          <Button
                            onClick={handleSubmitAttempt}
                            disabled={isAttemptDisabled || !isAnswerReady}
                          >
                            Проверить
                          </Button>
                        ) : null}
                        {!isPhotoTask && !isTaskCredited && showIncorrectBadge ? (
                          <span className={styles.taskResultIncorrect}>Неверно</span>
                        ) : null}
                        {!isPhotoTask && isBlocked && blockedUntilIso ? (
                          <BlockedCountdown blockedUntilIso={blockedUntilIso} />
                        ) : null}
                        {!isPhotoTask && isTaskCredited && activeTaskIndex < orderedTasks.length - 1 ? (
                          <Button
                            variant="ghost"
                            onClick={() => setActiveTaskId(orderedTasks[activeTaskIndex + 1]?.id ?? null)}
                          >
                            Следующая
                          </Button>
                        ) : null}
                        {!isPhotoTask && isTaskCredited && hasTaskSolutionPdf ? (
                          <Button
                            variant="ghost"
                            onClick={async () => {
                              const isVisible = Boolean(showSolutionByTask[activeTask.id]);
                              if (isVisible) {
                                setShowSolutionByTask((prev) => ({ ...prev, [activeTask.id]: false }));
                                return;
                              }
                              setShowSolutionByTask((prev) => ({ ...prev, [activeTask.id]: true }));
                              if (!taskSolutionPdfUrlByTask[activeTask.id]) {
                                try {
                                  await loadTaskSolutionPdf(activeTask.id);
                                } catch {
                                  // ошибка уже в taskSolutionErrorByTask
                                }
                              }
                            }}
                          >
                            {isSolutionVisible ? "Скрыть решение" : "Показать решение"}
                          </Button>
                        ) : null}
                        {!isPhotoTask && showCorrectBadge ? (
                          <span className={styles.taskResultCorrect}>Верно</span>
                        ) : null}
                        {!isPhotoTask ? (
                          <div className={styles.attemptsLeftBadge}>Осталось попыток: {attemptsLeft}</div>
                        ) : null}
                      </div>
                        {!isPhotoTask ? (
                          isTaskCredited && hasTaskSolutionPdf && isSolutionVisible ? (
                            activeTaskSolutionLoading ? (
                              <div className={styles.solutionHint}>Загружаем PDF-решение…</div>
                            ) : activeTaskSolutionError ? (
                              <div className={styles.solutionError} role="status" aria-live="polite">
                                {activeTaskSolutionError}
                                {activeTaskSolutionErrorCode === "UNIT_LOCKED" ? (
                                  <div className={styles.solutionErrorActions}>
                                    <Button variant="ghost" onClick={() => router.push("/student")}>
                                      К графу раздела
                                    </Button>
                                  </div>
                                ) : null}
                              </div>
                            ) : activeTaskSolutionPdfUrl ? (
                              <div className={styles.solutionPdfViewport}>
                                <PdfCanvasPreview
                                  className={styles.solutionPdfFrame}
                                  url={activeTaskSolutionPdfUrl}
                                  refreshKey={activeTask.solutionPdfAssetKey ?? undefined}
                                  getFreshUrl={refreshTaskSolutionPreviewUrl}
                                  zoom={PDF_ZOOM_DEFAULT}
                                  scrollFeel="inertial-heavy"
                                  freezeWidth
                                />
                              </div>
                            ) : null
                          ) : null
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className={styles.stub}>Задач пока нет.</div>
              )}
                </div>
              )}
            </div>
            <input
              ref={photoFileInputRef}
              className={styles.photoFileInput}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              tabIndex={-1}
              aria-hidden="true"
              onChange={handlePhotoFileSelection}
            />
          </>
        )}
      </div>
    </DashboardShell>
  );
}
