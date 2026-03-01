import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { studentApi, type Task } from "@/lib/api/student";
import type * as StudentApiModule from "@/lib/api/student";
import { learningPhotoQueryKeys } from "@/lib/query/keys";
import { createQueryClient } from "@/lib/query/query-client";
import { useStudentTaskAttempt } from "./use-student-task-attempt";

vi.mock("@/lib/api/student", async () => {
  const actual = await vi.importActual<typeof StudentApiModule>("@/lib/api/student");
  return {
    ...actual,
    studentApi: {
      ...actual.studentApi,
      submitAttempt: vi.fn(),
    },
  };
});

const now = new Date("2026-03-01T00:00:00.000Z").getTime();

const createTask = (overrides: Partial<Task>): Task =>
  ({
    id: "task-1",
    unitId: "unit-1",
    title: "Задача",
    statementLite: "Условие",
    answerType: "numeric",
    numericPartsJson: [],
    choicesJson: null,
    correctAnswerJson: null,
    isRequired: true,
    status: "published",
    sortOrder: 0,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    state: {
      status: "not_started",
      wrongAttempts: 0,
      blockedUntil: null,
      requiredSkipped: false,
    },
    ...overrides,
  }) as Task;

const createWrapper = () => {
  const queryClient = createQueryClient();

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, Wrapper };
};

describe("useStudentTaskAttempt", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.setSystemTime(now);
    vi.mocked(studentApi.submitAttempt).mockReset();
  });

  it("builds numeric payload, stores per-part results and invalidates student unit query", async () => {
    const task = createTask({
      answerType: "numeric",
      numericPartsJson: [
        { key: "a", labelLite: "a" },
        { key: "b", labelLite: "b" },
      ],
    });
    vi.mocked(studentApi.submitAttempt).mockResolvedValue({
      ok: true,
      status: "correct",
      perPart: [
        { partKey: "a", correct: true },
        { partKey: "b", correct: false },
      ],
      taskState: {
        status: "correct",
        wrongAttempts: 1,
        blockedUntil: null,
        requiredSkipped: false,
      },
    } as never);

    const { queryClient, Wrapper } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useStudentTaskAttempt({ activeTask: task, unitId: "unit-1" }), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.updateNumericValue("a", "12");
      result.current.updateNumericValue("b", "7");
    });

    expect(result.current.isAnswerReady).toBe(true);

    await act(async () => {
      await result.current.handleSubmitAttempt();
    });

    expect(vi.mocked(studentApi.submitAttempt).mock.calls[0]).toEqual([
      "task-1",
      {
        answers: [
          { partKey: "a", value: "12" },
          { partKey: "b", value: "7" },
        ],
      },
    ]);

    expect(result.current.attemptPerPartByKey?.get("a")).toBe(true);
    expect(result.current.attemptPerPartByKey?.get("b")).toBe(false);

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: learningPhotoQueryKeys.studentUnit("unit-1"),
        exact: true,
      });
    });
  });

  it("resets single-choice answer and clears incorrect flash after timeout", async () => {
    vi.useFakeTimers();
    const task = createTask({
      answerType: "single_choice",
      choicesJson: [
        { key: "a", textLite: "A" },
        { key: "b", textLite: "B" },
      ],
    });
    vi.mocked(studentApi.submitAttempt).mockResolvedValue({
      ok: true,
      status: "blocked",
      perPart: null,
      taskState: {
        status: "blocked",
        wrongAttempts: 6,
        blockedUntil: new Date(now + 60_000).toISOString(),
        requiredSkipped: false,
      },
    } as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStudentTaskAttempt({ activeTask: task, unitId: "unit-1" }), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.updateSingleValue("b");
    });

    await act(async () => {
      await result.current.handleSubmitAttempt();
    });

    expect(result.current.activeSingleAnswer).toBe("");
    expect(result.current.showIncorrectBadge).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(result.current.showIncorrectBadge).toBe(false);
  });

  it("resets multi-choice answer on incorrect attempt", async () => {
    const task = createTask({
      answerType: "multi_choice",
      choicesJson: [
        { key: "a", textLite: "A" },
        { key: "b", textLite: "B" },
        { key: "c", textLite: "C" },
      ],
    });
    vi.mocked(studentApi.submitAttempt).mockResolvedValue({
      ok: true,
      status: "in_progress",
      perPart: null,
      taskState: {
        status: "in_progress",
        wrongAttempts: 1,
        blockedUntil: null,
        requiredSkipped: false,
      },
    } as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStudentTaskAttempt({ activeTask: task, unitId: "unit-1" }), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.toggleMultiValue("a");
      result.current.toggleMultiValue("c");
    });

    expect(result.current.activeMultiAnswers).toEqual(["a", "c"]);

    await act(async () => {
      await result.current.handleSubmitAttempt();
    });

    expect(result.current.activeMultiAnswers).toEqual([]);
    expect(result.current.showIncorrectBadge).toBe(true);
  });

  it("prefills credited answers from task solution data", async () => {
    const task = createTask({
      answerType: "multi_choice",
      correctAnswerJson: { keys: ["a", "c"] },
      choicesJson: [
        { key: "a", textLite: "A" },
        { key: "b", textLite: "B" },
        { key: "c", textLite: "C" },
      ],
      state: {
        status: "accepted",
        wrongAttempts: 1,
        blockedUntil: null,
        requiredSkipped: false,
      },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStudentTaskAttempt({ activeTask: task, unitId: "unit-1" }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isTaskCredited).toBe(true);
    });
    expect(result.current.activeMultiAnswers).toEqual(["a", "c"]);
  });

  it("switches blocked state off when block timer expires", async () => {
    vi.useFakeTimers();
    const task = createTask({
      state: {
        status: "blocked",
        wrongAttempts: 6,
        blockedUntil: new Date(now + 5_000).toISOString(),
        requiredSkipped: false,
      },
    });

    const { Wrapper } = createWrapper();
    const { result } = renderHook(() => useStudentTaskAttempt({ activeTask: task, unitId: "unit-1" }), {
      wrapper: Wrapper,
    });

    expect(result.current.isBlocked).toBe(true);

    act(() => {
      vi.advanceTimersByTime(5_200);
    });

    expect(result.current.isBlocked).toBe(false);
  });
});
