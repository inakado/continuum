import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { studentApi } from "@/lib/api/student";
import type * as StudentApiModule from "@/lib/api/student";
import { renderWithQueryClient } from "@/test/render-with-query-client";
import { LAST_SECTION_KEY } from "./constants";
import StudentDashboardScreen from "./StudentDashboardScreen";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("next/dynamic", () => ({
  default:
    () =>
    (props: { sectionId: string; sectionTitle?: string | null; onBack: () => void; onNotFound: () => void }) => (
      <div>
        <div data-testid="student-graph-panel">{props.sectionId}</div>
        <div data-testid="student-graph-title">{props.sectionTitle ?? ""}</div>
        <button type="button" onClick={props.onBack}>
          Назад к разделам
        </button>
        <button type="button" onClick={props.onNotFound}>
          Graph not found
        </button>
      </div>
    ),
}));

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/features/student-content/auth/use-student-logout", () => ({
  useStudentLogout: () => vi.fn(),
}));

vi.mock("@/features/student-content/shared/use-student-identity", () => ({
  useStudentIdentity: () => ({
    displayName: "Student One",
  }),
}));

vi.mock("@/lib/api/student", async () => {
  const actual = await vi.importActual<typeof StudentApiModule>("@/lib/api/student");
  return {
    ...actual,
    studentApi: {
      ...actual.studentApi,
      getDashboardOverview: vi.fn(),
      listCourses: vi.fn(),
      getCourse: vi.fn(),
      getSection: vi.fn(),
    },
  };
});

