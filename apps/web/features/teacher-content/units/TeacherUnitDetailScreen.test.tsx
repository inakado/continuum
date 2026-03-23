import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { teacherApi, type Task, type UnitWithTasks } from "@/lib/api/teacher";
import type * as TeacherApiModule from "@/lib/api/teacher";
import { renderWithQueryClient } from "@/test/render-with-query-client";
import TeacherUnitDetailScreen from "./TeacherUnitDetailScreen";
import type { TaskFormData } from "../tasks/TaskForm";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/components/TeacherDashboardShell", () => ({
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

vi.mock("@/components/ui/Switch", () => ({
  default: ({
    checked,
    onCheckedChange,
    label,
  }: {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    label: string;
  }) => (
    <button type="button" aria-label={label} data-checked={checked ? "yes" : "no"} onClick={() => onCheckedChange(!checked)}>
      {label}
    </button>
  ),
}));

vi.mock("@/components/ui/AlertDialog", () => ({
  default: ({
    open,
    title,
    onConfirm,
    onOpenChange,
  }: {
    open: boolean;
    title: string;
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div role="dialog" aria-label={title}>
        <button type="button" onClick={onConfirm}>
          Подтвердить
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          Отмена
        </button>
      </div>
    ) : null,
}));

vi.mock("../auth/use-teacher-logout", () => ({
  useTeacherLogout: () => vi.fn(),
}));

vi.mock("../shared/use-teacher-identity", () => ({
  useTeacherIdentity: () => ({
    displayName: "Teacher One",
  }),
}));

vi.mock("./hooks/use-teacher-unit-latex-compile", () => ({
  useTeacherUnitLatexCompile: () => ({
    compileState: {
      theory: { loading: false, error: null, updatedAt: null, key: null },
      method: { loading: false, error: null, updatedAt: null, key: null },
    },
    previewUrls: { theory: null, method: null },
    refreshTheoryPreviewUrl: vi.fn(),
    refreshMethodPreviewUrl: vi.fn(),
    runCompile: vi.fn(),
    reopenCompileErrorModal: vi.fn(),
    compileErrorModalState: null,
    isCompileErrorModalOpen: false,
    setIsCompileErrorModalOpen: vi.fn(),
    copyCompileErrorLog: vi.fn(),
    closeCompileErrorModal: vi.fn(),
    compileErrorCopyState: "idle",
    compileErrorLogHint: null,
    taskSolutionLatex: "",
    setTaskSolutionLatex: vi.fn(),
    taskSolutionCompileState: { status: "idle", loading: false, error: null, updatedAt: null, key: null, previewHtml: null },
    runTaskSolutionCompile: vi.fn(),
    refreshTaskSolutionRenderedContent: vi.fn(),
  }),
}));

vi.mock("./hooks/use-teacher-unit-rendered-content", () => ({
  useTeacherUnitRenderedContent: () => ({
    theoryContent: null,
    theoryLoading: false,
    theoryError: null,
    refreshTheoryContent: vi.fn(),
    methodContent: null,
    methodLoading: false,
    methodError: null,
    refreshMethodContent: vi.fn(),
  }),
}));

vi.mock("./hooks/use-teacher-task-statement-image", () => ({
  useTeacherTaskStatementImage: () => ({
    taskStatementImageInputRef: { current: null },
    taskStatementImageState: {
      loading: false,
      error: null,
      updatedAt: null,
      key: null,
      previewUrl: null,
    },
    taskStatementImageStatusText: "Изображение не прикреплено.",
    handleTaskStatementImageSelected: vi.fn(),
    handleTaskStatementImageRemove: vi.fn(),
    handleTaskStatementImagePreviewError: vi.fn(),
  }),
}));

vi.mock("./components/TeacherUnitLatexPanel", () => ({
  TeacherUnitLatexPanel: ({ title }: { title: string }) => <div data-testid={`latex-panel-${title}`}>{title}</div>,
}));

vi.mock("./components/TeacherCompileErrorDialog", () => ({
  TeacherCompileErrorDialog: () => null,
}));

vi.mock("./components/TeacherTaskStatementImageSection", () => ({
  TeacherTaskStatementImageSection: () => <div>statement-image-section</div>,
}));

vi.mock("./components/TeacherTaskSolutionSection", () => ({
  TeacherTaskSolutionSection: () => <div>task-solution-section</div>,
}));

const sampleTaskFormData: TaskFormData = {
  statementLite: "x+1=2",
  methodGuidance: "Сначала перенесите единицу в правую часть.",
  answerType: "numeric",
  numericParts: [{ key: "x", labelLite: "x", correctValue: "1" }],
  choices: [],
  correctAnswer: null,
  isRequired: true,
  sortOrder: 1,
};

vi.mock("./components/TeacherUnitTasksPanel", () => ({
  TeacherUnitTasksPanel: ({
    taskOrder,
    onStartCreateTask,
    onTaskSubmit,
  }: {
    taskOrder: Task[];
    onStartCreateTask: () => void;
    onTaskSubmit: (data: TaskFormData) => Promise<void>;
  }) => (
    <div>
      <div data-testid="teacher-unit-task-count">{taskOrder.length}</div>
      <button type="button" onClick={onStartCreateTask}>
        Начать создание задачи
      </button>
      <button
        type="button"
        onClick={() => {
          void onTaskSubmit(sampleTaskFormData);
        }}
      >
        Создать задачу
      </button>
    </div>
  ),
}));

vi.mock("@/lib/api/teacher", async () => {
  const actual = await vi.importActual<typeof TeacherApiModule>("@/lib/api/teacher");
  return {
    ...actual,
    teacherApi: {
    ...actual.teacherApi,
      getUnit: vi.fn(),
      getSectionMeta: vi.fn(),
      getCourse: vi.fn(),
      createTask: vi.fn(),
      publishTask: vi.fn(),
      updateTask: vi.fn(),
      publishUnit: vi.fn(),
      unpublishUnit: vi.fn(),
      deleteUnit: vi.fn(),
      deleteTask: vi.fn(),
      updateUnit: vi.fn(),
    },
  };
});

const buildTask = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  unitId: "unit-1",
  title: "Задача 1",
  statementLite: "x+1=2",
  methodGuidance: null,
  answerType: "numeric",
  numericPartsJson: [{ key: "x", labelLite: "x", correctValue: "1" }],
  choicesJson: null,
  correctAnswerJson: null,
  solutionRichLatex: null,
  solutionHtmlAssetKey: null,
  isRequired: true,
  status: "draft",
  sortOrder: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  ...overrides,
});

