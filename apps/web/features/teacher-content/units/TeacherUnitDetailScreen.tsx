"use client";

import {
  memo,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ComponentProps,
} from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import DashboardShell from "@/components/DashboardShell";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Input from "@/components/ui/Input";
import Tabs from "@/components/ui/Tabs";
import type { Task, UnitVideo, UnitWithTasks } from "@/lib/api/teacher";
import { teacherApi } from "@/lib/api/teacher";
import { getContentStatusLabel } from "@/lib/status-labels";
import { getApiErrorMessage } from "../shared/api-errors";
import { useTeacherLogout } from "../auth/use-teacher-logout";
import TaskForm, { type TaskFormData } from "../tasks/TaskForm";
import styles from "./teacher-unit-detail.module.css";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EditorView } from "@codemirror/view";
import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import LiteTex from "@/components/LiteTex";
type CodeMirrorProps = ComponentProps<typeof import("@uiw/react-codemirror").default>;
type PdfCanvasPreviewProps = ComponentProps<typeof import("@/components/PdfCanvasPreview").default>;

const CodeMirror = dynamic<CodeMirrorProps>(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => <div className={styles.editorLoading}>Загрузка редактора…</div>,
});
const PdfCanvasPreview = dynamic<PdfCanvasPreviewProps>(() => import("@/components/PdfCanvasPreview"), {
  ssr: false,
  loading: () => <div className={styles.previewStub}>Загрузка PDF...</div>,
});

type Props = {
  unitId: string;
};

type TabKey = "theory" | "method" | "tasks" | "video" | "attachments";

type SaveState =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved"; at: number }
  | { state: "error"; message: string };

type ProgressSaveState =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved"; at: number }
  | { state: "error"; message: string };

type CompileState = {
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
  key: string | null;
};

const AUTOSAVE_DEBOUNCE_MS = 1000;
const COMPILE_POLL_INTERVAL_MS = 1500;
const COMPILE_POLL_TIMEOUT_MS = 120_000;

const answerTypeLabels: Record<TaskFormData["answerType"], string> = {
  numeric: "Числовая",
  single_choice: "Один вариант",
  multi_choice: "Несколько вариантов",
  photo: "Фото-ответ",
};

const buildSnapshot = (theory: string, method: string, videos: UnitVideo[]) => ({
  theory,
  method,
  videos: JSON.stringify(videos),
});

const buildPdfPreviewSrc = (url: string): string => {
  return url;
};

const sortTasks = (tasks: Task[]) =>
  [...tasks].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

const buildSortMap = (tasks: Task[]) => new Map(tasks.map((task) => [task.id, task.sortOrder ?? 0]));

const toProgressErrorMessage = (error: unknown) => {
  const rawMessage = getApiErrorMessage(error);
  if (rawMessage === "InvalidMinOptionalCountedTasksToComplete") {
    return "Введите целое число 0 или больше.";
  }
  return rawMessage;
};

type SortableTaskCardProps = {
  task: Task;
  index: number;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
};

