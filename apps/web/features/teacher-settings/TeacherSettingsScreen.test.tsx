import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { teacherApi } from "@/lib/api/teacher";
import type * as TeacherApiModule from "@/lib/api/teacher";
import { renderWithQueryClient } from "@/test/render-with-query-client";
import TeacherSettingsScreen from "./TeacherSettingsScreen";

vi.mock("@/components/TeacherDashboardShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/features/teacher-content/auth/use-teacher-logout", () => ({
  useTeacherLogout: () => vi.fn(),
}));

vi.mock("@/lib/api/teacher", async () => {
  const actual = await vi.importActual<typeof TeacherApiModule>("@/lib/api/teacher");
  return {
    ...actual,
    teacherApi: {
      ...actual.teacherApi,
      getTeacherMe: vi.fn(),
      updateTeacherMeProfile: vi.fn(),
      changeTeacherMyPassword: vi.fn(),
    },
  };
});

describe("TeacherSettingsScreen", () => {
  beforeEach(() => {
    vi.mocked(teacherApi.getTeacherMe).mockResolvedValue({
      user: { id: "teacher-1", login: "teacher1", role: "teacher" },
      profile: { firstName: "Анна", lastName: "Петрова", middleName: "Игоревна" },
    } as never);
  });

  it("shows only the teacher profile and password controls", async () => {
    renderWithQueryClient(<TeacherSettingsScreen />);

    expect(await screen.findByText("Настройки преподавателя")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Петрова")).toBeInTheDocument();
    expect(screen.getByText("Смена пароля")).toBeInTheDocument();
    expect(screen.queryByText("Создать преподавателя")).not.toBeInTheDocument();
    expect(screen.queryByText("Список преподавателей")).not.toBeInTheDocument();
  });
});
