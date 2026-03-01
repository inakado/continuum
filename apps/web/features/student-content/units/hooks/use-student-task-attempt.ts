import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
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

type NumericAnswersState = Record<string, Record<string, string>>;
type SingleAnswersState = Record<string, string>;
type MultiAnswersState = Record<string, string[]>;
type AttemptPerPartState = Record<string, { partKey: string; correct: boolean }[] | null>;
type AttemptFlashState = Record<string, "incorrect" | null>;

const getBlockedUntilMs = (blockedUntilIso: string | null): number | null => {
  if (!blockedUntilIso) return null;
  const timestamp = new Date(blockedUntilIso).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
};

const buildCreditedNumericAnswers = (task: Task): Record<string, string> => {
  if (task.answerType !== "numeric") return {};
  return (task.numericPartsJson ?? []).reduce<Record<string, string>>((acc, part) => {
    if (part.correctValue !== undefined) acc[part.key] = part.correctValue;
    return acc;
  }, {});
};

const buildAttemptPayload = ({
  task,
  numericAnswers,
  singleAnswers,
  multiAnswers,
}: {
  task: Task;
  numericAnswers: NumericAnswersState;
  singleAnswers: SingleAnswersState;
  multiAnswers: MultiAnswersState;
}): AttemptRequest | null => {
  if (task.answerType === "numeric") {
    const values = numericAnswers[task.id] ?? {};
    return {
      answers: (task.numericPartsJson ?? []).map((part) => ({
        partKey: part.key,
        value: values[part.key] ?? "",
      })),
    };
  }

  if (task.answerType === "single_choice") {
    return { choiceKey: singleAnswers[task.id] };
  }

  if (task.answerType === "multi_choice") {
    return { choiceKeys: multiAnswers[task.id] ?? [] };
  }

  return null;
};

const shuffleChoices = (task: Task | null) => {
  if (!task?.choicesJson) return [];
  const items = [...task.choicesJson];
  for (let index = items.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(Math.random() * (index + 1));
    [items[index], items[nextIndex]] = [items[nextIndex], items[index]];
  }
  return items;
};

const getIsAttemptDisabled = ({
  task,
  taskState,
  attemptLoading,
  isBlocked,
}: {
  task: Task | null;
  taskState: TaskState | null;
  attemptLoading: Record<string, boolean>;
  isBlocked: boolean;
}) => {
  if (!task) return true;
  if (attemptLoading[task.id]) return true;
  if (task.answerType === "photo") return true;
  if (taskState?.status === "correct") return true;
  if (taskState?.status === "credited_without_progress") return true;
  if (taskState?.status === "teacher_credited") return true;
  if (isBlocked) return true;
  return false;
};

const getIsAnswerReady = ({
  task,
  numericAnswers,
  singleAnswers,
  multiAnswers,
}: {
  task: Task | null;
  numericAnswers: NumericAnswersState;
  singleAnswers: SingleAnswersState;
  multiAnswers: MultiAnswersState;
}) => {
  if (!task) return false;

  if (task.answerType === "numeric") {
    const parts = task.numericPartsJson ?? [];
    if (!parts.length) return false;
    const values = numericAnswers[task.id] ?? {};
    return parts.every((part) => (values[part.key] ?? "").trim().length > 0);
  }

  if (task.answerType === "single_choice") {
    return Boolean(singleAnswers[task.id]);
  }

  if (task.answerType === "multi_choice") {
    return (multiAnswers[task.id] ?? []).length > 0;
  }

  return false;
};

const reportAttemptFailure = (error: unknown) => {
  if (error instanceof ApiError) {
    console.warn("Attempt failed", error.status, error.message);
    return;
  }
  console.warn("Attempt failed");
};

