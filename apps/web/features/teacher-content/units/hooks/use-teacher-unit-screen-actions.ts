import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useMutation } from "@tanstack/react-query";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { teacherApi, type Task, type UnitWithTasks } from "@/lib/api/teacher";
import { getApiErrorMessage } from "../../shared/api-errors";
import type { TaskFormData } from "../../tasks/TaskForm";

export type DeleteConfirmState =
  | { kind: "task"; task: Task }
  | { kind: "unit"; unitId: string; unitTitle: string; sectionId: string | null }
  | null;

const buildSortMap = (tasks: Task[]) => new Map(tasks.map((task) => [task.id, task.sortOrder ?? 0]));
const findTaskInUnit = (unit: UnitWithTasks | null, taskId: string) =>
  unit?.tasks.find((task) => task.id === taskId) ?? null;

const buildTaskPayload = (data: TaskFormData) => {
  const base = {
    statementLite: data.statementLite,
    methodGuidance: data.methodGuidance,
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
  methodGuidance: task.methodGuidance ?? "",
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

const getSaveStatusText = (
  saveState:
    | { state: "idle" }
    | { state: "saving" }
    | { state: "saved"; at: number }
    | { state: "error"; message: string },
) =>
  saveState.state === "saving"
    ? "Сохранение…"
    : saveState.state === "saved"
      ? "Сохранено"
      : saveState.state === "error"
        ? `Ошибка: ${saveState.message}`
        : "";

const getProgressStatusText = (
  progressSaveState:
    | { state: "idle" }
    | { state: "saving" }
    | { state: "saved"; at: number }
    | { state: "error"; message: string },
) =>
  progressSaveState.state === "saving"
    ? "Сохранение…"
    : progressSaveState.state === "error"
      ? progressSaveState.message
      : "";

type Params = {
  unit: UnitWithTasks | null;
  setUnit: Dispatch<SetStateAction<UnitWithTasks | null>>;
  taskOrder: Task[];
  setTaskOrder: Dispatch<SetStateAction<Task[]>>;
  fetchUnit: () => Promise<UnitWithTasks | null>;
  setError: Dispatch<SetStateAction<string | null>>;
  saveState:
    | { state: "idle" }
    | { state: "saving" }
    | { state: "saved"; at: number }
    | { state: "error"; message: string };
  progressSaveState:
    | { state: "idle" }
    | { state: "saving" }
    | { state: "saved"; at: number }
    | { state: "error"; message: string };
  minCountedInput: string;
  setMinCountedInput: Dispatch<SetStateAction<string>>;
  isOptionalMinEditing: boolean;
  setIsOptionalMinEditing: Dispatch<SetStateAction<boolean>>;
  handleProgressSave: () => Promise<boolean>;
  setProgressSaveState: Dispatch<
    SetStateAction<
      | { state: "idle" }
      | { state: "saving" }
      | { state: "saved"; at: number }
      | { state: "error"; message: string }
    >
  >;
  router: AppRouterInstance;
};

export const useTeacherUnitScreenActions = ({
  unit,
  setUnit,
  taskOrder,
  setTaskOrder,
  fetchUnit,
  setError,
  saveState,
  progressSaveState,
  minCountedInput,
  setMinCountedInput,
  isOptionalMinEditing,
  setIsOptionalMinEditing,
  handleProgressSave,
  setProgressSaveState,
  router,
}: Params) => {
  const [creatingTask, setCreatingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isDeletingUnit, setIsDeletingUnit] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [taskOrderStatus, setTaskOrderStatus] = useState<string | null>(null);
  const [deleteConfirmState, setDeleteConfirmState] = useState<DeleteConfirmState>(null);

  useEffect(() => {
    setEditingTask((prev) => {
      if (!prev) return prev;
      return taskOrder.find((task) => task.id === prev.id) ?? null;
    });
  }, [taskOrder]);

  const createTaskMutation = useMutation({
    mutationFn: (data: Parameters<typeof teacherApi.createTask>[0]) => teacherApi.createTask(data),
  });
  const publishTaskMutation = useMutation({
    mutationFn: ({ taskId, publish }: { taskId: string; publish: boolean }) =>
      publish ? teacherApi.publishTask(taskId) : teacherApi.unpublishTask(taskId),
  });
  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: Parameters<typeof teacherApi.updateTask>[1] }) =>
      teacherApi.updateTask(taskId, data),
  });
  const updateTaskOrderMutation = useMutation({
    mutationFn: ({ taskId, sortOrder }: { taskId: string; sortOrder: number }) =>
      teacherApi.updateTask(taskId, { sortOrder }),
  });
  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: string) => teacherApi.deleteTask(taskId),
  });
  const publishUnitMutation = useMutation({
    mutationFn: (payload: { unitId: string; publish: boolean }) =>
      payload.publish ? teacherApi.publishUnit(payload.unitId) : teacherApi.unpublishUnit(payload.unitId),
  });
  const deleteUnitMutation = useMutation({
    mutationFn: (unitId: string) => teacherApi.deleteUnit(unitId),
  });

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
  }, [editingTask, nextTaskOrder]);

  const handleTaskSubmit = useCallback(
    async (data: TaskFormData) => {
      if (!unit) return;
      setFormError(null);
      try {
        const createdTask = await createTaskMutation.mutateAsync({ unitId: unit.id, ...buildTaskPayload(data) });
        const refreshedUnit = await fetchUnit();
        setEditingTask(findTaskInUnit(refreshedUnit, createdTask.id) ?? createdTask);
        setCreatingTask(false);
        return true;
      } catch (err) {
        setFormError(getApiErrorMessage(err));
        return false;
      }
    },
    [createTaskMutation, fetchUnit, unit],
  );

  const handleTaskUpdate = useCallback(
    async (data: TaskFormData) => {
      if (!editingTask) return;
      setFormError(null);
      try {
        await updateTaskMutation.mutateAsync({ taskId: editingTask.id, data: buildTaskPayload(data) });
        setEditingTask(null);
        await fetchUnit();
        return true;
      } catch (err) {
        setFormError(getApiErrorMessage(err));
        return false;
      }
    },
    [editingTask, fetchUnit, updateTaskMutation],
  );

  const handleTaskPublishToggle = useCallback(
    async (task: Task) => {
      setError(null);
      try {
        const nextStatus = task.status === "published" ? "draft" : "published";
        await publishTaskMutation.mutateAsync({ taskId: task.id, publish: nextStatus === "published" });
        setTaskOrder((prev) => prev.map((item) => (item.id === task.id ? { ...item, status: nextStatus } : item)));
        setEditingTask((prev) => (prev && prev.id === task.id ? { ...prev, status: nextStatus } : prev));
        await fetchUnit();
      } catch (err) {
        setError(getApiErrorMessage(err));
      }
    },
    [fetchUnit, publishTaskMutation, setError, setTaskOrder],
  );

  const handleUnitPublishToggle = useCallback(async () => {
    if (!unit) return;
    setError(null);
    const publish = unit.status !== "published";
    try {
      await publishUnitMutation.mutateAsync({ unitId: unit.id, publish });
      setUnit((prev) => (prev ? { ...prev, status: publish ? "published" : "draft" } : prev));
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, [publishUnitMutation, setError, setUnit, unit]);

  const handleTaskDelete = useCallback((task: Task) => {
    setDeleteConfirmState({ kind: "task", task });
  }, []);

  const handleUnitDelete = useCallback(() => {
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
        await deleteTaskMutation.mutateAsync(deleteConfirmState.task.id);
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
      await deleteUnitMutation.mutateAsync(deleteConfirmState.unitId);
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
  }, [deleteConfirmState, deleteTaskMutation, deleteUnitMutation, fetchUnit, router, setError]);

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
          updates.map((update) =>
            updateTaskOrderMutation.mutateAsync({ taskId: update.id, sortOrder: update.sortOrder }),
          ),
        );
        setTaskOrderStatus("Порядок сохранён");
        await fetchUnit();
      } catch (err) {
        setTaskOrderStatus(getApiErrorMessage(err));
      }
    },
    [fetchUnit, updateTaskOrderMutation],
  );

  const savedOptionalMin = unit?.minOptionalCountedTasksToComplete;
  const hasSavedOptionalMin = typeof savedOptionalMin === "number" && Number.isInteger(savedOptionalMin);
  const optionalPreview = (() => {
    const parsed = Number(minCountedInput.trim());
    if (Number.isInteger(parsed) && parsed >= 0) return parsed;
    return hasSavedOptionalMin ? savedOptionalMin : 0;
  })();
  const totalToComplete = requiredTasksCount + optionalPreview;

  return {
    creatingTask,
    editingTask,
    isDeletingUnit,
    formError,
    taskOrderStatus,
    deleteConfirmState,
    setDeleteConfirmState,
    setEditingTask,
    handleTaskSubmit,
    handleTaskUpdate,
    handleTaskPublishToggle,
    handleUnitPublishToggle,
    handleTaskDelete,
    handleUnitDelete,
    handleConfirmDelete,
    handleBackToSection,
    handleBackToCourses,
    handleTaskEdit,
    persistTaskOrder,
    saveStatusText: getSaveStatusText(saveState),
    progressStatusText: getProgressStatusText(progressSaveState),
    savedOptionalMin,
    hasSavedOptionalMin,
    totalToComplete,
    requiredTasksCount,
    editingTaskNumber,
    nextTaskOrder,
    taskFormInitial,
    optionalMinEditing: {
      isOptionalMinEditing,
      onMinCountedInputChange: (value: string) => {
        setMinCountedInput(value);
        if (progressSaveState.state !== "idle") {
          setProgressSaveState({ state: "idle" });
        }
      },
      onStartOptionalEdit: () => {
        setMinCountedInput(String(savedOptionalMin ?? 0));
        setIsOptionalMinEditing(true);
        if (progressSaveState.state !== "idle") {
          setProgressSaveState({ state: "idle" });
        }
      },
      onFinishOptionalEdit: () => {
        setIsOptionalMinEditing(false);
      },
      onCancelOptionalEdit: () => {
        setMinCountedInput(String(savedOptionalMin ?? 0));
        setIsOptionalMinEditing(false);
      },
      onSaveOptionalMin: handleProgressSave,
    },
    taskFormFlow: {
      onStartCreateTask: () => {
        setCreatingTask(true);
        setEditingTask(null);
        setFormError(null);
      },
      onCancelTaskForm: () => {
        setEditingTask(null);
        setCreatingTask(false);
        setFormError(null);
      },
    },
  };
};
