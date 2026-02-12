"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ComponentProps } from "react";
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
import LiteTex from "@/components/LiteTex";
type CodeMirrorProps = ComponentProps<typeof import("@uiw/react-codemirror").default>;

const CodeMirror = dynamic<CodeMirrorProps>(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => <div className={styles.editorLoading}>Загрузка редактора…</div>,
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

const AUTOSAVE_DEBOUNCE_MS = 1000;

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

const sortTasks = (tasks: Task[]) =>
  [...tasks].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });

const buildSortMap = (tasks: Task[]) => new Map(tasks.map((task) => [task.id, task.sortOrder ?? 0]));

const toProgressErrorMessage = (error: unknown) => {
  const rawMessage = getApiErrorMessage(error);
  if (rawMessage === "InvalidMinCountedTasksToComplete") {
    return "Введите целое число 0 или больше.";
  }
  if (rawMessage === "MinCountedTasksLessThanRequiredCount") {
    return "Порог не может быть меньше количества обязательных задач.";
  }
  return rawMessage;
};

type SortableTaskCardProps = {
  task: Task;
  index: number;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
};

function SortableTaskCard({ task, index, onEdit, onDelete }: SortableTaskCardProps) {
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
}

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
  const [taskOrder, setTaskOrder] = useState<Task[]>([]);
  const [taskOrderStatus, setTaskOrderStatus] = useState<string | null>(null);

  const snapshotRef = useRef<ReturnType<typeof buildSnapshot> | null>(null);
  const timerRef = useRef<number | null>(null);
  const inflightRef = useRef(0);

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

  const fetchUnit = useCallback(async () => {
    setError(null);
    try {
      const data = await teacherApi.getUnit(unitId);
      setUnit(data);

      const nextTheory = data.theoryRichLatex ?? "";
      const nextMethod = data.methodRichLatex ?? "";
      const nextVideos = data.videosJson ?? [];

      setTheoryText(nextTheory);
      setMethodText(nextMethod);
      setVideos(nextVideos);
      snapshotRef.current = buildSnapshot(nextTheory, nextMethod, nextVideos);
      setSaveState({ state: "idle" });
      setTaskOrder(sortTasks(data.tasks));
      setTaskOrderStatus(null);
      setMinCountedInput(String(data.minCountedTasksToComplete ?? 0));
      setProgressSaveState({ state: "idle" });
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, [unitId]);

  useEffect(() => {
    fetchUnit();
  }, [fetchUnit]);

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

        setUnit((prev) => (prev ? { ...prev, ...updated } : prev));
        const mergedTheory = updated.theoryRichLatex ?? theoryText;
        const mergedMethod = updated.methodRichLatex ?? methodText;
        const mergedVideos = updated.videosJson ?? videos;
        snapshotRef.current = buildSnapshot(mergedTheory, mergedMethod, mergedVideos);
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

  const handleTaskDelete = async (task: Task) => {
    const confirmed = window.confirm("Удалить задачу? Действие нельзя отменить.");
    if (!confirmed) return;
    setError(null);
    try {
      await teacherApi.deleteTask(task.id);
      await fetchUnit();
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

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
      : progressSaveState.state === "saved"
        ? "Сохранено"
        : progressSaveState.state === "error"
          ? progressSaveState.message
          : "";

  const handleProgressSave = async () => {
    if (!unit) return;
    const normalized = minCountedInput.trim();
    const parsed = Number(normalized);
    if (!normalized || !Number.isInteger(parsed) || parsed < 0) {
      setProgressSaveState({ state: "error", message: "Введите целое число 0 или больше." });
      return;
    }

    setProgressSaveState({ state: "saving" });
    try {
      const updated = await teacherApi.updateUnit(unit.id, {
        minCountedTasksToComplete: parsed,
      });
      setUnit((prev) => (prev ? { ...prev, ...updated } : prev));
      setMinCountedInput(String(updated.minCountedTasksToComplete ?? parsed));
      setProgressSaveState({ state: "saved", at: Date.now() });
    } catch (err) {
      setProgressSaveState({ state: "error", message: toProgressErrorMessage(err) });
    }
  };

  const activePanelId = `${tabsId}-${activeTab}-panel`;
  const activeTabId = `${tabsId}-${activeTab}`;

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
            <div className={styles.editorGrid}>
              <div className={styles.editorPanel}>
                <div className={styles.kicker}>Теория</div>
                <CodeMirror value={theoryText} height="420px" onChange={setTheoryText} />
              </div>
              <div className={styles.previewPanel}>
                <div className={styles.kicker}>Предпросмотр</div>
                <div className={styles.previewStub}>Предпросмотр PDF появится здесь после сборки.</div>
              </div>
            </div>
          ) : activeTab === "method" ? (
            <div className={styles.editorGrid}>
              <div className={styles.editorPanel}>
                <div className={styles.kicker}>Методика</div>
                <CodeMirror value={methodText} height="420px" onChange={setMethodText} />
              </div>
              <div className={styles.previewPanel}>
                <div className={styles.kicker}>Предпросмотр</div>
                <div className={styles.previewStub}>Предпросмотр PDF появится здесь после сборки.</div>
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
                    <div className={styles.kicker}>Выполнение юнита</div>
                    <div className={styles.progressTitle}>
                      Минимум учтённых задач для выполнения
                    </div>
                  </div>
                  <div className={styles.requiredCount}>Обязательных задач: {requiredTasksCount}</div>
                </div>
                <div className={styles.progressControls}>
                  <label className={styles.label}>
                    Минимум учтённых задач для выполнения
                    <Input
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
                    />
                  </label>
                  <Button onClick={handleProgressSave} disabled={progressSaveState.state === "saving"}>
                    Сохранить
                  </Button>
                </div>
                <div className={styles.progressHint}>
                  Обязательные задачи — жёсткий гейт и входят в учтённые.
                </div>
                {progressStatusText ? (
                  <div className={styles.progressStatus} role="status" aria-live="polite">
                    {progressStatusText}
                  </div>
                ) : null}
              </div>

              {!creatingTask && !editingTask ? (
                <div className={styles.tasksHeader}>
                  <div>
                    <div className={styles.kicker}>Задачи</div>
                    <div className={styles.hint}>Создавайте задачи для этого юнита.</div>
                  </div>
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
                              onEdit={(selected) => {
                                setEditingTask(selected);
                                setCreatingTask(false);
                              }}
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