const applyIncorrectChoiceAttempt = ({
  task,
  taskId,
  responseStatus,
  setSingleAnswers,
  setMultiAnswers,
  setAttemptFlash,
  flashTimeoutsRef,
}: {
  task: Task;
  taskId: string;
  responseStatus: string;
  setSingleAnswers: Dispatch<SetStateAction<SingleAnswersState>>;
  setMultiAnswers: Dispatch<SetStateAction<MultiAnswersState>>;
  setAttemptFlash: Dispatch<SetStateAction<AttemptFlashState>>;
  flashTimeoutsRef: MutableRefObject<Record<string, number>>;
}) => {
  if (task.answerType !== "single_choice" && task.answerType !== "multi_choice") return;

  if (responseStatus === "correct") {
    setAttemptFlash((prev) => ({ ...prev, [taskId]: null }));
    return;
  }

  if (task.answerType === "single_choice") {
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
};

const useFlashTimeoutCleanup = (flashTimeoutsRef: MutableRefObject<Record<string, number>>) => {
  useEffect(() => {
    return () => {
      Object.values(flashTimeoutsRef.current).forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
    };
  }, [flashTimeoutsRef]);
};

const useCreditedAnswerPrefill = ({
  activeTask,
  isTaskCredited,
  setNumericAnswers,
  setSingleAnswers,
  setMultiAnswers,
}: {
  activeTask: Task | null;
  isTaskCredited: boolean;
  setNumericAnswers: Dispatch<SetStateAction<NumericAnswersState>>;
  setSingleAnswers: Dispatch<SetStateAction<SingleAnswersState>>;
  setMultiAnswers: Dispatch<SetStateAction<MultiAnswersState>>;
}) => {
  useEffect(() => {
    if (!activeTask || !isTaskCredited) return;

    const numeric = buildCreditedNumericAnswers(activeTask);
    if (Object.keys(numeric).length > 0) {
      setNumericAnswers((prev) => ({ ...prev, [activeTask.id]: numeric }));
    }

    const single = activeTask.correctAnswerJson?.key ?? "";
    if (activeTask.answerType === "single_choice" && single) {
      setSingleAnswers((prev) => ({ ...prev, [activeTask.id]: single }));
    }

    const multi = activeTask.answerType === "multi_choice" ? (activeTask.correctAnswerJson?.keys ?? []) : [];
    if (multi.length > 0) {
      setMultiAnswers((prev) => ({ ...prev, [activeTask.id]: multi }));
    }
  }, [activeTask, isTaskCredited, setMultiAnswers, setNumericAnswers, setSingleAnswers]);
};

const useBlockedAttemptState = ({ taskId, blockedUntilMs }: { taskId: string | null; blockedUntilMs: number | null }) => {
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    if (!blockedUntilMs) {
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
  }, [blockedUntilMs, taskId]);

  return isBlocked;
};

const getShowIncorrectBadge = (task: Task | null, attemptFlash: AttemptFlashState) => {
  if (!task) return false;
  if (task.answerType !== "single_choice" && task.answerType !== "multi_choice") return false;
  return attemptFlash[task.id] === "incorrect";
};

const getActiveNumericAnswers = (task: Task | null, numericAnswers: NumericAnswersState) =>
  task ? (numericAnswers[task.id] ?? {}) : {};

const getActiveSingleAnswer = (task: Task | null, singleAnswers: SingleAnswersState) =>
  task ? (singleAnswers[task.id] ?? "") : "";

const getActiveMultiAnswers = (task: Task | null, multiAnswers: MultiAnswersState) =>
  task ? (multiAnswers[task.id] ?? []) : [];

