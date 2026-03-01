import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { teacherApi, type Task, type UnitWithTasks } from "@/lib/api/teacher";
import type * as TeacherApiModule from "@/lib/api/teacher";
import { useTeacherUnitLatexCompile } from "./use-teacher-unit-latex-compile";

vi.mock("@/lib/api/teacher", async () => {
  const actual = await vi.importActual<typeof TeacherApiModule>("@/lib/api/teacher");
  return {
    ...actual,
    teacherApi: {
      ...actual.teacherApi,
      getUnitPdfPresignedUrl: vi.fn(),
      getTaskSolutionPdfPresignedUrl: vi.fn(),
      compileTaskSolutionLatex: vi.fn(),
      getLatexCompileJob: vi.fn(),
      applyLatexCompileJob: vi.fn(),
    },
  };
});

const createTask = (overrides: Partial<Task> = {}): Task =>
  ({
    id: "task-1",
    unitId: "unit-1",
    title: "Задача",
    statementLite: "Условие",
    answerType: "single_choice",
    choicesJson: [],
    correctAnswerJson: null,
    isRequired: true,
    status: "published",
    sortOrder: 0,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    solutionRichLatex: "\\frac{1}{2}",
    solutionPdfAssetKey: null,
    ...overrides,
  }) as Task;

const createUnit = (taskOverrides: Partial<Task> = {}): UnitWithTasks =>
  ({
    id: "unit-1",
    sectionId: "section-1",
    title: "Юнит",
    description: null,
    theoryPdfAssetKey: null,
    methodPdfAssetKey: null,
    tasks: [createTask(taskOverrides)],
    status: "published",
    sortOrder: 0,
    minOptionalCountedTasksToComplete: 0,
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
  }) as UnitWithTasks;

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("useTeacherUnitLatexCompile", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    vi.mocked(teacherApi.getUnitPdfPresignedUrl).mockReset();
    vi.mocked(teacherApi.getTaskSolutionPdfPresignedUrl).mockReset();
    vi.mocked(teacherApi.compileTaskSolutionLatex).mockReset();
    vi.mocked(teacherApi.getLatexCompileJob).mockReset();
    vi.mocked(teacherApi.applyLatexCompileJob).mockReset();
  });

  it("opens compile error modal when task solution compile fails", async () => {
    const unit = createUnit();
    const fetchUnit = vi.fn(async () => unit);
    const setUnit = vi.fn();

    vi.mocked(teacherApi.compileTaskSolutionLatex).mockResolvedValue({
      jobId: "job-1",
    } as never);
    vi.mocked(teacherApi.getLatexCompileJob).mockResolvedValue({
      jobId: "job-1",
      status: "failed",
      error: {
        code: "LATEX_COMPILE_FAILED",
        message: "Compilation error",
        logSnippet: "Undefined control sequence",
        logTruncated: true,
        logLimitBytes: 2048,
      },
    } as never);

    const { result } = renderHook(() =>
      useTeacherUnitLatexCompile({
        unit,
        setUnit,
        theoryText: "",
        methodText: "",
        editingTask: unit.tasks[0],
        fetchUnit,
      }),
    );

    await waitFor(() => {
      expect(result.current.taskSolutionLatex).toBe("\\frac{1}{2}");
    });

    await act(async () => {
      await result.current.runTaskSolutionCompile();
    });

    expect(result.current.taskSolutionCompileState.status).toBe("failed");
    expect(result.current.taskSolutionCompileState.error).toBe("Компиляция не удалась. Откройте лог.");
    expect(result.current.compileErrorModalState).toMatchObject({
      target: "task_solution",
      jobId: "job-1",
      code: "LATEX_COMPILE_FAILED",
      message: "Compilation error",
    });
    expect(result.current.isCompileErrorModalOpen).toBe(true);
    expect(result.current.compileErrorLogHint).toContain("2KB");
  });

  it("applies compile job fallback and refreshes task solution preview", async () => {
    const unit = createUnit();
    const setUnit = vi.fn();
    const fetchUnit = vi
      .fn()
      .mockResolvedValueOnce(unit)
      .mockResolvedValueOnce(unit)
      .mockResolvedValueOnce(unit)
      .mockResolvedValueOnce({
        ...unit,
        tasks: [
          createTask({
            solutionPdfAssetKey: "asset-1",
            solutionRichLatex: "\\frac{1}{2}",
          }),
        ],
      } satisfies UnitWithTasks);

    vi.mocked(teacherApi.compileTaskSolutionLatex).mockResolvedValue({
      jobId: "job-2",
    } as never);
    vi.mocked(teacherApi.getLatexCompileJob).mockResolvedValue({
      jobId: "job-2",
      status: "succeeded",
      assetKey: "asset-1",
    } as never);
    vi.mocked(teacherApi.applyLatexCompileJob).mockResolvedValue({
      ok: true,
      target: "task_solution",
      assetKey: "asset-1",
      taskId: "task-1",
    } as never);
    vi.mocked(teacherApi.getTaskSolutionPdfPresignedUrl).mockResolvedValue({
      ok: true,
      taskId: "task-1",
      taskRevisionId: "task-revision-1",
      key: "asset-1",
      expiresInSec: 600,
      url: "https://cdn.example.com/task-solution.pdf",
    } as never);

    const { result } = renderHook(() =>
      useTeacherUnitLatexCompile({
        unit,
        setUnit,
        theoryText: "",
        methodText: "",
        editingTask: unit.tasks[0],
        fetchUnit,
      }),
    );

    await waitFor(() => {
      expect(result.current.taskSolutionLatex).toBe("\\frac{1}{2}");
    });

    const timeoutSpy = vi
      .spyOn(window, "setTimeout")
      .mockImplementation((handler: TimerHandler) => {
        if (typeof handler === "function") {
          handler();
        }
        return 0 as never;
      });

    await act(async () => {
      await result.current.runTaskSolutionCompile();
      await flushMicrotasks();
    });

    expect(teacherApi.applyLatexCompileJob).toHaveBeenCalledWith("job-2");
    expect(result.current.taskSolutionCompileState.status).toBe("succeeded");
    expect(result.current.taskSolutionCompileState.key).toBe("asset-1");
    expect(result.current.taskSolutionCompileState.previewUrl).toBe("https://cdn.example.com/task-solution.pdf");
    expect(result.current.taskSolutionCompileState.error).toBeNull();
    expect(fetchUnit).toHaveBeenCalledTimes(4);
    timeoutSpy.mockRestore();
  }, 10000);
});
