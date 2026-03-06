import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ChangeEvent, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { teacherApi, type Task } from "@/lib/api/teacher";
import type * as TeacherApiModule from "@/lib/api/teacher";
import { createQueryClient } from "@/lib/query/query-client";
import { useTeacherTaskStatementImage } from "./use-teacher-task-statement-image";

vi.mock("@/lib/api/teacher", async () => {
  const actual = await vi.importActual<typeof TeacherApiModule>("@/lib/api/teacher");
  return {
    ...actual,
    teacherApi: {
      ...actual.teacherApi,
      presignTaskStatementImageView: vi.fn(),
      presignTaskStatementImageUpload: vi.fn(),
      applyTaskStatementImage: vi.fn(),
      deleteTaskStatementImage: vi.fn(),
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
    solutionRichLatex: null,
    solutionHtmlAssetKey: null,
    statementImageAssetKey: null,
    ...overrides,
  }) as Task;

const createWrapper = () => {
  const queryClient = createQueryClient();
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  return { queryClient, Wrapper };
};

const createFileChangeEvent = (file: File): ChangeEvent<HTMLInputElement> =>
  ({
    target: { files: [file] },
    currentTarget: { value: "fake-path" },
  }) as unknown as ChangeEvent<HTMLInputElement>;

describe("useTeacherTaskStatementImage", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(teacherApi.presignTaskStatementImageView).mockReset();
    vi.mocked(teacherApi.presignTaskStatementImageUpload).mockReset();
    vi.mocked(teacherApi.applyTaskStatementImage).mockReset();
    vi.mocked(teacherApi.deleteTaskStatementImage).mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      }),
    );
  });

  it("loads preview URL through query when statement image key exists", async () => {
    vi.mocked(teacherApi.presignTaskStatementImageView).mockResolvedValue({
      ok: true,
      taskId: "task-1",
      key: "statement-key",
      expiresInSec: 600,
      url: "https://cdn.example.com/statement.webp",
    } as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useTeacherTaskStatementImage({
          editingTask: createTask({ statementImageAssetKey: "statement-key" }),
          fetchUnit: vi.fn(),
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.taskStatementImageState.previewUrl).toBe("https://cdn.example.com/statement.webp");
    });

    expect(teacherApi.presignTaskStatementImageView).toHaveBeenCalledWith("task-1", 600);
    expect(result.current.taskStatementImageStatusText).toBe("Изображение сохранено.");
  });

  it("uploads image through mutation flow and refreshes unit", async () => {
    const fetchUnit = vi.fn().mockResolvedValue(null);
    vi.mocked(teacherApi.presignTaskStatementImageUpload).mockResolvedValue({
      assetKey: "statement-key-next",
      uploadUrl: "https://upload.example.com/object",
      headers: {},
      expiresInSec: 600,
    } as never);
    vi.mocked(teacherApi.applyTaskStatementImage).mockResolvedValue({
      ok: true,
      taskId: "task-1",
      assetKey: "statement-key-next",
    } as never);
    vi.mocked(teacherApi.presignTaskStatementImageView).mockResolvedValue({
      ok: true,
      taskId: "task-1",
      key: "statement-key-next",
      expiresInSec: 600,
      url: "https://cdn.example.com/statement-next.webp",
    } as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useTeacherTaskStatementImage({
          editingTask: createTask(),
          fetchUnit,
        }),
      { wrapper: Wrapper },
    );

    await act(async () => {
      await result.current.handleTaskStatementImageSelected(
        createFileChangeEvent(new File(["image"], "statement.webp", { type: "image/webp" })),
      );
    });

    expect(teacherApi.presignTaskStatementImageUpload).toHaveBeenCalledWith("task-1", {
      filename: "statement.webp",
      contentType: "image/webp",
      sizeBytes: 5,
    });
    expect(teacherApi.applyTaskStatementImage).toHaveBeenCalledWith("task-1", "statement-key-next");
    expect(fetchUnit).toHaveBeenCalledTimes(1);
    expect(result.current.taskStatementImageState.key).toBe("statement-key-next");
    expect(result.current.taskStatementImageState.previewUrl).toBe("https://cdn.example.com/statement-next.webp");
    expect(result.current.taskStatementImageState.error).toBeNull();
  });

  it("deletes image through mutation flow and clears preview", async () => {
    const fetchUnit = vi.fn().mockResolvedValue(null);
    vi.mocked(teacherApi.presignTaskStatementImageView).mockResolvedValue({
      ok: true,
      taskId: "task-1",
      key: "statement-key",
      expiresInSec: 600,
      url: "https://cdn.example.com/statement.webp",
    } as never);
    vi.mocked(teacherApi.deleteTaskStatementImage).mockResolvedValue({
      ok: true,
      taskId: "task-1",
      assetKey: null,
    } as never);

    const { Wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useTeacherTaskStatementImage({
          editingTask: createTask({ statementImageAssetKey: "statement-key" }),
          fetchUnit,
        }),
      { wrapper: Wrapper },
    );

    await waitFor(() => {
      expect(result.current.taskStatementImageState.previewUrl).toBe("https://cdn.example.com/statement.webp");
    });

    await act(async () => {
      await result.current.handleTaskStatementImageRemove();
    });

    expect(teacherApi.deleteTaskStatementImage).toHaveBeenCalledWith("task-1");
    expect(fetchUnit).toHaveBeenCalledTimes(1);
    expect(result.current.taskStatementImageState.key).toBeNull();
    expect(result.current.taskStatementImageState.previewUrl).toBeNull();
  });
});