const useAttemptAnswerState = ({ activeTask, isTaskCredited }: { activeTask: Task | null; isTaskCredited: boolean }) => {
  const [numericAnswers, setNumericAnswers] = useState<NumericAnswersState>({});
  const [singleAnswers, setSingleAnswers] = useState<SingleAnswersState>({});
  const [multiAnswers, setMultiAnswers] = useState<MultiAnswersState>({});

  useCreditedAnswerPrefill({
    activeTask,
    isTaskCredited,
    setNumericAnswers,
    setSingleAnswers,
    setMultiAnswers,
  });

  const activeTaskChoices = useMemo(() => shuffleChoices(activeTask), [activeTask?.id, activeTask?.choicesJson]);
  const isAnswerReady = useMemo(
    () =>
      getIsAnswerReady({
        task: activeTask,
        numericAnswers,
        singleAnswers,
        multiAnswers,
      }),
    [activeTask, multiAnswers, numericAnswers, singleAnswers],
  );

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

  return {
    numericAnswers,
    singleAnswers,
    multiAnswers,
    activeTaskChoices,
    isAnswerReady,
    activeNumericAnswers: getActiveNumericAnswers(activeTask, numericAnswers),
    activeSingleAnswer: getActiveSingleAnswer(activeTask, singleAnswers),
    activeMultiAnswers: getActiveMultiAnswers(activeTask, multiAnswers),
    setSingleAnswers,
    setMultiAnswers,
    updateNumericValue,
    updateSingleValue,
    toggleMultiValue,
  };
};

const useAttemptFeedbackState = ({ activeTask, activeState, blockedUntilMs }: { activeTask: Task | null; activeState: TaskState | null; blockedUntilMs: number | null }) => {
  const [attemptLoading, setAttemptLoading] = useState<Record<string, boolean>>({});
  const [attemptPerPart, setAttemptPerPart] = useState<AttemptPerPartState>({});
  const [attemptFlash, setAttemptFlash] = useState<AttemptFlashState>({});
  const flashTimeoutsRef = useRef<Record<string, number>>({});

  useFlashTimeoutCleanup(flashTimeoutsRef);

  const isBlocked = useBlockedAttemptState({ taskId: activeTask?.id ?? null, blockedUntilMs });
  const attemptPerPartResults = useMemo(() => {
    if (!activeTask) return null;
    return attemptPerPart[activeTask.id] ?? null;
  }, [activeTask, attemptPerPart]);
  const attemptPerPartByKey = useMemo(() => {
    if (!attemptPerPartResults) return null;
    return new Map(attemptPerPartResults.map((item) => [item.partKey, item.correct]));
  }, [attemptPerPartResults]);

  return {
    attemptLoading,
    setAttemptLoading,
    setAttemptPerPart,
    attemptPerPartByKey,
    setAttemptFlash,
    flashTimeoutsRef,
    isBlocked,
    showIncorrectBadge: getShowIncorrectBadge(activeTask, attemptFlash),
    showCorrectBadge: activeState?.status === "correct",
  };
};

const useAttemptSubmission = ({
  activeTask,
  unitId,
  activeState,
  numericAnswers,
  singleAnswers,
  multiAnswers,
  setSingleAnswers,
  setMultiAnswers,
  attemptLoading,
  setAttemptLoading,
  setAttemptPerPart,
  setAttemptFlash,
  flashTimeoutsRef,
  isBlocked,
}: {
  activeTask: Task | null;
  unitId: string;
  activeState: TaskState | null;
  numericAnswers: NumericAnswersState;
  singleAnswers: SingleAnswersState;
  multiAnswers: MultiAnswersState;
  setSingleAnswers: Dispatch<SetStateAction<SingleAnswersState>>;
  setMultiAnswers: Dispatch<SetStateAction<MultiAnswersState>>;
  attemptLoading: Record<string, boolean>;
  setAttemptLoading: Dispatch<SetStateAction<Record<string, boolean>>>;
  setAttemptPerPart: Dispatch<SetStateAction<AttemptPerPartState>>;
  setAttemptFlash: Dispatch<SetStateAction<AttemptFlashState>>;
  flashTimeoutsRef: MutableRefObject<Record<string, number>>;
  isBlocked: boolean;
}) => {
  const queryClient = useQueryClient();
  const submitAttemptMutation = useMutation({
    mutationFn: ({ taskId, payload }: { taskId: string; payload: AttemptRequest }) =>
      studentApi.submitAttempt(taskId, payload),
  });

  const isAttemptDisabled = useMemo(
    () =>
      getIsAttemptDisabled({
        task: activeTask,
        taskState: activeState,
        attemptLoading,
        isBlocked,
      }),
    [activeState, activeTask, attemptLoading, isBlocked],
  );

  const handleSubmitAttempt = useCallback(async () => {
    if (!activeTask) return;
    const taskId = activeTask.id;

    setAttemptPerPart((prev) => ({ ...prev, [taskId]: null }));
    setAttemptLoading((prev) => ({ ...prev, [taskId]: true }));

    try {
      const payload = buildAttemptPayload({ task: activeTask, numericAnswers, singleAnswers, multiAnswers });
      if (!payload) return;

      const response = await submitAttemptMutation.mutateAsync({ taskId, payload });
      setAttemptPerPart((prev) => ({ ...prev, [taskId]: response.perPart ?? null }));
      applyIncorrectChoiceAttempt({
        task: activeTask,
        taskId,
        responseStatus: response.status,
        setSingleAnswers,
        setMultiAnswers,
        setAttemptFlash,
        flashTimeoutsRef,
      });

      await queryClient.invalidateQueries({
        queryKey: learningPhotoQueryKeys.studentUnit(unitId),
        exact: true,
      });
    } catch (error) {
      reportAttemptFailure(error);
    } finally {
      setAttemptLoading((prev) => ({ ...prev, [taskId]: false }));
    }
  }, [
    activeTask,
    flashTimeoutsRef,
    multiAnswers,
    numericAnswers,
    queryClient,
    setAttemptFlash,
    setAttemptLoading,
    setAttemptPerPart,
    setMultiAnswers,
    setSingleAnswers,
    singleAnswers,
    submitAttemptMutation,
    unitId,
  ]);

  return {
    isAttemptDisabled,
    handleSubmitAttempt,
  };
};

