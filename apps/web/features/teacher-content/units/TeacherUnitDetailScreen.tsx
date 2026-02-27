"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import AlertDialog from "@/components/ui/AlertDialog";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Switch from "@/components/ui/Switch";
import Tabs from "@/components/ui/Tabs";
import type { Task } from "@/lib/api/teacher";
import { teacherApi } from "@/lib/api/teacher";
import { getApiErrorMessage } from "../shared/api-errors";
import { useTeacherLogout } from "../auth/use-teacher-logout";
import { useTeacherIdentity } from "../shared/use-teacher-identity";
import type { TaskFormData } from "../tasks/TaskForm";
import { ArrowLeft, Trash2 } from "lucide-react";
import { EditorView } from "@codemirror/view";
import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import styles from "./teacher-unit-detail.module.css";
import { useTeacherUnitLatexCompile } from "./hooks/use-teacher-unit-latex-compile";
import { useTeacherTaskStatementImage } from "./hooks/use-teacher-task-statement-image";
import { useTeacherUnitFetchSave } from "./hooks/use-teacher-unit-fetch-save";
import { TeacherUnitLatexPanel } from "./components/TeacherUnitLatexPanel";
import { TeacherCompileErrorDialog } from "./components/TeacherCompileErrorDialog";
import { TeacherTaskStatementImageSection } from "./components/TeacherTaskStatementImageSection";
import { TeacherTaskSolutionSection } from "./components/TeacherTaskSolutionSection";
import { TeacherUnitTasksPanel } from "./components/TeacherUnitTasksPanel";

type Props = {
  unitId: string;
};

type TabKey = "theory" | "method" | "tasks" | "video" | "attachments";

type DeleteConfirmState =
  | { kind: "task"; task: Task }
  | { kind: "unit"; unitId: string; unitTitle: string; sectionId: string | null }
  | null;

const buildSortMap = (tasks: Task[]) => new Map(tasks.map((task) => [task.id, task.sortOrder ?? 0]));

const buildTaskPayload = (data: TaskFormData) => {
  const base = {
    statementLite: data.statementLite,
    answerType: data.answerType,
    isRequired: data.isRequired,
    sortOrder: data.sortOrder,
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
  isRequired: task.isRequired,
  sortOrder: task.sortOrder,
});

