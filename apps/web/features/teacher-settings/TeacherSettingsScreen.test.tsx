import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { teacherApi } from "@/lib/api/teacher";
import type * as TeacherApiModule from "@/lib/api/teacher";
import { renderWithQueryClient } from "@/test/render-with-query-client";
import TeacherSettingsScreen from "./TeacherSettingsScreen";

const logoutMock = vi.fn();

vi.mock("@/components/TeacherDashboardShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/AlertDialog", () => ({
  default: ({
    open,
    title,
    onConfirm,
    onOpenChange,
    confirmText = "Подтвердить",
    cancelText = "Отмена",
  }: {
    open: boolean;
    title: React.ReactNode;
    onConfirm: () => void;
    onOpenChange: (open: boolean) => void;
    confirmText?: string;
    cancelText?: string;
  }) =>
    open ? (
      <div>
        <div>{title}</div>
        <button type="button" onClick={() => onOpenChange(false)}>
          {cancelText}
        </button>
        <button type="button" onClick={onConfirm}>
          {confirmText}
        </button>
      </div>
    ) : null,
}));

vi.mock("@/features/teacher-content/auth/use-teacher-logout", () => ({
  useTeacherLogout: () => logoutMock,
}));

vi.mock("@/lib/api/teacher", async () => {
  const actual = await vi.importActual<typeof TeacherApiModule>("@/lib/api/teacher");
  return {
    ...actual,
    teacherApi: {
      ...actual.teacherApi,
      getTeacherMe: vi.fn(),
      listTeachers: vi.fn(),
      changeTeacherMyPassword: vi.fn(),
      createTeacher: vi.fn(),
      deleteTeacher: vi.fn(),
    },
  };
});

const meResponse = {
  user: {
    id: "teacher-1",
    login: "teacher1",
    role: "teacher",
  },
  profile: {
    firstName: "Анна",
    lastName: "Петрова",
    middleName: "Игоревна",
  },
} as const;

const teachersResponse = [
  {
    id: "teacher-1",
    login: "teacher1",
    firstName: "Анна",
    lastName: "Петрова",
    middleName: "Игоревна",
  },
  {
    id: "teacher-2",
    login: "teacher2",
    firstName: "Борис",
    lastName: "Сидоров",
    middleName: null,
  },
] as const;

describe("TeacherSettingsScreen", () => {
  beforeEach(() => {
    logoutMock.mockReset();
    vi.useRealTimers();
    vi.mocked(teacherApi.getTeacherMe).mockReset();
    vi.mocked(teacherApi.listTeachers).mockReset();
    vi.mocked(teacherApi.changeTeacherMyPassword).mockReset();
    vi.mocked(teacherApi.createTeacher).mockReset();
    vi.mocked(teacherApi.deleteTeacher).mockReset();
    vi.mocked(teacherApi.getTeacherMe).mockResolvedValue(meResponse as never);
    vi.mocked(teacherApi.listTeachers).mockResolvedValue(teachersResponse as never);
  });

  it("loads teacher profile and teachers list", async () => {
    renderWithSettings();

    expect(await screen.findByText("Настройки преподавателя")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Петрова")).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Анна")).toBeInTheDocument();
    expect(screen.getByText("Сидоров Борис")).toBeInTheDocument();
    expect(screen.getByText("Вы")).toBeInTheDocument();
  });

  it("creates teacher, refreshes list and shows generated password", async () => {
    vi.mocked(teacherApi.listTeachers)
      .mockResolvedValueOnce(teachersResponse as never)
      .mockResolvedValueOnce([
        ...teachersResponse,
        {
          id: "teacher-3",
          login: "teacher3",
          firstName: "Вера",
          lastName: "Орлова",
          middleName: null,
        },
      ] as never);
    vi.mocked(teacherApi.createTeacher).mockResolvedValue({
      id: "teacher-3",
      login: "teacher3",
      firstName: "Вера",
      lastName: "Орлова",
      middleName: null,
      password: "Temp123!",
    } as never);

    renderWithSettings();
    const user = userEvent.setup();

    await screen.findByText("Настройки преподавателя");

    const createSection = screen.getAllByText("Создать преподавателя")[0].closest("section");
    expect(createSection).not.toBeNull();
    const createScope = within(createSection as HTMLElement);

    await user.type(createScope.getByLabelText("Логин"), "teacher3");
    await user.type(createScope.getByLabelText("Фамилия"), "Орлова");
    await user.type(createScope.getByLabelText("Имя"), "Вера");
    await user.click(createScope.getByRole("button", { name: "Создать преподавателя" }));

    await waitFor(() => {
      expect(teacherApi.createTeacher).toHaveBeenCalledWith({
        login: "teacher3",
        firstName: "Вера",
        lastName: "Орлова",
        middleName: null,
        password: null,
        generatePassword: true,
      });
    });
    expect(await screen.findByText("Преподаватель teacher3 создан.")).toBeInTheDocument();
    expect(screen.getByText("Temp123!")).toBeInTheDocument();
    expect(await screen.findByText("Орлова Вера")).toBeInTheDocument();
  }, 10000);

  it("deletes another teacher after confirmation", async () => {
    vi.mocked(teacherApi.listTeachers)
      .mockResolvedValueOnce(teachersResponse as never)
      .mockResolvedValueOnce([teachersResponse[0]] as never);
    vi.mocked(teacherApi.deleteTeacher).mockResolvedValue({
      id: "teacher-2",
      login: "teacher2",
    } as never);

    renderWithSettings();
    const user = userEvent.setup();

    await screen.findByText("Сидоров Борис");

    await user.click(screen.getByRole("button", { name: "Удалить" }));
    expect(screen.getByText("Удалить преподавателя teacher2?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Удалить преподавателя" }));

    await waitFor(() => {
      expect(teacherApi.deleteTeacher).toHaveBeenCalledWith("teacher-2");
    });
    await waitFor(() => {
      expect(screen.queryByText("Сидоров Борис")).not.toBeInTheDocument();
    });
    expect(await screen.findByText("Преподаватель teacher2 удалён.")).toBeInTheDocument();
  });
});

function renderWithSettings() {
  return renderWithQueryClient(<TeacherSettingsScreen />);
}