describe("StudentDashboardScreen", () => {
  const replaceMock = vi.fn();

  beforeEach(() => {
    vi.mocked(useRouter).mockReturnValue({ replace: replaceMock } as never);
    replaceMock.mockReset();
    vi.mocked(studentApi.listCourses).mockReset();
    vi.mocked(studentApi.getDashboardOverview).mockReset();
    vi.mocked(studentApi.getCourse).mockReset();
    vi.mocked(studentApi.getSection).mockReset();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/student");
  });

  it("loads and shows student courses", async () => {
    vi.mocked(studentApi.getDashboardOverview).mockResolvedValueOnce({
      courses: [],
      continueLearning: null,
      stats: { totalUnits: 0, availableUnits: 0, inProgressUnits: 0, completedUnits: 0 },
    } as never);
    vi.mocked(studentApi.listCourses).mockResolvedValueOnce([
      {
        id: "course-1",
        title: "Алгебра",
        description: "Базовый курс",
        status: "published",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);

    renderWithQueryClient(<StudentDashboardScreen />);

    expect(await screen.findByText("Алгебра")).toBeInTheDocument();
    expect(screen.getByText("Базовый курс")).toBeInTheDocument();
    expect(studentApi.listCourses).toHaveBeenCalledTimes(1);
  });

  it("shows request error when courses loading fails", async () => {
    vi.mocked(studentApi.getDashboardOverview).mockResolvedValueOnce({
      courses: [],
      continueLearning: null,
      stats: { totalUnits: 0, availableUnits: 0, inProgressUnits: 0, completedUnits: 0 },
    } as never);
    vi.mocked(studentApi.listCourses).mockRejectedValueOnce(new ApiError(404, "Ошибка загрузки курсов"));

    renderWithQueryClient(<StudentDashboardScreen />);

    expect(await screen.findByRole("status")).toHaveTextContent("Ошибка загрузки курсов");
  });

  it("opens course and renders sections list", async () => {
    vi.mocked(studentApi.getDashboardOverview).mockResolvedValueOnce({
      courses: [],
      continueLearning: null,
      stats: { totalUnits: 0, availableUnits: 0, inProgressUnits: 0, completedUnits: 0 },
    } as never);
    vi.mocked(studentApi.listCourses).mockResolvedValueOnce([
      {
        id: "course-1",
        title: "Алгебра",
        description: null,
        status: "published",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    vi.mocked(studentApi.getCourse).mockResolvedValue({
      id: "course-1",
      title: "Алгебра",
      description: null,
      status: "published",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      sections: [
        {
          id: "section-1",
          courseId: "course-1",
          title: "Линейные уравнения",
          completionPercent: 45,
          accessStatus: "available",
          status: "published",
          sortOrder: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    });

    renderWithQueryClient(<StudentDashboardScreen />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Алгебра/i }));

    expect(await screen.findByText("Линейные уравнения")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Курсы" })).toBeInTheDocument();
    await waitFor(() => {
      expect(studentApi.getCourse).toHaveBeenCalledWith("course-1");
    });
  });

  it("restores graph from localStorage and hydrates section context", async () => {
    window.localStorage.setItem(LAST_SECTION_KEY, "section-1");
    vi.mocked(studentApi.getDashboardOverview).mockResolvedValueOnce({
      courses: [],
      continueLearning: null,
      stats: { totalUnits: 0, availableUnits: 0, inProgressUnits: 0, completedUnits: 0 },
    } as never);
    vi.mocked(studentApi.listCourses).mockResolvedValueOnce([]);
    vi.mocked(studentApi.getCourse).mockResolvedValueOnce({
      id: "course-1",
      title: "Алгебра",
      description: null,
      status: "published",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      sections: [
        {
          id: "section-1",
          courseId: "course-1",
          title: "Линейные уравнения",
          completionPercent: 45,
          accessStatus: "available",
          status: "published",
          sortOrder: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    });
    vi.mocked(studentApi.getSection).mockResolvedValueOnce({
      id: "section-1",
      courseId: "course-1",
      title: "Линейные уравнения",
      accessStatus: "available",
      status: "published",
      sortOrder: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      units: [],
    });

    renderWithQueryClient(<StudentDashboardScreen />);

    expect(await screen.findByTestId("student-graph-panel")).toHaveTextContent("section-1");
    await waitFor(() => {
      expect(studentApi.getSection).toHaveBeenCalledWith("section-1");
    });
    expect(await screen.findByTestId("student-graph-title")).toHaveTextContent("Линейные уравнения");
  });

  it("renders locked sections as unavailable for navigation", async () => {
    vi.mocked(studentApi.getDashboardOverview).mockResolvedValueOnce({
      courses: [],
      continueLearning: null,
      stats: { totalUnits: 0, availableUnits: 0, inProgressUnits: 0, completedUnits: 0 },
    } as never);
    vi.mocked(studentApi.listCourses).mockResolvedValueOnce([
      {
        id: "course-1",
        title: "Алгебра",
        description: null,
        status: "published",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    vi.mocked(studentApi.getCourse).mockResolvedValueOnce({
      id: "course-1",
      title: "Алгебра",
      description: null,
      status: "published",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      sections: [
        {
          id: "section-1",
          courseId: "course-1",
          title: "Линейные уравнения",
          completionPercent: 100,
          accessStatus: "completed",
          status: "published",
          sortOrder: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
        {
          id: "section-2",
          courseId: "course-1",
          title: "Квадратные уравнения",
          completionPercent: 0,
          accessStatus: "locked",
          status: "published",
          sortOrder: 2,
          createdAt: "2026-01-03T00:00:00.000Z",
          updatedAt: "2026-01-04T00:00:00.000Z",
        },
      ],
    });

    renderWithQueryClient(<StudentDashboardScreen />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Алгебра/i }));

    expect(screen.getByRole("button", { name: /Квадратные уравнения/i })).toBeDisabled();
    expect(screen.getByText("Сначала завершите предыдущий раздел")).toBeInTheDocument();
  });

  it("queryOverride disables auto-restore and canonicalizes route", async () => {
    window.localStorage.setItem(LAST_SECTION_KEY, "section-1");
    vi.mocked(studentApi.getDashboardOverview).mockResolvedValueOnce({
      courses: [],
      continueLearning: null,
      stats: { totalUnits: 0, availableUnits: 0, inProgressUnits: 0, completedUnits: 0 },
    } as never);
    vi.mocked(studentApi.listCourses).mockResolvedValueOnce([
      {
        id: "course-1",
        title: "Алгебра",
        description: null,
        status: "published",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);

    renderWithQueryClient(<StudentDashboardScreen queryOverride />);

    expect(await screen.findByText("Алгебра")).toBeInTheDocument();
    expect(screen.queryByTestId("student-graph-panel")).not.toBeInTheDocument();
    expect(studentApi.getSection).not.toHaveBeenCalled();
    expect(replaceMock).toHaveBeenCalledWith("/student");
  });

  it("shows error when course opening fails", async () => {
    vi.mocked(studentApi.getDashboardOverview).mockResolvedValueOnce({
      courses: [],
      continueLearning: null,
      stats: { totalUnits: 0, availableUnits: 0, inProgressUnits: 0, completedUnits: 0 },
    } as never);
    vi.mocked(studentApi.listCourses).mockResolvedValueOnce([
      {
        id: "course-1",
        title: "Алгебра",
        description: null,
        status: "published",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    vi.mocked(studentApi.getCourse).mockRejectedValueOnce(new ApiError(404, "Ошибка загрузки курса"));

    renderWithQueryClient(<StudentDashboardScreen />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Алгебра/i }));

    expect(await screen.findByRole("status")).toHaveTextContent("Ошибка загрузки курса");
  });

  it("returns from graph to sections when course context is known", async () => {
    vi.mocked(studentApi.getDashboardOverview).mockResolvedValueOnce({
      courses: [],
      continueLearning: null,
      stats: { totalUnits: 0, availableUnits: 0, inProgressUnits: 0, completedUnits: 0 },
    } as never);
    vi.mocked(studentApi.listCourses).mockResolvedValueOnce([
      {
        id: "course-1",
        title: "Алгебра",
        description: null,
        status: "published",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);
    vi.mocked(studentApi.getCourse).mockResolvedValue({
      id: "course-1",
      title: "Алгебра",
      description: null,
      status: "published",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      sections: [
        {
          id: "section-1",
          courseId: "course-1",
          title: "Линейные уравнения",
          accessStatus: "available",
          status: "published",
          sortOrder: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    });
    vi.mocked(studentApi.getSection).mockResolvedValueOnce({
      id: "section-1",
      courseId: "course-1",
      title: "Линейные уравнения",
      accessStatus: "available",
      status: "published",
      sortOrder: 1,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      units: [],
    });

    renderWithQueryClient(<StudentDashboardScreen />);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Алгебра/i }));
    await user.click(await screen.findByRole("button", { name: /Линейные уравнения/i }));

    expect(await screen.findByTestId("student-graph-panel")).toHaveTextContent("section-1");

    await user.click(screen.getByRole("button", { name: "Назад к разделам" }));

    expect(await screen.findByText("Линейные уравнения")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Курсы" })).toBeInTheDocument();
  });
});
