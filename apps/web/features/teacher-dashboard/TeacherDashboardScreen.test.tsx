import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentQueryKeys } from "@/lib/query/keys";
import { teacherApi } from "@/lib/api/teacher";
import type * as TeacherApiModule from "@/lib/api/teacher";
import { renderWithQueryClient } from "@/test/render-with-query-client";
import TeacherDashboardScreen from "./TeacherDashboardScreen";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("next/dynamic", () => ({
  default: () => () => <div data-testid="teacher-graph-panel" />,
}));

vi.mock("@/components/DashboardShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/AlertDialog", () => ({
  default: () => null,
}));

vi.mock("@/features/teacher-content/auth/use-teacher-logout", () => ({
  useTeacherLogout: () => vi.fn(),
}));

vi.mock("@/features/teacher-content/shared/use-teacher-identity", () => ({
  useTeacherIdentity: () => ({
    displayName: "Teacher One",
  }),
}));

vi.mock("@/features/teacher-students/TeacherStudentsPanel", () => ({
  default: () => <div>students panel</div>,
}));

vi.mock("@/features/teacher-review/TeacherReviewInboxPanel", () => ({
  default: () => <div>review inbox</div>,
}));

vi.mock("@/features/teacher-review/TeacherReviewSubmissionDetailPanel", () => ({
  default: () => <div>review submission</div>,
}));

vi.mock("@/lib/api/teacher", async () => {
  const actual = await vi.importActual<typeof TeacherApiModule>("@/lib/api/teacher");
  return {
    ...actual,
    teacherApi: {
      ...actual.teacherApi,
      listCourses: vi.fn(),
      getCourse: vi.fn(),
      createCourse: vi.fn(),
    },
  };
});

describe("TeacherDashboardScreen", () => {
  const replaceMock = vi.fn();
  const pushMock = vi.fn();

  beforeEach(() => {
    replaceMock.mockReset();
    pushMock.mockReset();
    vi.mocked(useRouter).mockReturnValue({ replace: replaceMock, push: pushMock } as never);
    vi.mocked(teacherApi.listCourses).mockReset();
    vi.mocked(teacherApi.getCourse).mockReset();
    vi.mocked(teacherApi.createCourse).mockReset();
    window.history.replaceState(null, "", "/teacher");
  });

  it("renders teacher courses list in edit mode", async () => {
    vi.mocked(teacherApi.listCourses).mockResolvedValueOnce([
      {
        id: "course-1",
        title: "Алгебра",
        description: "Базовый курс",
        status: "draft",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);

    renderWithQueryClient(<TeacherDashboardScreen active="edit" />);

    expect(await screen.findByText("Алгебра")).toBeInTheDocument();
    expect(screen.getByText("Базовый курс")).toBeInTheDocument();
  });

  it("creates course and invalidates teacher courses query", async () => {
    vi.mocked(teacherApi.listCourses).mockResolvedValue([]);
    vi.mocked(teacherApi.createCourse).mockResolvedValueOnce({
      id: "course-2",
      title: "Геометрия",
      description: "Новый курс",
      status: "draft",
      createdAt: "2026-01-03T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
    } as never);
    vi.mocked(teacherApi.getCourse).mockResolvedValue({
      id: "course-2",
      title: "Геометрия",
      description: "Новый курс",
      status: "draft",
      createdAt: "2026-01-03T00:00:00.000Z",
      updatedAt: "2026-01-03T00:00:00.000Z",
      sections: [],
    } as never);

    const { queryClient } = renderWithQueryClient(<TeacherDashboardScreen active="edit" />);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();

    expect(await screen.findByText("Пока нет курсов. Создайте первый.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Создать курс" }));
    await user.type(screen.getByLabelText("Название курса"), "Геометрия");
    await user.type(screen.getByLabelText("Описание курса"), "Новый курс");
    await user.click(screen.getByRole("button", { name: "Сохранить курс" }));

    await waitFor(() => {
      expect(teacherApi.createCourse).toHaveBeenCalledWith({
        title: "Геометрия",
        description: "Новый курс",
      });
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: contentQueryKeys.teacherCourses(),
      });
    });
  });
});