export const useStudentTaskAttempt = ({ activeTask, unitId }: Params) => {
  const activeState = activeTask?.state ?? null;
  const blockedUntilIso = activeState?.blockedUntil ?? null;
  const blockedUntilMs = getBlockedUntilMs(blockedUntilIso);
  const wrongAttempts = activeState?.wrongAttempts ?? 0;
  const attemptsLeft = Math.max(0, 6 - wrongAttempts);
  const isTaskCredited = CREDITED_TASK_STATUSES.has((activeState?.status ?? "not_started") as TaskState["status"]);

  const answerState = useAttemptAnswerState({
    activeTask,
    isTaskCredited,
  });
  const feedbackState = useAttemptFeedbackState({ activeTask, activeState, blockedUntilMs });
  const submissionState = useAttemptSubmission({
    activeTask,
    unitId,
    activeState,
    numericAnswers: answerState.numericAnswers,
    singleAnswers: answerState.singleAnswers,
    multiAnswers: answerState.multiAnswers,
    setSingleAnswers: answerState.setSingleAnswers,
    setMultiAnswers: answerState.setMultiAnswers,
    attemptLoading: feedbackState.attemptLoading,
    setAttemptLoading: feedbackState.setAttemptLoading,
    setAttemptPerPart: feedbackState.setAttemptPerPart,
    setAttemptFlash: feedbackState.setAttemptFlash,
    flashTimeoutsRef: feedbackState.flashTimeoutsRef,
    isBlocked: feedbackState.isBlocked,
  });

  return {
    blockedUntilIso,
    attemptsLeft,
    isBlocked: feedbackState.isBlocked,
    isTaskCredited,
    isAttemptDisabled: submissionState.isAttemptDisabled,
    isAnswerReady: answerState.isAnswerReady,
    showIncorrectBadge: feedbackState.showIncorrectBadge,
    showCorrectBadge: feedbackState.showCorrectBadge,
    attemptPerPartByKey: feedbackState.attemptPerPartByKey,
    activeTaskChoices: answerState.activeTaskChoices,
    activeNumericAnswers: answerState.activeNumericAnswers,
    activeSingleAnswer: answerState.activeSingleAnswer,
    activeMultiAnswers: answerState.activeMultiAnswers,
    updateNumericValue: answerState.updateNumericValue,
    updateSingleValue: answerState.updateSingleValue,
    toggleMultiValue: answerState.toggleMultiValue,
    handleSubmitAttempt: submissionState.handleSubmitAttempt,
  };
};
