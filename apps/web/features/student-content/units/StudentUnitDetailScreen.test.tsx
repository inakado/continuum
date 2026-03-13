import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { studentApi, type Task, type UnitWithTasks } from "@/lib/api/student";
import type * as StudentApiModule from "@/lib/api/student";
import { renderWithQueryClient } from "@/test/render-with-query-client";
import StudentUnitDetailScreen from "./StudentUnitDetailScreen";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/components/StudentDashboardShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/Tabs", () => ({
  default: ({
    tabs,
    active,
    onChange,
  }: {
    tabs: Array<{ key: string; label: string }>;
    active: string;
    onChange: (key: string) => void;
  }) => (
    <div>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          aria-pressed={tab.key === active}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("../auth/use-student-logout", () => ({
  useStudentLogout: () => vi.fn(),
}));

vi.mock("../shared/use-student-identity", () => ({
  useStudentIdentity: () => ({
    displayName: "Student One",
  }),
}));

vi.mock("../shared/student-errors", () => ({
  getStudentErrorMessage: (error: unknown) => {
    if (error instanceof ApiError && error.status === 404) {
      return "Не найдено или недоступно";
    }
    if (error instanceof ApiError) {
      return error.message;
    }
    return "Неизвестная ошибка";
  },
}));

vi.mock("../shared/StudentNotFound", () => ({
  default: () => <div data-testid="student-not-found">student not found</div>,
}));

vi.mock("./components/StudentUnitPdfPanel", () => ({
  StudentUnitPdfPanel: ({
    previewUrl,
    previewError,
    previewLoading,
    unavailableText,
    zoom,
    onZoomChange,
  }: {
    previewUrl?: string | null;
    previewError?: string | null;
    previewLoading?: boolean;
    unavailableText: string;
    zoom: number;
    onZoomChange: (zoom: number) => void;
  }) => (
    <div data-testid="student-unit-pdf-panel">
      <div>{previewUrl ?? "no-preview"}</div>
      <div>{previewError ?? unavailableText}</div>
      <div>{previewLoading ? "loading" : "ready"}</div>
      <div>{zoom}</div>
      <button type="button" onClick={() => onZoomChange(zoom + 0.1)}>
        Zoom
      </button>
    </div>
  ),
}));

vi.mock("./components/StudentUnitHtmlPanel", () => ({
  StudentUnitHtmlPanel: ({
    content,
    getFreshPdfUrl,
    previewError,
    previewLoading,
    unavailableText,
  }: {
    content: { html: string | null; pdfUrl: string | null };
    getFreshPdfUrl: () => Promise<string | null>;
    previewError?: string | null;
    previewLoading?: boolean;
    unavailableText: string;
  }) => (
    <div data-testid="student-unit-html-panel">
      <div>{content.html ?? "no-html"}</div>
      <div>{content.pdfUrl ?? "no-pdf"}</div>
      <div>{previewError ?? unavailableText}</div>
      <div>{previewLoading ? "loading" : "ready"}</div>
      <button type="button" onClick={() => void getFreshPdfUrl()}>
        RefreshPdf
      </button>
    </div>
  ),
}));

vi.mock("./components/StudentTaskTabs", () => ({
  StudentTaskTabs: ({
    tasks,
    activeTaskIndex,
    onSelectTask,
  }: {
    tasks: Task[];
    activeTaskIndex: number;
    onSelectTask: (taskId: string | null) => void;
  }) => (
    <div>
      <div data-testid="task-tabs-active-index">{activeTaskIndex}</div>
      {tasks.map((task) => (
        <button key={task.id} type="button" onClick={() => onSelectTask(task.id)}>
          {task.title ?? task.id}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("./components/StudentTaskCardShell", () => ({
  StudentTaskCardShell: ({
    task,
    taskIndex,
    children,
  }: {
    task: Task;
    taskIndex: number;
    children: React.ReactNode;
  }) => (
    <section data-testid="task-card-shell">
      <div>{task.title ?? task.id}</div>
      <div>{taskIndex}</div>
      {children}
    </section>
  ),
}));

vi.mock("./components/StudentTaskAnswerForm", () => ({
  StudentTaskAnswerForm: ({ task }: { task: Task }) => (
    <div data-testid="task-answer-form">{task.answerType}</div>
  ),
}));

vi.mock("./components/StudentTaskMediaPreview", () => ({
  StudentTaskMediaPreview: ({
    showSolutionPanel,
    onGoToStudentGraph,
  }: {
    showSolutionPanel: boolean;
    onGoToStudentGraph: () => void;
  }) => (
    <div data-testid="task-media-preview">
      <div>{showSolutionPanel ? "solution-visible" : "solution-hidden"}</div>
      <button type="button" onClick={onGoToStudentGraph}>
        Graph
      </button>
    </div>
  ),
}));

vi.mock("./hooks/use-student-unit-rendered-content", () => ({
  useStudentUnitRenderedContent: vi.fn(),
}));

vi.mock("./hooks/use-student-task-navigation", () => ({
  useStudentTaskNavigation: vi.fn(),
}));

vi.mock("./hooks/use-student-task-attempt", () => ({
  useStudentTaskAttempt: vi.fn(),
}));

vi.mock("./hooks/use-student-photo-submit", () => ({
  useStudentPhotoSubmit: vi.fn(),
}));

vi.mock("./hooks/use-student-task-media-preview", () => ({
  useStudentTaskMediaPreview: vi.fn(),
}));

vi.mock("@/lib/api/student", async () => {
  const actual = await vi.importActual<typeof StudentApiModule>("@/lib/api/student");
  return {
    ...actual,
    studentApi: {
      ...actual.studentApi,
      getUnit: vi.fn(),
    },
  };
});

import { useStudentTaskAttempt } from "./hooks/use-student-task-attempt";
import { useStudentPhotoSubmit } from "./hooks/use-student-photo-submit";
import { useStudentTaskMediaPreview } from "./hooks/use-student-task-media-preview";
import { useStudentTaskNavigation } from "./hooks/use-student-task-navigation";
import { useStudentUnitRenderedContent } from "./hooks/use-student-unit-rendered-content";

const buildTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  unitId: "unit-1",
  title: "Задача 1",
  statementLite: "x+1=2",
  answerType: "numeric",
  isRequired: true,
  status: "published",
  sortOrder: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  state: {
    status: "not_started",
    wrongAttempts: 0,
    blockedUntil: null,
    requiredSkipped: false,
  },
  ...overrides,
});

const buildUnit = (overrides: Partial<UnitWithTasks> = {}): UnitWithTasks => ({
  id: "unit-1",
  sectionId: "section-1",
  title: "Юнит 1",
  description: null,
  status: "published",
  sortOrder: 1,
  minOptionalCountedTasksToComplete: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  theoryRichLatex: "theory",
  theoryPdfAssetKey: "theory-key",
  methodRichLatex: "method",
  methodPdfAssetKey: "method-key",
  videosJson: [{ id: "video-1", title: "Видео", embedUrl: "https://www.youtube.com/watch?v=test" }],
  attachmentsJson: [{ id: "attachment-1", name: "Файл", urlOrKey: null }],
  countedTasks: 1,
  solvedTasks: 1,
  totalTasks: 2,
  completionPercent: 50,
  solvedPercent: 50,
  tasks: [buildTask()],
  ...overrides,
});

describe("StudentUnitDetailScreen", () => {
  const pushMock = vi.fn();
  const backMock = vi.fn();
  const setActiveTaskIdMock = vi.fn();
  const openPhotoFileDialogMock = vi.fn();
  const submitPhotoTaskMock = vi.fn();
  const toggleSolutionVisibilityMock = vi.fn();

  beforeEach(() => {
    pushMock.mockReset();
    backMock.mockReset();
    setActiveTaskIdMock.mockReset();
    openPhotoFileDialogMock.mockReset();
    submitPhotoTaskMock.mockReset();
    toggleSolutionVisibilityMock.mockReset();

    vi.mocked(useRouter).mockReturnValue({ push: pushMock, back: backMock } as never);
    vi.mocked(studentApi.getUnit).mockReset();

    vi.mocked(useStudentUnitRenderedContent).mockReturnValue({
      theoryContent: {
        ok: true,
        target: "theory",
        html: null,
        htmlKey: null,
        pdfUrl: "https://cdn.local/theory.pdf",
        pdfKey: "theory-key",
        expiresInSec: 180,
      },
      theoryLoading: false,
      theoryError: null,
      refreshTheoryContent: vi.fn(),
      methodContent: {
        ok: true,
        target: "method",
        html: null,
        htmlKey: null,
        pdfUrl: "https://cdn.local/method.pdf",
        pdfKey: "method-key",
        expiresInSec: 180,
      },
      methodLoading: false,
      methodError: null,
      refreshMethodContent: vi.fn(),
      pdfZoomByTarget: { theory: 1, method: 1 },
      setPdfZoom: vi.fn(),
    });

    vi.mocked(useStudentTaskAttempt).mockReturnValue({
      isTaskCredited: false,
      activeNumericAnswers: {},
      attemptPerPartByKey: null,
      activeTaskChoices: [],
      activeSingleAnswer: "",
      activeMultiAnswers: [],
      updateNumericValue: vi.fn(),
      updateSingleValue: vi.fn(),
      toggleMultiValue: vi.fn(),
      handleSubmitAttempt: vi.fn(),
      isAttemptDisabled: false,
      isAnswerReady: true,
      showIncorrectBadge: false,
      isBlocked: false,
      blockedUntilIso: null,
      showCorrectBadge: false,
      attemptsLeft: 3,
    });

    vi.mocked(useStudentPhotoSubmit).mockReturnValue({
      photoFileInputRef: { current: null },
      handlePhotoFileSelection: vi.fn(),
      canUploadPhoto: false,
      isPhotoLoading: false,
      photoSelectedFiles: [],
      openPhotoFileDialog: openPhotoFileDialogMock,
      submitPhotoTask: submitPhotoTaskMock,
    });

    vi.mocked(useStudentTaskMediaPreview).mockReturnValue({
      activeTaskStatementImageLoading: false,
      activeTaskStatementImageError: null,
      activeTaskStatementImageUrl: null,
      handleStatementImageLoadError: vi.fn(),
      activeTaskSolutionLoading: false,
      activeTaskSolutionError: null,
      activeTaskSolutionErrorCode: null,
      activeTaskSolutionHtml: "<p>Solution</p>",
      activeTaskSolutionHtmlKey: "solution-html-key",
      refreshTaskSolutionRenderedContent: vi.fn(),
      toggleSolutionVisibility: toggleSolutionVisibilityMock,
      isSolutionVisible: false,
    });
  });

  it("renders StudentNotFound when unit request resolves to 404", async () => {
    const fallbackTask = buildTask();
    vi.mocked(studentApi.getUnit).mockRejectedValueOnce(new ApiError(404, "Not found"));
    vi.mocked(useStudentTaskNavigation).mockReturnValue({
      activeTaskId: fallbackTask.id,
      activeTaskIndex: 0,
      activeTask: fallbackTask,
      setActiveTaskId: setActiveTaskIdMock,
    });

    renderWithQueryClient(<StudentUnitDetailScreen unitId="unit-1" />);

    expect(await screen.findByTestId("student-not-found")).toBeInTheDocument();
    expect(screen.queryByRole("status", { name: "" })).not.toBeInTheDocument();
  });

  it("shows locked gate and uses router actions when access is locked", async () => {
    const fallbackTask = buildTask();
    vi.mocked(studentApi.getUnit).mockRejectedValueOnce(new ApiError(409, "UNIT_LOCKED", "UNIT_LOCKED"));
    vi.mocked(useStudentTaskNavigation).mockReturnValue({
      activeTaskId: fallbackTask.id,
      activeTaskIndex: 0,
      activeTask: fallbackTask,
      setActiveTaskId: setActiveTaskIdMock,
    });

    renderWithQueryClient(<StudentUnitDetailScreen unitId="unit-1" />);
    const user = userEvent.setup();

    expect(await screen.findByText("Юнит заблокирован")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "К графу раздела" }));
    expect(pushMock).toHaveBeenCalledWith("/student");

    await user.click(screen.getByRole("button", { name: /Назад/i }));
    expect(backMock).toHaveBeenCalledTimes(1);
  });

  it("switches from tasks to theory and hides progress card on pdf tabs", async () => {
    const unit = buildUnit();
    vi.mocked(studentApi.getUnit).mockResolvedValueOnce(unit);
    vi.mocked(useStudentTaskNavigation).mockReturnValue({
      activeTaskId: unit.tasks[0]?.id ?? null,
      activeTaskIndex: 0,
      activeTask: unit.tasks[0] ?? buildTask(),
      setActiveTaskId: setActiveTaskIdMock,
    });

    renderWithQueryClient(<StudentUnitDetailScreen unitId="unit-1" />);
    const user = userEvent.setup();

    expect(await screen.findByLabelText("Прогресс юнита")).toBeInTheDocument();
    expect(screen.getByTestId("task-card-shell")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Теория" }));

    expect(screen.queryByLabelText("Прогресс юнита")).not.toBeInTheDocument();
    expect(screen.getByTestId("student-unit-pdf-panel")).toHaveTextContent("https://cdn.local/theory.pdf");
  });

  it("renders HTML panel when rendered content is available", async () => {
    const unit = buildUnit({ theoryHtmlAssetKey: "theory-html-key" });
    vi.mocked(studentApi.getUnit).mockResolvedValueOnce(unit);
    vi.mocked(useStudentUnitRenderedContent).mockReturnValue({
      theoryContent: {
        ok: true,
        target: "theory",
        html: "<h1>Теория</h1><p>HTML</p>",
        htmlKey: "theory-html-key",
        pdfUrl: "https://cdn.local/theory.pdf",
        pdfKey: "theory-key",
        expiresInSec: 180,
      },
      theoryLoading: false,
      theoryError: null,
      refreshTheoryContent: vi.fn(),
      methodContent: null,
      methodLoading: false,
      methodError: null,
      refreshMethodContent: vi.fn(),
      pdfZoomByTarget: { theory: 1, method: 1 },
      setPdfZoom: vi.fn(),
    });
    vi.mocked(useStudentTaskNavigation).mockReturnValue({
      activeTaskId: unit.tasks[0]?.id ?? null,
      activeTaskIndex: 0,
      activeTask: unit.tasks[0] ?? buildTask(),
      setActiveTaskId: setActiveTaskIdMock,
    });

    renderWithQueryClient(<StudentUnitDetailScreen unitId="unit-1" />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Теория" }));

    expect(screen.getByTestId("student-unit-html-panel")).toHaveTextContent("<h1>Теория</h1><p>HTML</p>");
    expect(screen.queryByTestId("student-unit-pdf-panel")).not.toBeInTheDocument();
  });

  it("renders credited non-photo task actions and solution toggle", async () => {
    const task = buildTask({
      solutionHtmlAssetKey: "solution-html-key",
      state: {
        status: "accepted",
        wrongAttempts: 0,
        blockedUntil: null,
        requiredSkipped: false,
      },
    });
    const unit = buildUnit({ tasks: [task, buildTask({ id: "task-2", title: "Задача 2", sortOrder: 2 })] });
    vi.mocked(studentApi.getUnit).mockResolvedValueOnce(unit);
    vi.mocked(useStudentTaskNavigation).mockReturnValue({
      activeTaskId: task.id,
      activeTaskIndex: 0,
      activeTask: task,
      setActiveTaskId: setActiveTaskIdMock,
    });
    vi.mocked(useStudentTaskAttempt).mockReturnValue({
      isTaskCredited: true,
      activeNumericAnswers: {},
      attemptPerPartByKey: null,
      activeTaskChoices: [],
      activeSingleAnswer: "",
      activeMultiAnswers: [],
      updateNumericValue: vi.fn(),
      updateSingleValue: vi.fn(),
      toggleMultiValue: vi.fn(),
      handleSubmitAttempt: vi.fn(),
      isAttemptDisabled: false,
      isAnswerReady: true,
      showIncorrectBadge: false,
      isBlocked: false,
      blockedUntilIso: null,
      showCorrectBadge: true,
      attemptsLeft: 2,
    });
    vi.mocked(useStudentTaskMediaPreview).mockReturnValue({
      activeTaskStatementImageLoading: false,
      activeTaskStatementImageError: null,
      activeTaskStatementImageUrl: null,
      handleStatementImageLoadError: vi.fn(),
      activeTaskSolutionLoading: false,
      activeTaskSolutionError: null,
      activeTaskSolutionErrorCode: null,
      activeTaskSolutionHtml: "<p>Solution</p>",
      activeTaskSolutionHtmlKey: "solution-html-key",
      refreshTaskSolutionRenderedContent: vi.fn(),
      toggleSolutionVisibility: toggleSolutionVisibilityMock,
      isSolutionVisible: true,
    });
    vi.mocked(useStudentPhotoSubmit).mockReturnValue({
      photoFileInputRef: { current: null },
      handlePhotoFileSelection: vi.fn(),
      canUploadPhoto: false,
      isPhotoLoading: false,
      photoSelectedFiles: [],
      openPhotoFileDialog: openPhotoFileDialogMock,
      submitPhotoTask: submitPhotoTaskMock,
    });

    renderWithQueryClient(<StudentUnitDetailScreen unitId="unit-1" />);
    const user = userEvent.setup();

    expect(await screen.findByText("Следующая")).toBeInTheDocument();
    expect(screen.getByText("Верно")).toBeInTheDocument();
    expect(screen.getByText("Скрыть решение")).toBeInTheDocument();
    expect(screen.getByText("Осталось попыток: 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Следующая" }));
    expect(setActiveTaskIdMock).toHaveBeenCalledWith("task-2");

    await user.click(screen.getByRole("button", { name: "Скрыть решение" }));
    expect(toggleSolutionVisibilityMock).toHaveBeenCalledTimes(1);
  });

  it("renders photo task actions instead of answer submission flow", async () => {
    const task = buildTask({
      id: "photo-task",
      title: "Фото-задача",
      answerType: "photo",
      state: {
        status: "in_progress",
        wrongAttempts: 0,
        blockedUntil: null,
        requiredSkipped: false,
      },
    });
    const unit = buildUnit({ tasks: [task] });
    vi.mocked(studentApi.getUnit).mockResolvedValueOnce(unit);
    vi.mocked(useStudentTaskNavigation).mockReturnValue({
      activeTaskId: task.id,
      activeTaskIndex: 0,
      activeTask: task,
      setActiveTaskId: setActiveTaskIdMock,
    });
    vi.mocked(useStudentPhotoSubmit).mockReturnValue({
      photoFileInputRef: { current: null },
      handlePhotoFileSelection: vi.fn(),
      canUploadPhoto: true,
      isPhotoLoading: false,
      photoSelectedFiles: [new File(["1"], "answer.jpg", { type: "image/jpeg" })],
      openPhotoFileDialog: openPhotoFileDialogMock,
      submitPhotoTask: submitPhotoTaskMock,
    });

    renderWithQueryClient(<StudentUnitDetailScreen unitId="unit-1" />);
    const user = userEvent.setup();

    expect(await screen.findByRole("button", { name: "Загрузить фото" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Отправить" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Проверить" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Осталось попыток/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Загрузить фото" }));
    expect(openPhotoFileDialogMock).toHaveBeenCalledWith("photo-task");

    await user.click(screen.getByRole("button", { name: "Отправить" }));
    await waitFor(() => {
      expect(submitPhotoTaskMock).toHaveBeenCalledWith("photo-task");
    });
  });
});
