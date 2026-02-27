import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  studentApi,
  type AttemptRequest,
  type Task,
  type TaskState,
} from "@/lib/api/student";
import { ApiError } from "@/lib/api/client";
import { learningPhotoQueryKeys } from "@/lib/query/keys";

const CREDITED_TASK_STATUSES = new Set<TaskState["status"]>([
  "correct",
  "accepted",
  "credited_without_progress",
  "teacher_credited",
]);

type Params = {
  activeTask: Task | null;
  unitId: string;
};

export const useStudentTaskAttempt = ({ activeTask, unitId }: Params) => {
  const queryClient = useQueryClient();
  const [numericAnswers, setNumericAnswers] = useState<Record<string, Record<string, string>>>({});
  const [singleAnswers, setSingleAnswers] = useState<Record<string, string>>({});
  const [multiAnswers, setMultiAnswers] = useState<Record<string, string[]>>({});
  const [attemptLoading, setAttemptLoading] = useState<Record<string, boolean>>({});
  const [attemptPerPart, setAttemptPerPart] = useState<Record<string, { partKey: string; correct: boolean }[] | null>>(
    {},
  );
  const [attemptFlash, setAttemptFlash] = useState<Record<string, "incorrect" | null>>({});
  const flashTimeoutsRef = useRef<Record<string, number>>({});
  const [isBlocked, setIsBlocked] = useState(false);

  const submitAttemptMutation = useMutation({
    mutationFn: ({ taskId, payload }: { taskId: string; payload: AttemptRequest }) =>
      studentApi.submitAttempt(taskId, payload),
  });

  const activeState = activeTask?.state ?? null;
  const blockedUntilIso = activeState?.blockedUntil ?? null;
  const blockedUntilMs = blockedUntilIso ? new Date(blockedUntilIso).getTime() : null;
  const wrongAttempts = activeState?.wrongAttempts ?? 0;
  const attemptsLeft = Math.max(0, 6 - wrongAttempts);
  const isTaskCredited = CREDITED_TASK_STATUSES.has((activeState?.status ?? "not_started") as TaskState["status"]);

  useEffect(() => {
    return () => {
      Object.values(flashTimeoutsRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
    };
  }, []);

  useEffect(() => {
    if (!activeTask || !isTaskCredited) return;

    if (activeTask.answerType === "numeric") {
      const next = (activeTask.numericPartsJson ?? []).reduce<Record<string, string>>((acc, part) => {
        if (part.correctValue !== undefined) acc[part.key] = part.correctValue;
        return acc;
      }, {});
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
  }, [activeTask?.id, blockedUntilMs]);

  const attemptPerPartResults = useMemo(() => {
    if (!activeTask) return null;
    return attemptPerPart[activeTask.id] ?? null;
  }, [activeTask, attemptPerPart]);

  const attemptPerPartByKey = useMemo(() => {
    if (!attemptPerPartResults) return null;
    return new Map(attemptPerPartResults.map((item) => [item.partKey, item.correct]));
  }, [attemptPerPartResults]);

  const activeTaskChoices = useMemo(() => {
    if (!activeTask?.choicesJson) return [];
    const items = [...activeTask.choicesJson];
    for (let i = items.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }, [activeTask?.id, activeTask?.choicesJson]);

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

  const showIncorrectBadge = activeTask
    ? (activeTask.answerType === "single_choice" || activeTask.answerType === "multi_choice") &&
      attemptFlash[activeTask.id] === "incorrect"
    : false;

  const showCorrectBadge = activeState?.status === "correct";

  const updateNumericValue = useCallback(
    (partKey: string, value: string) => {
      if (!activeTask) return;
      const taskId = activeTask.id;
      setNumericAnswers((prev) => ({
        ...prev,
        [taskId]: {
          ...(prev[taskId] ?? {}),
          [partKey]: value,
        },
      }));
    },
    [activeTask],
  );

  const updateSingleValue = useCallback(
    (choiceKey: string) => {
      if (!activeTask) return;
      setSingleAnswers((prev) => ({ ...prev, [activeTask.id]: choiceKey }));
    },
    [activeTask],
  );

  const toggleMultiValue = useCallback(
    (choiceKey: string) => {
      if (!activeTask) return;
      const taskId = activeTask.id;
      setMultiAnswers((prev) => {
        const current = new Set(prev[taskId] ?? []);
        if (current.has(choiceKey)) {
          current.delete(choiceKey);
        } else {
          current.add(choiceKey);
        }
        return { ...prev, [taskId]: Array.from(current) };
      });
    },
    [activeTask],
  );

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

      const response = await submitAttemptMutation.mutateAsync({ taskId, payload });
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

      await queryClient.invalidateQueries({
        queryKey: learningPhotoQueryKeys.studentUnit(unitId),
        exact: true,
      });
    } catch (error) {
      if (error instanceof ApiError) {
        console.warn("Attempt failed", error.status, error.message);
      } else {
        console.warn("Attempt failed");
      }
    } finally {
      setAttemptLoading((prev) => ({ ...prev, [taskId]: false }));
    }
  }, [activeTask, multiAnswers, numericAnswers, queryClient, singleAnswers, submitAttemptMutation, unitId]);

  return {
    blockedUntilIso,
    attemptsLeft,
    isBlocked,
    isTaskCredited,
    isAttemptDisabled,
    isAnswerReady,
    showIncorrectBadge,
    showCorrectBadge,
    attemptPerPartByKey,
    activeTaskChoices,
    activeNumericAnswers: activeTask ? (numericAnswers[activeTask.id] ?? {}) : {},
    activeSingleAnswer: activeTask ? (singleAnswers[activeTask.id] ?? "") : "",
    activeMultiAnswers: activeTask ? (multiAnswers[activeTask.id] ?? []) : [],
    updateNumericValue,
    updateSingleValue,
    toggleMultiValue,
    handleSubmitAttempt,
  };
};
