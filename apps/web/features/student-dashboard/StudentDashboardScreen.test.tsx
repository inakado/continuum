import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { studentApi } from "@/lib/api/student";
import type * as StudentApiModule from "@/lib/api/student";
import { renderWithQueryClient } from "@/test/render-with-query-client";
import StudentDashboardScreen from "./StudentDashboardScreen";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("next/dynamic", () => ({
  default: () => (props: { sectionId: string }) => <div data-testid="student-graph-panel">{props.sectionId}</div>,
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
    vi.mocked(studentApi.getCourse).mockReset();
    vi.mocked(studentApi.getSection).mockReset();
    window.localStorage.clear();
    window.history.replaceState(null, "", "/student");
  });

  it("loads and shows student courses", async () => {
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
    vi.mocked(studentApi.listCourses).mockRejectedValueOnce(new ApiError(404, "Ошибка загрузки курсов"));

    renderWithQueryClient(<StudentDashboardScreen />);

    expect(await screen.findByRole("status")).toHaveTextContent("Ошибка загрузки курсов");
  });

  it("opens course and renders sections list", async () => {
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
    expect(screen.getByRole("button", { name: "← Курсы" })).toBeInTheDocument();
    await waitFor(() => {
      expect(studentApi.getCourse).toHaveBeenCalledWith("course-1");
    });
  });
});
