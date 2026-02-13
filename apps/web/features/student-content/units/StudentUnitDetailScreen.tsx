"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { studentApi, UnitWithTasks, AttemptRequest } from "@/lib/api/student";
import { getStudentErrorMessage } from "../shared/student-errors";
import StudentNotFound from "../shared/StudentNotFound";
import styles from "./student-unit-detail.module.css";
import DashboardShell from "@/components/DashboardShell";
import Tabs from "@/components/ui/Tabs";
import { toYouTubeEmbed } from "@/lib/video-embed";
import Button from "@/components/ui/Button";
import LiteTex from "@/components/LiteTex";
import { getStudentUnitStatusLabel } from "@/lib/status-labels";
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
            const response = await studentApi.getUnitPdfPresignedUrl(unit.id, target, 900);
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

  const totalTasks = unit?.totalTasks ?? orderedTasks.length;
  const countedTasks =
    unit?.countedTasks ??
    orderedTasks.filter((task) =>
      ["correct", "credited_without_progress", "teacher_credited"].includes(
        task.state?.status ?? "not_started",
      ),
    ).length;
  const solvedTasks =
    unit?.solvedTasks ??
    orderedTasks.filter((task) =>
      ["correct", "teacher_credited"].includes(task.state?.status ?? "not_started"),
    ).length;
  const requiredTotal = orderedTasks.filter((task) => task.isRequired).length;
  const requiredDone = orderedTasks.filter(
    (task) =>
      task.isRequired &&
      ["correct", "credited_without_progress", "teacher_credited"].includes(
        task.state?.status ?? "not_started",
      ),
  ).length;
  const unitStatusLabel = getStudentUnitStatusLabel(unit?.unitStatus ?? null);
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
    (status?: string | null) =>
      status === "correct" ||
      status === "credited_without_progress" ||
      status === "teacher_credited",
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
  const isChoiceTask =
    activeTask?.answerType === "single_choice" || activeTask?.answerType === "multi_choice";
  const showIncorrectBadge =
    Boolean(activeTask) && isChoiceTask && attemptFlash[activeTask.id] === "incorrect";
  const showCorrectBadge = activeState?.status === "correct";
  const isSolutionVisible = Boolean(activeTask && showSolutionByTask[activeTask.id]);

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
                <div className={styles.progressTop}>
                  <div>
                    <div className={styles.progressTitle}>Прогресс</div>
                  </div>
                  <div className={styles.progressStatusPill}>{unitStatusLabel}</div>
                </div>

                <div className={styles.progressMetrics}>
                  <article className={styles.progressMetric}>
                    <div className={styles.progressMetricLabel}>Выполнение</div>
                    <div className={styles.progressMetricValue}>{completionMeter}%</div>
                    <div className={styles.progressMeter}>
                      <span className={styles.progressMeterFill} style={getProgressFillStyle(completionMeter)} />
                    </div>
                  </article>

                  <article className={styles.progressMetric}>
                    <div className={styles.progressMetricLabel}>Решено</div>
                    <div className={styles.progressMetricValue}>{solvedMeter}%</div>
                    <div className={styles.progressMeter}>
                      <span className={styles.progressMeterFill} style={getProgressFillStyle(solvedMeter)} />
                    </div>
                  </article>

                  <article className={styles.progressMetric}>
                    <div className={styles.progressMetricLabel}>Обязательные</div>
                    <div className={styles.progressMetricValue}>
                      {requiredDone}/{requiredTotal}
                    </div>
                    <div className={styles.progressMeter}>
                      <span className={styles.progressMeterFill} style={getProgressFillStyle(requiredMeter)} />
                    </div>
                  </article>
                </div>

                <div className={styles.progressBottom}>
                  <div className={styles.progressChip}>
                    Учтено: <strong>{countedTasks}/{totalTasks}</strong>
                  </div>
                  <div className={styles.progressChip}>
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
                        zoom={pdfZoomByTarget.theory}
                        scrollFeel="inertial-heavy"
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
                        zoom={pdfZoomByTarget.method}
                        scrollFeel="inertial-heavy"
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
                                    onChange={(event) =>
                                      updateNumericValue(activeTask.id, part.key, event.target.value)
                                    }
                                    placeholder="Ответ"
                                  />
                                  {attemptPerPartResults ? (
                                    <span
                                      className={`${styles.partResult} ${
                                        attemptPerPartResults.find((item) => item.partKey === part.key)
                                          ?.correct
                                          ? styles.partResultCorrect
                                          : styles.partResultIncorrect
                                      }`}
                                    >
                                      {
                                        attemptPerPartResults.find((item) => item.partKey === part.key)
                                          ?.correct
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
                        <div className={styles.stub}>
                          Фото‑ответы будут доступны в следующем слайсе.
                        </div>
                      ) : null}

                      <div className={styles.taskActions}>
                        {!isTaskCredited ? (
                          <Button
                            onClick={handleSubmitAttempt}
                            disabled={isAttemptDisabled || !isAnswerReady}
                          >
                            Проверить
                          </Button>
                        ) : null}
                        {!isTaskCredited && showIncorrectBadge ? (
                          <span className={styles.taskResultIncorrect}>Неверно</span>
                        ) : null}
                        {isBlocked && blockedUntilIso ? (
                          <BlockedCountdown blockedUntilIso={blockedUntilIso} />
                        ) : null}
                        {isTaskCredited && activeTaskIndex < orderedTasks.length - 1 ? (
                          <Button
                            variant="ghost"
                            onClick={() => setActiveTaskId(orderedTasks[activeTaskIndex + 1]?.id ?? null)}
                          >
                            Следующая
                          </Button>
                        ) : null}
                        {isTaskCredited ? (
                          <Button
                            variant="ghost"
                            onClick={() =>
                              setShowSolutionByTask((prev) => ({
                                ...prev,
                                [activeTask.id]: !prev[activeTask.id],
                              }))
                            }
                          >
                            {isSolutionVisible ? "Скрыть решение" : "Показать решение"}
                          </Button>
                        ) : null}
                        {showCorrectBadge ? (
                          <span className={styles.taskResultCorrect}>Верно</span>
                        ) : null}
                        <div className={styles.attemptsLeftBadge}>Осталось попыток: {attemptsLeft}</div>
                      </div>
                      {isTaskCredited && isSolutionVisible ? (
                        <div className={styles.solutionPanel}>
                          {activeTask.solutionLite?.trim() ? (
                            <LiteTex value={activeTask.solutionLite} block />
                          ) : (
                            <div className={styles.solutionStub}>
                              Решение пока не добавлено. PDF‑решение появится позже.
                            </div>
                          )}
                        </div>
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
          </>
        )}
      </div>
    </DashboardShell>
  );
}