export default function TeacherUnitDetailScreen({ unitId }: Props) {
  const tabsId = useId();
  const router = useRouter();
  const handleLogout = useTeacherLogout();
  const identity = useTeacherIdentity();

  const {
    unit,
    setUnit,
    courseTitle,
    sectionTitle,
    error,
    setError,
    theoryText,
    setTheoryText,
    methodText,
    setMethodText,
    videos,
    setVideos,
    taskOrder,
    setTaskOrder,
    saveState,
    progressSaveState,
    setProgressSaveState,
    minCountedInput,
    setMinCountedInput,
    isOptionalMinEditing,
    setIsOptionalMinEditing,
    fetchUnit,
    handleProgressSave,
  } = useTeacherUnitFetchSave({ unitId });

  const [activeTab, setActiveTab] = useState<TabKey>("theory");
  const [creatingTask, setCreatingTask] = useState(false);
  const [creatingTaskPublish, setCreatingTaskPublish] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isDeletingUnit, setIsDeletingUnit] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [taskOrderStatus, setTaskOrderStatus] = useState<string | null>(null);
  const [deleteConfirmState, setDeleteConfirmState] = useState<DeleteConfirmState>(null);

  const optionalMinInputRef = useRef<HTMLInputElement | null>(null);
  const editorGridRef = useRef<HTMLDivElement | null>(null);
  const [previewWidthPercent, setPreviewWidthPercent] = useState(38);
  const [isResizingLayout, setIsResizingLayout] = useState(false);

  useEffect(() => {
    setEditingTask((prev) => {
      if (!prev) return prev;
      return taskOrder.find((task) => task.id === prev.id) ?? null;
    });
  }, [taskOrder]);

  const compile = useTeacherUnitLatexCompile({
    unit,
    setUnit,
    theoryText,
    methodText,
    editingTask,
    fetchUnit,
  });

  const statementImage = useTeacherTaskStatementImage({
    editingTask,
    fetchUnit,
  });

  const navItems = useMemo(
    () => [
      { label: "Курсы", href: "/teacher", active: true },
      { label: "Ученики", href: "/teacher/students" },
      { label: "Проверка фото", href: "/teacher/review" },
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

  const latexExtensions = useMemo(
    () => [StreamLanguage.define(stex), EditorView.lineWrapping],
    [],
  );

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
      setTaskOrder((prev) => prev.map((item) => (item.id === task.id ? { ...item, status: nextStatus } : item)));
      setEditingTask((prev) => (prev && prev.id === task.id ? { ...prev, status: nextStatus } : prev));
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
  }, [setError, setUnit, unit]);

  const handleTaskDelete = useCallback(async (task: Task) => {
    setDeleteConfirmState({ kind: "task", task });
  }, []);

  const handleUnitDelete = useCallback(async () => {
    if (!unit || isDeletingUnit) return;
    setDeleteConfirmState({
      kind: "unit",
      unitId: unit.id,
      unitTitle: unit.title,
      sectionId: unit.sectionId ?? null,
    });
  }, [isDeletingUnit, unit]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirmState) return;
    if (deleteConfirmState.kind === "task") {
      setError(null);
      try {
        await teacherApi.deleteTask(deleteConfirmState.task.id);
        await fetchUnit();
      } catch (err) {
        setError(getApiErrorMessage(err));
      } finally {
        setDeleteConfirmState(null);
      }
      return;
    }

    setError(null);
    setIsDeletingUnit(true);
    try {
      await teacherApi.deleteUnit(deleteConfirmState.unitId);
      if (deleteConfirmState.sectionId) {
        router.push(`/teacher/sections/${deleteConfirmState.sectionId}`);
      } else {
        router.push("/teacher");
      }
    } catch (err) {
      setError(getApiErrorMessage(err));
      setDeleteConfirmState(null);
    } finally {
      setIsDeletingUnit(false);
    }
  }, [deleteConfirmState, fetchUnit, router, setError]);

  const handleBackToSection = useCallback(() => {
    if (unit?.sectionId) {
      router.push(`/teacher/sections/${unit.sectionId}`);
      return;
    }
    router.back();
  }, [router, unit?.sectionId]);

  const handleBackToCourses = useCallback(() => {
    router.push("/teacher");
  }, [router]);

  const handleTaskEdit = useCallback((selected: Task) => {
    setEditingTask(selected);
    setCreatingTask(false);
  }, []);

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
    (value: number) => Math.min(maxPreviewWidthPercent, Math.max(minPreviewWidthPercent, Math.round(value))),
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
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      setIsResizingLayout(true);
      updateLayoutRatioFromPointer(event.clientX);
    },
    [updateLayoutRatioFromPointer],
  );

  const handleSplitterKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
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

  return (
    <DashboardShell
      title={identity.displayName || "Преподаватель"}
      navItems={navItems}
      appearance="glass"
      onLogout={handleLogout}
      settingsHref="/teacher/settings"
    >
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <nav className={styles.breadcrumbs} aria-label="Навигация">
              <button
                type="button"
                className={styles.breadcrumbIconButton}
                onClick={handleBackToSection}
                aria-label="Назад к разделу"
              >
                <ArrowLeft size={18} />
              </button>
              <button type="button" className={styles.breadcrumbLink} onClick={handleBackToCourses}>
                Курсы
              </button>
              <span className={styles.breadcrumbDivider}>/</span>
              <button type="button" className={styles.breadcrumbLink} onClick={handleBackToSection}>
                {courseTitle ?? sectionTitle ?? "Раздел"}
              </button>
              <span className={styles.breadcrumbDivider}>/</span>
              <span className={styles.breadcrumbCurrent} aria-current="page">
                {unit?.title ?? "Юнит"}
              </span>
            </nav>
            <div className={styles.headerActions}>
              {unit ? (
                <Switch
                  className={styles.publishToggle}
                  checked={unit.status === "published"}
                  onCheckedChange={() => void handleUnitPublishToggle()}
                  label="Опубликовано"
                />
              ) : null}
              {unit ? (
                <Button
                  variant="ghost"
                  onClick={handleUnitDelete}
                  disabled={isDeletingUnit}
                  className={styles.deleteUnitButton}
                >
                  <Trash2 size={18} />
                  {isDeletingUnit ? "Удаление..." : "Удалить юнит"}
                </Button>
              ) : null}
              {saveStatusText ? (
                <div className={styles.saveStatus} role="status" aria-live="polite">
                  {saveStatusText}
                </div>
              ) : null}
            </div>
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
            className={styles.unitTabs}
          />
        </div>

        <div id={activePanelId} role="tabpanel" aria-labelledby={activeTabId}>
          {activeTab === "theory" ? (
            <TeacherUnitLatexPanel
              title="Теория"
              value={theoryText}
              onChange={setTheoryText}
              editorExtensions={latexExtensions}
              editorGridRef={editorGridRef}
              editorGridStyle={editorGridStyle}
              isResizingLayout={isResizingLayout}
              minPreviewWidthPercent={minPreviewWidthPercent}
              maxPreviewWidthPercent={maxPreviewWidthPercent}
              previewWidthPercent={previewWidthPercent}
              onSplitterPointerDown={handleSplitterPointerDown}
              onSplitterKeyDown={handleSplitterKeyDown}
              compileState={compile.compileState.theory}
              onCompile={() => void compile.runCompile("theory")}
              showOpenLogAction={
                compile.compileState.theory.error === "Компиляция не удалась. Откройте лог." &&
                compile.compileErrorModalState?.target === "theory"
              }
              onOpenCompileLog={() => compile.reopenCompileErrorModal("theory")}
              previewUrl={compile.previewUrls.theory}
              refreshKey={compile.compileState.theory.key ?? unit?.theoryPdfAssetKey ?? undefined}
              getFreshUrl={compile.refreshTheoryPreviewUrl}
            />
          ) : activeTab === "method" ? (
            <TeacherUnitLatexPanel
              title="Методика"
              value={methodText}
              onChange={setMethodText}
              editorExtensions={latexExtensions}
              editorGridRef={editorGridRef}
              editorGridStyle={editorGridStyle}
              isResizingLayout={isResizingLayout}
              minPreviewWidthPercent={minPreviewWidthPercent}
              maxPreviewWidthPercent={maxPreviewWidthPercent}
              previewWidthPercent={previewWidthPercent}
              onSplitterPointerDown={handleSplitterPointerDown}
              onSplitterKeyDown={handleSplitterKeyDown}
              compileState={compile.compileState.method}
              onCompile={() => void compile.runCompile("method")}
              showOpenLogAction={
                compile.compileState.method.error === "Компиляция не удалась. Откройте лог." &&
                compile.compileErrorModalState?.target === "method"
              }
              onOpenCompileLog={() => compile.reopenCompileErrorModal("method")}
              previewUrl={compile.previewUrls.method}
              refreshKey={compile.compileState.method.key ?? unit?.methodPdfAssetKey ?? undefined}
              getFreshUrl={compile.refreshMethodPreviewUrl}
            />
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
            <TeacherUnitTasksPanel
              requiredTasksCount={requiredTasksCount}
              hasSavedOptionalMin={hasSavedOptionalMin}
              isOptionalMinEditing={isOptionalMinEditing}
              optionalMinInputRef={optionalMinInputRef}
              minCountedInput={minCountedInput}
              onMinCountedInputChange={(value) => {
                setMinCountedInput(value);
                if (progressSaveState.state !== "idle") {
                  setProgressSaveState({ state: "idle" });
                }
              }}
              savedOptionalMin={savedOptionalMin ?? 0}
              totalToComplete={totalToComplete}
              progressSaveState={progressSaveState}
              progressStatusText={progressStatusText}
              onStartOptionalEdit={() => {
                setMinCountedInput(String(savedOptionalMin ?? 0));
                setIsOptionalMinEditing(true);
                if (progressSaveState.state !== "idle") {
                  setProgressSaveState({ state: "idle" });
                }
              }}
              onFinishOptionalEdit={() => {
                setIsOptionalMinEditing(false);
              }}
              onCancelOptionalEdit={() => {
                setMinCountedInput(String(savedOptionalMin ?? 0));
                setIsOptionalMinEditing(false);
              }}
              onSaveOptionalMin={handleProgressSave}
              creatingTask={creatingTask}
              editingTask={editingTask}
              creatingTaskPublish={creatingTaskPublish}
              onCreatingTaskPublishChange={setCreatingTaskPublish}
              onStartCreateTask={() => {
                setCreatingTask(true);
                setEditingTask(null);
                setCreatingTaskPublish(false);
                setFormError(null);
              }}
              onCancelTaskForm={() => {
                setEditingTask(null);
                setCreatingTask(false);
                setCreatingTaskPublish(false);
                setFormError(null);
              }}
              formError={formError}
              taskOrderStatus={taskOrderStatus}
              taskOrder={taskOrder}
              onReorderTasks={(nextOrder, previousOrder) => {
                setTaskOrder(nextOrder);
                void persistTaskOrder(nextOrder, previousOrder);
              }}
              onTaskEdit={handleTaskEdit}
              onTaskDelete={handleTaskDelete}
              editingTaskNumber={editingTaskNumber}
              nextTaskOrder={nextTaskOrder}
              taskFormInitial={taskFormInitial}
              onTaskSubmit={handleTaskSubmit}
              onTaskUpdate={handleTaskUpdate}
              onTaskPublishToggle={handleTaskPublishToggle}
              afterStatementSection={
                <TeacherTaskStatementImageSection
                  editingTask={editingTask}
                  inputRef={statementImage.taskStatementImageInputRef}
                  state={statementImage.taskStatementImageState}
                  statusText={statementImage.taskStatementImageStatusText}
                  onSelect={statementImage.handleTaskStatementImageSelected}
                  onRemove={statementImage.handleTaskStatementImageRemove}
                  onPreviewError={statementImage.handleTaskStatementImagePreviewError}
                />
              }
              extraSection={
                <TeacherTaskSolutionSection
                  editingTask={editingTask}
                  solutionLatex={compile.taskSolutionLatex}
                  onSolutionLatexChange={compile.setTaskSolutionLatex}
                  compileState={compile.taskSolutionCompileState}
                  onCompile={compile.runTaskSolutionCompile}
                  showOpenLogAction={
                    compile.taskSolutionCompileState.error === "Компиляция не удалась. Откройте лог." &&
                    compile.compileErrorModalState?.target === "task_solution"
                  }
                  onOpenCompileLog={() => compile.reopenCompileErrorModal("task_solution")}
                  getFreshPreviewUrl={compile.refreshTaskSolutionPreviewUrl}
                />
              }
            />
          )}
        </div>
      </div>

      <TeacherCompileErrorDialog
        state={compile.compileErrorModalState}
        open={compile.isCompileErrorModalOpen}
        onOpenChange={compile.setIsCompileErrorModalOpen}
        onCopy={compile.copyCompileErrorLog}
        onClose={compile.closeCompileErrorModal}
        copyState={compile.compileErrorCopyState}
        logHint={compile.compileErrorLogHint}
      />

      <AlertDialog
        open={Boolean(deleteConfirmState)}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmState(null);
        }}
        title={
          deleteConfirmState?.kind === "task"
            ? "Удалить задачу? Действие нельзя отменить."
            : deleteConfirmState?.kind === "unit"
              ? `Удалить юнит «${deleteConfirmState.unitTitle}»?`
              : ""
        }
        description={
          deleteConfirmState?.kind === "task"
            ? "Задача будет удалена без возможности восстановления."
            : deleteConfirmState?.kind === "unit"
              ? "Будут удалены все задачи внутри юнита. Действие нельзя отменить."
              : ""
        }
        confirmText={deleteConfirmState?.kind === "unit" ? "Удалить юнит" : "Удалить задачу"}
        cancelText="Отмена"
        destructive
        confirmDisabled={isDeletingUnit}
        onConfirm={() => void handleConfirmDelete()}
      />
    </DashboardShell>
  );
}