const buildUnit = (overrides: Partial<UnitWithTasks> = {}): UnitWithTasks => ({
  id: "unit-1",
  sectionId: "section-1",
  title: "Юнит 1",
  description: null,
  status: "draft",
  sortOrder: 1,
  minOptionalCountedTasksToComplete: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  theoryRichLatex: "theory",
  theoryPdfAssetKey: null,
  theoryHtmlAssetKey: null,
  methodRichLatex: "method",
  methodPdfAssetKey: null,
  methodHtmlAssetKey: null,
  videosJson: [],
  attachmentsJson: [],
  section: {
    id: "section-1",
    title: "Раздел 1",
    courseId: "course-1",
  },
  tasks: [buildTask()],
  ...overrides,
});

describe("TeacherUnitDetailScreen", () => {
  const pushMock = vi.fn();
  const backMock = vi.fn();

  beforeEach(() => {
    pushMock.mockReset();
    backMock.mockReset();
    vi.mocked(useRouter).mockReturnValue({ push: pushMock, back: backMock } as never);

    vi.mocked(teacherApi.getUnit).mockReset();
    vi.mocked(teacherApi.getSectionMeta).mockReset();
    vi.mocked(teacherApi.getCourse).mockReset();
    vi.mocked(teacherApi.createTask).mockReset();
    vi.mocked(teacherApi.publishTask).mockReset();
    vi.mocked(teacherApi.updateTask).mockReset();
    vi.mocked(teacherApi.publishUnit).mockReset();
    vi.mocked(teacherApi.unpublishUnit).mockReset();
    vi.mocked(teacherApi.deleteUnit).mockReset();
    vi.mocked(teacherApi.deleteTask).mockReset();
    vi.mocked(teacherApi.updateUnit).mockReset();
  });

  it("loads unit and breadcrumb context", async () => {
    vi.mocked(teacherApi.getUnit).mockResolvedValueOnce(buildUnit());
    vi.mocked(teacherApi.getCourse).mockResolvedValueOnce({
      id: "course-1",
      title: "Алгебра",
      description: null,
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      sections: [],
    } as never);

    renderWithQueryClient(<TeacherUnitDetailScreen unitId="unit-1" />);

    expect(await screen.findByText("Юнит 1")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Курсы" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Алгебра" })).toBeInTheDocument();
    expect(screen.getByTestId("latex-panel-Теория")).toBeInTheDocument();
    expect(teacherApi.getSectionMeta).not.toHaveBeenCalled();
  });

  it("falls back to section meta when unit payload has no embedded section", async () => {
    vi.mocked(teacherApi.getUnit).mockResolvedValueOnce(buildUnit({ section: null }));
    vi.mocked(teacherApi.getSectionMeta).mockResolvedValue({
      id: "section-1",
      courseId: "course-1",
      title: "Раздел 1",
      status: "draft",
    } as never);
    vi.mocked(teacherApi.getCourse).mockResolvedValue({
      id: "course-1",
      title: "Алгебра",
      description: null,
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      sections: [],
    } as never);

    renderWithQueryClient(<TeacherUnitDetailScreen unitId="unit-1" />);

    await waitFor(() => {
      expect(teacherApi.getSectionMeta).toHaveBeenCalledWith("section-1");
    });
    await waitFor(() => {
      expect(teacherApi.getCourse).toHaveBeenCalledWith("course-1");
    });
    expect(await screen.findByRole("button", { name: "Алгебра" })).toBeInTheDocument();
  });

  it("publishes unit from header toggle", async () => {
    vi.mocked(teacherApi.getUnit).mockResolvedValueOnce(buildUnit());
    vi.mocked(teacherApi.getCourse).mockResolvedValueOnce({
      id: "course-1",
      title: "Алгебра",
      description: null,
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      sections: [],
    } as never);
    vi.mocked(teacherApi.publishUnit).mockResolvedValueOnce({
      id: "unit-1",
      title: "Юнит 1",
      status: "published",
      sortOrder: 1,
      sectionId: "section-1",
      minOptionalCountedTasksToComplete: 0,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
    } as never);

    renderWithQueryClient(<TeacherUnitDetailScreen unitId="unit-1" />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Опубликовано" }));

    await waitFor(() => {
      expect(teacherApi.publishUnit).toHaveBeenCalledWith("unit-1");
    });
  });

  it("creates task in draft by default", async () => {
    vi.mocked(teacherApi.getUnit)
      .mockResolvedValueOnce(buildUnit())
      .mockResolvedValueOnce(buildUnit({ tasks: [buildTask(), buildTask({ id: "task-2", title: "Задача 2" })] }));
    vi.mocked(teacherApi.getCourse).mockResolvedValue({
      id: "course-1",
      title: "Алгебра",
      description: null,
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      sections: [],
    } as never);
    vi.mocked(teacherApi.createTask).mockResolvedValueOnce(buildTask({ id: "task-2", title: null }) as never);

    renderWithQueryClient(<TeacherUnitDetailScreen unitId="unit-1" />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Задачи" }));
    await user.click(await screen.findByRole("button", { name: "Начать создание задачи" }));
    await user.click(await screen.findByRole("button", { name: "Создать задачу" }));

    await waitFor(() => {
      expect(teacherApi.createTask).toHaveBeenCalledWith({
        unitId: "unit-1",
        statementLite: "x+1=2",
        methodGuidance: "Сначала перенесите единицу в правую часть.",
        answerType: "numeric",
        isRequired: true,
        sortOrder: 1,
        numericPartsJson: [{ key: "x", labelLite: "x", correctValue: "1" }],
        choicesJson: null,
        correctAnswerJson: null,
      });
    });
    expect(teacherApi.publishTask).not.toHaveBeenCalled();
  });

  it("deletes unit after confirmation and returns to section route", async () => {
    vi.mocked(teacherApi.getUnit).mockResolvedValueOnce(buildUnit());
    vi.mocked(teacherApi.getCourse).mockResolvedValueOnce({
      id: "course-1",
      title: "Алгебра",
      description: null,
      status: "draft",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      sections: [],
    } as never);
    vi.mocked(teacherApi.deleteUnit).mockResolvedValueOnce({ ok: true } as never);

    renderWithQueryClient(<TeacherUnitDetailScreen unitId="unit-1" />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Удалить юнит" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    await waitFor(() => {
      expect(teacherApi.deleteUnit).toHaveBeenCalledWith("unit-1");
    });
    expect(pushMock).toHaveBeenCalledWith("/teacher/sections/section-1");
  });
});