const SortableTaskCard = memo(function SortableTaskCard({
  task,
  index,
  onEdit,
  onDelete,
}: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.taskCard} ${isDragging ? styles.taskCardDragging : ""}`}
      {...attributes}
      {...listeners}
    >
      <div className={styles.taskHeader}>
        <div className={styles.taskTitleRow}>
          <div className={styles.taskNumber}>Задача №{index + 1}</div>
          {task.isRequired ? <span className={styles.requiredBadge}>Обязательная</span> : null}
        </div>
        <div className={styles.taskMeta}>
          {answerTypeLabels[task.answerType]} • {getContentStatusLabel(task.status)}
        </div>
      </div>
      <div className={styles.taskStatement}>
        <LiteTex value={task.statementLite} block />
      </div>
      <div className={styles.taskActions}>
        <Button variant="ghost" onClick={() => onEdit(task)}>
          Редактировать
        </Button>
        <Button variant="ghost" onClick={() => onDelete(task)}>
          Удалить
        </Button>
      </div>
    </div>
  );
});

SortableTaskCard.displayName = "SortableTaskCard";

const buildTaskPayload = (data: TaskFormData) => {
  const base = {
    statementLite: data.statementLite,
    answerType: data.answerType,
    isRequired: data.isRequired,
    sortOrder: data.sortOrder,
    solutionLite: data.solutionLite.trim() ? data.solutionLite : null,
  };

  if (data.answerType === "numeric") {
    return {
      ...base,
      numericPartsJson: data.numericParts,
      choicesJson: null,
      correctAnswerJson: null,
    };
  }

  if (data.answerType === "single_choice" || data.answerType === "multi_choice") {
    return {
      ...base,
      numericPartsJson: null,
      choicesJson: data.choices,
      correctAnswerJson: data.correctAnswer,
    };
  }

  return {
    ...base,
    numericPartsJson: null,
    choicesJson: null,
    correctAnswerJson: null,
  };
};

const mapTaskToFormData = (task: Task): TaskFormData => ({
  statementLite: task.statementLite ?? "",
  answerType: task.answerType,
  numericParts: (task.numericPartsJson ?? []).map((part) => ({
    key: part.key ?? "",
    labelLite: part.labelLite ?? "",
    correctValue: part.correctValue ?? "",
  })),
  choices: task.choicesJson ?? [],
  correctAnswer: task.correctAnswerJson ?? null,
  solutionLite: task.solutionLite ?? "",
  isRequired: task.isRequired,
  sortOrder: task.sortOrder,
});

export default function TeacherUnitDetailScreen({ unitId }: Props) {
  const tabsId = useId();
  const router = useRouter();
  const handleLogout = useTeacherLogout();
  const [unit, setUnit] = useState<UnitWithTasks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("theory");

  const [theoryText, setTheoryText] = useState("");
  const [methodText, setMethodText] = useState("");
  const [videos, setVideos] = useState<UnitVideo[]>([]);

  const [creatingTask, setCreatingTask] = useState(false);
  const [creatingTaskPublish, setCreatingTaskPublish] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ state: "idle" });
  const [progressSaveState, setProgressSaveState] = useState<ProgressSaveState>({ state: "idle" });
  const [minCountedInput, setMinCountedInput] = useState("0");
  const [isOptionalMinEditing, setIsOptionalMinEditing] = useState(false);
  const [taskOrder, setTaskOrder] = useState<Task[]>([]);
  const [taskOrderStatus, setTaskOrderStatus] = useState<string | null>(null);
  const optionalMinInputRef = useRef<HTMLInputElement | null>(null);
  const [previewUrls, setPreviewUrls] = useState<Record<"theory" | "method", string | null>>({
    theory: null,
    method: null,
  });
  const [previewWidthPercent, setPreviewWidthPercent] = useState(38);
  const [isResizingLayout, setIsResizingLayout] = useState(false);
  const [compileState, setCompileState] = useState<Record<"theory" | "method", CompileState>>({
    theory: { loading: false, error: null, updatedAt: null, key: null },
    method: { loading: false, error: null, updatedAt: null, key: null },
  });

  const snapshotRef = useRef<ReturnType<typeof buildSnapshot> | null>(null);
  const timerRef = useRef<number | null>(null);
  const inflightRef = useRef(0);
  const editorGridRef = useRef<HTMLDivElement | null>(null);

  const navItems = useMemo(
    () => [
      { label: "Создание и редактирование", href: "/teacher", active: true },
      { label: "Ученики", href: "/teacher/students" },
      { label: "Аналитика", href: "/teacher/analytics" },
    ],
    [],
  );

  const tabs = useMemo(
    () => [
      { key: "theory" as const, label: "Теория" },
      { key: "method" as const, label: "Методика" },
      { key: "tasks" as const, label: "Задачи" },
      { key: "video" as const, label: "Видео" },
      { key: "attachments" as const, label: "Вложения" },
    ],
    [],
  );

  const nextTaskOrder = useMemo(() => {
    if (!taskOrder.length) return 1;
    const maxOrder = Math.max(...taskOrder.map((task) => task.sortOrder ?? 0));
    return Math.max(maxOrder + 1, taskOrder.length + 1);
  }, [taskOrder]);

  const requiredTasksCount = useMemo(
    () => taskOrder.filter((task) => task.isRequired).length,
    [taskOrder],
  );

  const editingTaskNumber = useMemo(() => {
    if (!editingTask) return null;
    const index = taskOrder.findIndex((task) => task.id === editingTask.id);
    return index >= 0 ? index + 1 : null;
  }, [editingTask, taskOrder]);

  const taskFormInitial = useMemo<Partial<TaskFormData>>(() => {
    if (editingTask) {
      return mapTaskToFormData(editingTask);
    }
    return { sortOrder: nextTaskOrder };
  }, [editingTask?.id, nextTaskOrder]);

  const hydratePdfPreviews = useCallback(async (nextUnit: UnitWithTasks) => {
    const targets = ["theory", "method"] as const;
    const entries = await Promise.all(
      targets.map(async (target) => {
        const key = target === "theory" ? nextUnit.theoryPdfAssetKey : nextUnit.methodPdfAssetKey;
        if (!key) return [target, null] as const;
        try {
          const response = await teacherApi.getUnitPdfPresignedUrl(nextUnit.id, target, 600);
          return [target, response.url ? buildPdfPreviewSrc(response.url) : null] as const;
        } catch {
          return [target, null] as const;
        }
      }),
    );

    const nextPreviewUrls: Record<"theory" | "method", string | null> = {
      theory: null,
      method: null,
    };
    for (const [target, url] of entries) nextPreviewUrls[target] = url;
    return nextPreviewUrls;
  }, []);

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

  const refreshTheoryPreviewUrl = useCallback(
    () => refreshPreviewUrl("theory"),
    [refreshPreviewUrl],
  );
  const refreshMethodPreviewUrl = useCallback(
    () => refreshPreviewUrl("method"),
    [refreshPreviewUrl],
  );

  const fetchUnit = useCallback(async () => {
    setError(null);
    try {
      const data = await teacherApi.getUnit(unitId);
      const previewByTarget = await hydratePdfPreviews(data);
      setUnit(data);

      const nextTheory = data.theoryRichLatex ?? "";
      const nextMethod = data.methodRichLatex ?? "";
      const nextVideos = data.videosJson ?? [];

      setTheoryText(nextTheory);
      setMethodText(nextMethod);
      setVideos(nextVideos);
      snapshotRef.current = buildSnapshot(nextTheory, nextMethod, nextVideos);
      setSaveState({ state: "idle" });
      setPreviewUrls(previewByTarget);
      setCompileState({
        theory: {
          loading: false,
          error: null,
          updatedAt: null,
          key: data.theoryPdfAssetKey ?? null,
        },
        method: {
          loading: false,
          error: null,
          updatedAt: null,
          key: data.methodPdfAssetKey ?? null,
        },
      });
      setTaskOrder(sortTasks(data.tasks));
      setTaskOrderStatus(null);
      setMinCountedInput(String(data.minOptionalCountedTasksToComplete ?? 0));
      setIsOptionalMinEditing(data.minOptionalCountedTasksToComplete === null);
      setProgressSaveState({ state: "idle" });
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, [hydratePdfPreviews, unitId]);

  useEffect(() => {
    fetchUnit();
  }, [fetchUnit]);

  const latexExtensions = useMemo(
    () => [StreamLanguage.define(stex), EditorView.lineWrapping],
    [],
  );

  const scheduleAutosave = useCallback(() => {
    if (!unit) return;
    const snapshot = snapshotRef.current;
    if (!snapshot) return;

    if (timerRef.current) window.clearTimeout(timerRef.current);

    timerRef.current = window.setTimeout(async () => {
      const currentSnapshot = snapshotRef.current;
      if (!currentSnapshot) return;

      const next = buildSnapshot(theoryText, methodText, videos);
      const changedTheory = next.theory !== currentSnapshot.theory;
      const changedMethod = next.method !== currentSnapshot.method;
      const changedVideos = next.videos !== currentSnapshot.videos;
      if (!changedTheory && !changedMethod && !changedVideos) return;

      const payload: {
        theoryRichLatex?: string | null;
        methodRichLatex?: string | null;
        videosJson?: UnitVideo[] | null;
      } = {};
      if (changedTheory) payload.theoryRichLatex = theoryText;
      if (changedMethod) payload.methodRichLatex = methodText;
      if (changedVideos) payload.videosJson = videos;

      setSaveState({ state: "saving" });
      inflightRef.current += 1;
      const requestId = inflightRef.current;

      try {
        const updated = await teacherApi.updateUnit(unit.id, payload);
        if (requestId !== inflightRef.current) return;

        setUnit((prev) =>
          prev
            ? {
                ...prev,
                ...updated,
                ...(changedTheory ? { theoryRichLatex: theoryText } : null),
                ...(changedMethod ? { methodRichLatex: methodText } : null),
                ...(changedVideos ? { videosJson: videos } : null),
              }
            : prev,
        );
        snapshotRef.current = next;
        setSaveState({ state: "saved", at: Date.now() });
      } catch (err) {
        if (requestId !== inflightRef.current) return;
        setSaveState({ state: "error", message: getApiErrorMessage(err) });
      }
    }, AUTOSAVE_DEBOUNCE_MS);
  }, [methodText, theoryText, unit, videos]);

  useEffect(() => {
    scheduleAutosave();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [scheduleAutosave]);

  const handleTaskSubmit = async (data: TaskFormData) => {
    if (!unit) return;
    setFormError(null);
    try {
      const created = await teacherApi.createTask({ unitId: unit.id, ...buildTaskPayload(data) });
      if (creatingTaskPublish) {
        try {
          await teacherApi.publishTask(created.id);
        } catch (err) {
          setEditingTask(created);
          setCreatingTask(false);
          setCreatingTaskPublish(false);
          setFormError(getApiErrorMessage(err));
          await fetchUnit();
          return;
        }
      }
      setCreatingTask(false);
      setCreatingTaskPublish(false);
      await fetchUnit();
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleTaskUpdate = async (data: TaskFormData) => {
    if (!editingTask) return;
    setFormError(null);
    try {
      await teacherApi.updateTask(editingTask.id, buildTaskPayload(data));
      setEditingTask(null);
      await fetchUnit();
    } catch (err) {
      setFormError(getApiErrorMessage(err));
    }
  };

  const handleTaskPublishToggle = async (task: Task) => {
    setError(null);
    try {
      const nextStatus = task.status === "published" ? "draft" : "published";
      if (task.status === "published") {
        await teacherApi.unpublishTask(task.id);
      } else {
        await teacherApi.publishTask(task.id);
      }
      setTaskOrder((prev) =>
        prev.map((item) => (item.id === task.id ? { ...item, status: nextStatus } : item)),
      );
      setEditingTask((prev) =>
        prev && prev.id === task.id ? { ...prev, status: nextStatus } : prev,
      );
      await fetchUnit();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  const handleUnitPublishToggle = useCallback(async () => {
    if (!unit) return;
    setError(null);
    const isPublished = unit.status === "published";
    try {
      if (isPublished) {
        await teacherApi.unpublishUnit(unit.id);
      } else {
        await teacherApi.publishUnit(unit.id);
      }
      setUnit((prev) => (prev ? { ...prev, status: isPublished ? "draft" : "published" } : prev));
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, [unit]);

  const handleTaskDelete = useCallback(async (task: Task) => {
    const confirmed = window.confirm("Удалить задачу? Действие нельзя отменить.");
    if (!confirmed) return;
    setError(null);
    try {
      await teacherApi.deleteTask(task.id);
      await fetchUnit();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, [fetchUnit]);

  const handleTaskEdit = useCallback((selected: Task) => {
    setEditingTask(selected);
    setCreatingTask(false);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const persistTaskOrder = useCallback(
    async (nextOrder: Task[], prevOrder: Task[]) => {
      if (!nextOrder.length) return;
      const prevMap = buildSortMap(prevOrder);
      const updates = nextOrder
        .map((task, index) => ({
          id: task.id,
          sortOrder: index + 1,
        }))
        .filter((update) => prevMap.get(update.id) !== update.sortOrder);
      if (!updates.length) return;

      setTaskOrderStatus("Сохранение порядка…");
      try {
        await Promise.all(
          updates.map((update) => teacherApi.updateTask(update.id, { sortOrder: update.sortOrder })),
        );
        setTaskOrderStatus("Порядок сохранён");
        await fetchUnit();
      } catch (err) {
        setTaskOrderStatus(getApiErrorMessage(err));
      }
    },
    [fetchUnit],
  );

  const saveStatusText =
    saveState.state === "saving"
      ? "Сохранение…"
      : saveState.state === "saved"
        ? "Сохранено"
        : saveState.state === "error"
          ? `Ошибка: ${saveState.message}`
          : "";

  const progressStatusText =
    progressSaveState.state === "saving"
      ? "Сохранение…"
      : progressSaveState.state === "error"
          ? progressSaveState.message
          : "";

  const handleProgressSave = async () => {
    if (!unit) return;
    const normalized = minCountedInput.trim();
    const parsed = Number(normalized);
    if (!normalized || !Number.isInteger(parsed) || parsed < 0) {
      setProgressSaveState({ state: "error", message: "Введите целое число 0 или больше." });
      return false;
    }

    setProgressSaveState({ state: "saving" });
    try {
      const updated = await teacherApi.updateUnit(unit.id, {
        minOptionalCountedTasksToComplete: parsed,
      });
      setUnit((prev) => (prev ? { ...prev, ...updated } : prev));
      setMinCountedInput(String(updated.minOptionalCountedTasksToComplete ?? parsed));
      setProgressSaveState({ state: "saved", at: Date.now() });
      return true;
    } catch (err) {
      setProgressSaveState({ state: "error", message: toProgressErrorMessage(err) });
      return false;
    }
  };

  const savedOptionalMin = unit?.minOptionalCountedTasksToComplete;
  const hasSavedOptionalMin = typeof savedOptionalMin === "number" && Number.isInteger(savedOptionalMin);
  const optionalPreview = (() => {
    const parsed = Number(minCountedInput.trim());
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
    return hasSavedOptionalMin ? savedOptionalMin : 0;
  })();
  const totalToComplete = requiredTasksCount + optionalPreview;

  useEffect(() => {
    if (!isOptionalMinEditing) return;
    optionalMinInputRef.current?.focus();
    optionalMinInputRef.current?.select();
  }, [isOptionalMinEditing]);

  const activePanelId = `${tabsId}-${activeTab}-panel`;
  const activeTabId = `${tabsId}-${activeTab}`;
  const minPreviewWidthPercent = 25;
  const maxPreviewWidthPercent = 60;
  const clampPreviewWidth = useCallback(
    (value: number) =>
      Math.min(maxPreviewWidthPercent, Math.max(minPreviewWidthPercent, Math.round(value))),
    [],
  );
  const editorGridStyle = useMemo(
    () =>
      ({
        "--editor-fr": `${100 - previewWidthPercent}fr`,
        "--preview-fr": `${previewWidthPercent}fr`,
        "--splitter-left": `${100 - previewWidthPercent}%`,
      }) as CSSProperties,
    [previewWidthPercent],
  );

  const updateLayoutRatioFromPointer = useCallback(
    (clientX: number) => {
      const grid = editorGridRef.current;
      if (!grid) return;

      const rect = grid.getBoundingClientRect();
      if (rect.width <= 0) return;

      const pointerOffset = clientX - rect.left;
      const nextPreviewPercent = ((rect.width - pointerOffset) / rect.width) * 100;
      setPreviewWidthPercent(clampPreviewWidth(nextPreviewPercent));
    },
    [clampPreviewWidth],
  );

  const handleSplitterPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      setIsResizingLayout(true);
      updateLayoutRatioFromPointer(event.clientX);
    },
    [updateLayoutRatioFromPointer],
  );

  const handleSplitterKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setPreviewWidthPercent((prev) => clampPreviewWidth(prev + 2));
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setPreviewWidthPercent((prev) => clampPreviewWidth(prev - 2));
      }
    },
    [clampPreviewWidth],
  );

  useEffect(() => {
    if (!isResizingLayout) return;

    const handlePointerMove = (event: PointerEvent) => {
      updateLayoutRatioFromPointer(event.clientX);
    };
    const stopResizing = () => setIsResizingLayout(false);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResizing);
    window.addEventListener("pointercancel", stopResizing);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResizing);
      window.removeEventListener("pointercancel", stopResizing);
    };
  }, [isResizingLayout, updateLayoutRatioFromPointer]);

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
          await new Promise((resolve) => window.setTimeout(resolve, COMPILE_POLL_INTERVAL_MS));
          finalStatus = await teacherApi.getLatexCompileJob(queued.jobId, 600);
        }

        if (finalStatus.status === "failed") {
          const code = finalStatus.error?.code ? ` (${finalStatus.error.code})` : "";
          const snippet = finalStatus.error?.logSnippet ? `\n${finalStatus.error.logSnippet}` : "";
          throw new Error(`${finalStatus.error?.message ?? "LaTeX compilation failed"}${code}${snippet}`);
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
    [methodText, theoryText, unit],
  );

  return (
    <DashboardShell
      title="Преподаватель"
      navItems={navItems}
      appearance="glass"
      onLogout={handleLogout}
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>{unit?.title ?? "Юнит"}</h1>
            <p className={styles.subtitle}>Редактор юнита</p>
          </div>
          <div className={styles.headerActions}>
            {unit ? (
              <Checkbox
                label="Опубликовано"
                checked={unit.status === "published"}
                onChange={handleUnitPublishToggle}
              />
            ) : null}
            {saveStatusText ? (
              <div className={styles.saveStatus} role="status" aria-live="polite">
                {saveStatusText}
              </div>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className={styles.error} role="status" aria-live="polite">
            {error}
          </div>
        ) : null}

        <div className={styles.tabsRow}>
          <Tabs
            idBase={tabsId}
            tabs={tabs}
            active={activeTab}
            onChange={setActiveTab}
            ariaLabel="Вкладки юнита"
          />
          <Button
            variant="ghost"
            onClick={() => {
              if (unit?.sectionId) {
                router.push(`/teacher/sections/${unit.sectionId}`);
              } else {
                router.back();
              }
            }}
            className={styles.backInline}
            disabled={!unit?.sectionId}
          >
            ← Назад
          </Button>
        </div>

        <div id={activePanelId} role="tabpanel" aria-labelledby={activeTabId}>
          {activeTab === "theory" ? (
            <div
              ref={editorGridRef}
              className={`${styles.editorGrid} ${isResizingLayout ? styles.editorGridResizing : ""}`}
              style={editorGridStyle}
            >
              <div className={styles.editorPanel}>
                <div className={styles.kicker}>Теория</div>
                <CodeMirror
                  className={styles.codeEditor}
                  value={theoryText}
                  height="100%"
                  onChange={setTheoryText}
                  extensions={latexExtensions}
                />
              </div>
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Изменить ширину редактора и предпросмотра"
                aria-valuemin={minPreviewWidthPercent}
                aria-valuemax={maxPreviewWidthPercent}
                aria-valuenow={previewWidthPercent}
                tabIndex={0}
                className={`${styles.editorSplitter} ${isResizingLayout ? styles.editorSplitterActive : ""}`}
                onPointerDown={handleSplitterPointerDown}
                onKeyDown={handleSplitterKeyDown}
              />
              <div className={styles.previewPanel}>
                <div className={styles.kicker}>Предпросмотр</div>
                <div className={styles.previewActions}>
                  <Button
                    onClick={() => runCompile("theory")}
                    disabled={compileState.theory.loading}
                  >
                    {compileState.theory.loading ? "Компиляция..." : "Скомпилировать PDF"}
                  </Button>
                </div>
                {compileState.theory.error ? (
                  <div className={styles.compileError} role="status" aria-live="polite">
                    {compileState.theory.error}
                  </div>
                ) : null}
                {compileState.theory.updatedAt ? (
                  <div className={styles.compileMeta}>
                    PDF обновлён: {new Date(compileState.theory.updatedAt).toLocaleString("ru-RU")}
                  </div>
                ) : null}
                <div className={styles.previewViewport}>
                  {previewUrls.theory ? (
                    <PdfCanvasPreview
                      className={styles.previewFrame}
                      url={previewUrls.theory}
                      refreshKey={compileState.theory.key ?? unit?.theoryPdfAssetKey ?? undefined}
                      getFreshUrl={refreshTheoryPreviewUrl}
                      scrollFeel="inertial-heavy"
                    />
                  ) : (
                    <div className={styles.previewStub}>Предпросмотр PDF появится здесь после сборки.</div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === "method" ? (
            <div
              ref={editorGridRef}
              className={`${styles.editorGrid} ${isResizingLayout ? styles.editorGridResizing : ""}`}
              style={editorGridStyle}
            >
              <div className={styles.editorPanel}>
                <div className={styles.kicker}>Методика</div>
                <CodeMirror
                  className={styles.codeEditor}
                  value={methodText}
                  height="100%"
                  onChange={setMethodText}
                  extensions={latexExtensions}
                />
              </div>
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Изменить ширину редактора и предпросмотра"
                aria-valuemin={minPreviewWidthPercent}
                aria-valuemax={maxPreviewWidthPercent}
                aria-valuenow={previewWidthPercent}
                tabIndex={0}
                className={`${styles.editorSplitter} ${isResizingLayout ? styles.editorSplitterActive : ""}`}
                onPointerDown={handleSplitterPointerDown}
                onKeyDown={handleSplitterKeyDown}
              />
              <div className={styles.previewPanel}>
                <div className={styles.kicker}>Предпросмотр</div>
                <div className={styles.previewActions}>
                  <Button
                    onClick={() => runCompile("method")}
                    disabled={compileState.method.loading}
                  >
                    {compileState.method.loading ? "Компиляция..." : "Скомпилировать PDF"}
                  </Button>
                </div>
                {compileState.method.error ? (
                  <div className={styles.compileError} role="status" aria-live="polite">
                    {compileState.method.error}
                  </div>
                ) : null}
                {compileState.method.updatedAt ? (
                  <div className={styles.compileMeta}>
                    PDF обновлён: {new Date(compileState.method.updatedAt).toLocaleString("ru-RU")}
                  </div>
                ) : null}
                <div className={styles.previewViewport}>
                  {previewUrls.method ? (
                    <PdfCanvasPreview
                      className={styles.previewFrame}
                      url={previewUrls.method}
                      refreshKey={compileState.method.key ?? unit?.methodPdfAssetKey ?? undefined}
                      getFreshUrl={refreshMethodPreviewUrl}
                      scrollFeel="inertial-heavy"
                    />
                  ) : (
                    <div className={styles.previewStub}>Предпросмотр PDF появится здесь после сборки.</div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === "video" ? (
            <div className={styles.videoPanel}>
              <div className={styles.videoHeader}>
                <div>
                  <div className={styles.kicker}>Видео</div>
                  <div className={styles.hint}>Ссылки сохраняются автоматически</div>
                </div>
                <Button
                  onClick={() =>
                    setVideos((prev) => [
                      ...prev,
                      { id: crypto.randomUUID(), title: "", embedUrl: "" },
                    ])
                  }
                >
                  Добавить видео
                </Button>
              </div>

              {videos.length === 0 ? (
                <div className={styles.previewStub}>Видео пока не добавлены.</div>
              ) : (
                <div className={styles.videoList}>
                  {videos.map((video, index) => (
                    <div key={video.id} className={styles.videoCard}>
                      <label className={styles.label}>
                        Название
                        <Input
                          value={video.title}
                          name={`videoTitle-${index}`}
                          autoComplete="off"
                          onChange={(event) =>
                            setVideos((prev) =>
                              prev.map((v) =>
                                v.id === video.id ? { ...v, title: event.target.value } : v,
                              ),
                            )
                          }
                        />
                      </label>
                      <label className={styles.label}>
                        Embed URL
                        <Input
                          value={video.embedUrl}
                          name={`videoUrl-${index}`}
                          autoComplete="off"
                          onChange={(event) =>
                            setVideos((prev) =>
                              prev.map((v) =>
                                v.id === video.id ? { ...v, embedUrl: event.target.value } : v,
                              ),
                            )
                          }
                        />
                      </label>
                      <div className={styles.videoActions}>
                        <Button
                          variant="ghost"
                          onClick={() => setVideos((prev) => prev.filter((v) => v.id !== video.id))}
                        >
                          Удалить
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === "attachments" ? (
            <div className={styles.previewStub}>Вложения будут добавлены позже.</div>
          ) : (
            <div className={styles.tasksPanel}>
              <div className={styles.progressCard}>
                <div className={styles.progressHeader}>
                  <div>
                    <div className={styles.progressTitle}>Порог выполнения</div>
                  </div>
                </div>

                <div className={styles.progressSummary}>
                  <div className={styles.progressMetric}>
                    <span className={styles.progressMetricLabel}>Обязательные</span>
                    <div className={styles.metricValueBox}>
                      <strong className={styles.progressMetricValue}>{requiredTasksCount}</strong>
                    </div>
                  </div>

                  <div className={styles.progressMetric}>
                    <span className={styles.progressMetricLabel}>Необязательные минимум</span>
                    {isOptionalMinEditing || !hasSavedOptionalMin ? (
                      <div className={styles.inlineOptionalEditor}>
                        <Input
                          ref={optionalMinInputRef}
                          className={styles.optionalInput}
                          type="number"
                          min={0}
                          step={1}
                          inputMode="numeric"
                          value={minCountedInput}
                          onChange={(event) => {
                            setMinCountedInput(event.target.value);
                            if (progressSaveState.state !== "idle") {
                              setProgressSaveState({ state: "idle" });
                            }
                          }}
                          onKeyDown={async (event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              const saved = await handleProgressSave();
                              if (saved) setIsOptionalMinEditing(false);
                            }
                            if (event.key === "Escape") {
                              event.preventDefault();
                              setMinCountedInput(String(savedOptionalMin ?? 0));
                              setIsOptionalMinEditing(false);
                            }
                          }}
                        />
                        <Button
                          onClick={async () => {
                            const saved = await handleProgressSave();
                            if (saved) setIsOptionalMinEditing(false);
                          }}
                          disabled={progressSaveState.state === "saving"}
                        >
                          Сохранить
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={styles.optionalValueButton}
                        title="Нажмите, чтобы изменить"
                        onClick={() => {
                          setMinCountedInput(String(savedOptionalMin));
                          setIsOptionalMinEditing(true);
                          if (progressSaveState.state !== "idle") {
                            setProgressSaveState({ state: "idle" });
                          }
                        }}
                      >
                        <strong className={styles.progressMetricValue}>{savedOptionalMin}</strong>
                      </button>
                    )}
                  </div>

                  <div className={styles.progressMetric}>
                    <span className={styles.progressMetricLabel}>Итог для завершения</span>
                    <div className={styles.metricValueBox}>
                      <strong className={styles.progressMetricValue}>{totalToComplete}</strong>
                    </div>
                  </div>
                </div>
                {progressSaveState.state === "error" && progressStatusText ? (
                  <div className={styles.progressError} role="status" aria-live="polite">
                    {progressStatusText}
                  </div>
                ) : null}
              </div>

              {!creatingTask && !editingTask ? (
                <div className={styles.tasksHeader}>
                  <Button
                    onClick={() => {
                      setCreatingTask(true);
                      setEditingTask(null);
                      setCreatingTaskPublish(false);
                      setFormError(null);
                    }}
                  >
                    Создать задачу
                  </Button>
                </div>
              ) : null}

              {!creatingTask && !editingTask ? (
                <>
                  {taskOrderStatus ? <div className={styles.hint}>{taskOrderStatus}</div> : null}
                  {taskOrder.length ? (
                    <div className={styles.taskList}>
                      <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={(event) => {
                          const { active, over } = event;
                          if (!over || active.id === over.id) return;
                          const previousOrder = taskOrder;
                          const oldIndex = taskOrder.findIndex((task) => task.id === active.id);
                          const newIndex = taskOrder.findIndex((task) => task.id === over.id);
                          if (oldIndex < 0 || newIndex < 0) return;
                          const nextOrder = arrayMove(taskOrder, oldIndex, newIndex).map(
                            (task, index) => ({
                              ...task,
                              sortOrder: index + 1,
                            }),
                          );
                          setTaskOrder(nextOrder);
                          persistTaskOrder(nextOrder, previousOrder);
                        }}
                      >
                        <SortableContext
                          items={taskOrder.map((task) => task.id)}
                          strategy={verticalListSortingStrategy}
                        >
                          {taskOrder.map((task, index) => (
                            <SortableTaskCard
                              key={task.id}
                              task={task}
                              index={index}
                              onEdit={handleTaskEdit}
                              onDelete={handleTaskDelete}
                            />
                          ))}
                        </SortableContext>
                      </DndContext>
                    </div>
                  ) : (
                    <div className={styles.previewStub}>Задач пока нет.</div>
                  )}
                </>
              ) : null}

              {editingTask || creatingTask ? (
                <TaskForm
                  title={
                    editingTaskNumber
                      ? `Задача №${editingTaskNumber}`
                      : `Задача №${nextTaskOrder}`
                  }
                  submitLabel={editingTask ? "Сохранить" : "Создать"}
                  onSubmit={editingTask ? handleTaskUpdate : handleTaskSubmit}
                  error={formError}
                  onCancel={() => {
                    setEditingTask(null);
                    setCreatingTask(false);
                    setCreatingTaskPublish(false);
                    setFormError(null);
                  }}
                  rightAction={
                    editingTask ? (
                      <Checkbox
                        label="Опубликовано"
                        checked={editingTask.status === "published"}
                        onChange={(event) => {
                          const nextChecked = event.target.checked;
                          const isPublished = editingTask.status === "published";
                          if (nextChecked === isPublished) return;
                          handleTaskPublishToggle(editingTask);
                        }}
                      />
                    ) : creatingTask ? (
                      <Checkbox
                        label="Опубликовать"
                        checked={creatingTaskPublish}
                        onChange={(event) => setCreatingTaskPublish(event.target.checked)}
                      />
                    ) : null
                  }
                  initial={
                    taskFormInitial
                  }
                />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
