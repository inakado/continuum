import { useCallback, useEffect, useRef, useState } from "react";
import { studentApi, type Task } from "@/lib/api/student";
import { ApiError } from "@/lib/api/client";
import { getStudentErrorMessage } from "../../shared/student-errors";

type Params = {
  activeTask: Task | null;
};

export const useStudentTaskMediaPreview = ({ activeTask }: Params) => {
  const statementImageRetryRef = useRef<Record<string, boolean>>({});
  const [showSolutionByTask, setShowSolutionByTask] = useState<Record<string, boolean>>({});
  const [taskSolutionPdfUrlByTask, setTaskSolutionPdfUrlByTask] = useState<Record<string, string | null>>({});
  const [taskSolutionLoadingByTask, setTaskSolutionLoadingByTask] = useState<Record<string, boolean>>({});
  const [taskSolutionErrorByTask, setTaskSolutionErrorByTask] = useState<Record<string, string | null>>({});
  const [taskSolutionErrorCodeByTask, setTaskSolutionErrorCodeByTask] = useState<Record<string, string | null>>({});
  const [statementImageUrlByTask, setStatementImageUrlByTask] = useState<Record<string, string | null>>({});
  const [statementImageLoadingByTask, setStatementImageLoadingByTask] = useState<Record<string, boolean>>({});
  const [statementImageErrorByTask, setStatementImageErrorByTask] = useState<Record<string, string | null>>({});

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

  const loadStatementImage = useCallback(async (taskId: string) => {
    setStatementImageLoadingByTask((prev) => ({ ...prev, [taskId]: true }));
    setStatementImageErrorByTask((prev) => ({ ...prev, [taskId]: null }));

    try {
      const response = await studentApi.getTaskStatementImagePresignForStudent(taskId, 180);
      statementImageRetryRef.current[taskId] = false;
      setStatementImageUrlByTask((prev) => ({ ...prev, [taskId]: response.url }));
      return response.url;
    } catch (err) {
      if (err instanceof ApiError && err.code === "STATEMENT_IMAGE_MISSING") {
        setStatementImageUrlByTask((prev) => ({ ...prev, [taskId]: null }));
        setStatementImageErrorByTask((prev) => ({ ...prev, [taskId]: null }));
        return null;
      }

      setStatementImageUrlByTask((prev) => ({ ...prev, [taskId]: null }));
      setStatementImageErrorByTask((prev) => ({ ...prev, [taskId]: getStudentErrorMessage(err) }));
      throw err;
    } finally {
      setStatementImageLoadingByTask((prev) => ({ ...prev, [taskId]: false }));
    }
  }, []);

  useEffect(() => {
    if (!activeTask || activeTask.answerType === "photo") return;
    const isVisible = Boolean(showSolutionByTask[activeTask.id]);
    if (!isVisible) return;
    if (taskSolutionPdfUrlByTask[activeTask.id] || taskSolutionLoadingByTask[activeTask.id]) return;

    void loadTaskSolutionPdf(activeTask.id).catch(() => {
      // сообщение уже выставлено в state
    });
  }, [activeTask, loadTaskSolutionPdf, showSolutionByTask, taskSolutionLoadingByTask, taskSolutionPdfUrlByTask]);

  useEffect(() => {
    if (!activeTask || !activeTask.hasStatementImage) return;
    if (statementImageUrlByTask[activeTask.id] || statementImageLoadingByTask[activeTask.id]) return;

    void loadStatementImage(activeTask.id).catch(() => {
      // сообщение уже выставлено в state
    });
  }, [activeTask, loadStatementImage, statementImageLoadingByTask, statementImageUrlByTask]);

  const refreshTaskSolutionPreviewUrl = useCallback(async () => {
    if (!activeTask || activeTask.answerType === "photo") return null;
    try {
      return await loadTaskSolutionPdf(activeTask.id);
    } catch {
      return null;
    }
  }, [activeTask, loadTaskSolutionPdf]);

  const refreshTaskStatementImageUrl = useCallback(async () => {
    if (!activeTask || !activeTask.hasStatementImage) return null;
    try {
      return await loadStatementImage(activeTask.id);
    } catch {
      return null;
    }
  }, [activeTask, loadStatementImage]);

  const handleStatementImageLoadError = useCallback(() => {
    if (!activeTask || !activeTask.hasStatementImage) return;
    const taskId = activeTask.id;

    if (statementImageRetryRef.current[taskId]) {
      setStatementImageErrorByTask((prev) => ({
        ...prev,
        [taskId]: "Не удалось обновить изображение условия.",
      }));
      return;
    }

    statementImageRetryRef.current[taskId] = true;
    void refreshTaskStatementImageUrl().catch(() => {
      // ошибка выставляется в state
    });
  }, [activeTask, refreshTaskStatementImageUrl]);

  const toggleSolutionVisibility = useCallback(async () => {
    if (!activeTask) return;

    const taskId = activeTask.id;
    const isVisible = Boolean(showSolutionByTask[taskId]);

    if (isVisible) {
      setShowSolutionByTask((prev) => ({ ...prev, [taskId]: false }));
      return;
    }

    setShowSolutionByTask((prev) => ({ ...prev, [taskId]: true }));
    if (!taskSolutionPdfUrlByTask[taskId]) {
      try {
        await loadTaskSolutionPdf(taskId);
      } catch {
        // ошибка уже в taskSolutionErrorByTask
      }
    }
  }, [activeTask, loadTaskSolutionPdf, showSolutionByTask, taskSolutionPdfUrlByTask]);

  const activeTaskId = activeTask?.id ?? null;

  return {
    toggleSolutionVisibility,
    handleStatementImageLoadError,
    refreshTaskSolutionPreviewUrl,
    isSolutionVisible: activeTaskId ? Boolean(showSolutionByTask[activeTaskId]) : false,
    activeTaskSolutionPdfUrl: activeTaskId ? (taskSolutionPdfUrlByTask[activeTaskId] ?? null) : null,
    activeTaskSolutionLoading: activeTaskId ? Boolean(taskSolutionLoadingByTask[activeTaskId]) : false,
    activeTaskSolutionError: activeTaskId ? (taskSolutionErrorByTask[activeTaskId] ?? null) : null,
    activeTaskSolutionErrorCode: activeTaskId ? (taskSolutionErrorCodeByTask[activeTaskId] ?? null) : null,
    activeTaskStatementImageUrl: activeTaskId ? (statementImageUrlByTask[activeTaskId] ?? null) : null,
    activeTaskStatementImageLoading: activeTaskId ? Boolean(statementImageLoadingByTask[activeTaskId]) : false,
    activeTaskStatementImageError: activeTaskId ? (statementImageErrorByTask[activeTaskId] ?? null) : null,
  };
};
