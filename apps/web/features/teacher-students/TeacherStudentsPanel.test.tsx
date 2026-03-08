import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentQueryKeys } from "@/lib/query/keys";
import { teacherApi } from "@/lib/api/teacher";
import type * as TeacherApiModule from "@/lib/api/teacher";
import { renderWithQueryClient } from "@/test/render-with-query-client";
import TeacherStudentsPanel from "./TeacherStudentsPanel";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("./TeacherStudentProfilePanel", () => ({
  default: () => <div>profile panel</div>,
}));

vi.mock("@/components/ui/DropdownMenu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onSelect,
    disabled,
  }: {
    children: React.ReactNode;
    onSelect?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={() => onSelect?.()} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/Select", () => ({
  default: ({
    value,
    onValueChange,
    options,
    disabled,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    disabled?: boolean;
  }) => (
    <select
      aria-label="Новый ведущий"
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      disabled={disabled}
    >
      {options.map((option) => (
        <option key={option.value || "empty"} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
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

vi.mock("@/components/ui/Dialog", () => ({
  default: ({
    open,
    title,
    children,
  }: {
    open: boolean;
    title?: React.ReactNode;
    children: React.ReactNode;
  }) =>
    open ? (
      <div role="dialog" aria-label={typeof title === "string" ? title : "dialog"}>
        {title ? <div>{title}</div> : null}
        {children}
      </div>
    ) : null,
}));

vi.mock("@/lib/api/teacher", async () => {
  const actual = await vi.importActual<typeof TeacherApiModule>("@/lib/api/teacher");
  return {
    ...actual,
    teacherApi: {
      ...actual.teacherApi,
      listStudents: vi.fn(),
      listTeachers: vi.fn(),
      createStudent: vi.fn(),
      transferStudent: vi.fn(),
      updateStudentProfile: vi.fn(),
      deleteStudent: vi.fn(),
      resetStudentPassword: vi.fn(),
    },
  };
});

const studentsResponse = [
  {
    id: "student-1",
    login: "student1",
    firstName: "Иван",
    lastName: "Иванов",
    leadTeacherId: "teacher-1",
    leadTeacherLogin: "teacher1",
    leadTeacherDisplayName: "Teacher One",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    activeNotificationsCount: 0,
    pendingPhotoReviewCount: 1,
  },
] as const;

const teachersResponse = [
  {
    id: "teacher-1",
    login: "teacher1",
    firstName: "Teacher",
    lastName: "One",
    middleName: null,
  },
  {
    id: "teacher-2",
    login: "teacher2",
    firstName: "Teacher",
    lastName: "Two",
    middleName: null,
  },
] as const;

describe("TeacherStudentsPanel", () => {
  const pushMock = vi.fn();

  beforeEach(() => {
    pushMock.mockReset();
    vi.mocked(useRouter).mockReturnValue({ push: pushMock } as never);
    vi.mocked(teacherApi.listStudents).mockReset();
    vi.mocked(teacherApi.listTeachers).mockReset();
    vi.mocked(teacherApi.createStudent).mockReset();
    vi.mocked(teacherApi.transferStudent).mockReset();
    vi.mocked(teacherApi.updateStudentProfile).mockReset();
    vi.mocked(teacherApi.deleteStudent).mockReset();
    vi.mocked(teacherApi.resetStudentPassword).mockReset();
    vi.mocked(teacherApi.listStudents).mockResolvedValue(studentsResponse as never);
    vi.mocked(teacherApi.listTeachers).mockResolvedValue(teachersResponse as never);
  });

  it("creates student and invalidates students list query", async () => {
    vi.mocked(teacherApi.createStudent).mockResolvedValue({
      id: "student-2",
      login: "student2",
      leadTeacherId: "teacher-1",
      firstName: "Пётр",
      lastName: "Петров",
      password: "Pass123!",
    } as never);

    const { queryClient } = renderWithQueryClient(<TeacherStudentsPanel />);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();

    expect(await screen.findByText("Иванов Иван")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Добавить ученика" }));
    expect(screen.getByRole("dialog", { name: "Создание ученика" })).toBeInTheDocument();
    await user.type(screen.getByLabelText("Логин ученика"), "student2");
    await user.type(screen.getByLabelText("Имя"), "Пётр");
    await user.type(screen.getByLabelText("Фамилия"), "Петров");
    await user.click(screen.getByRole("button", { name: "Создать" }));

    await waitFor(() => {
      expect(teacherApi.createStudent).toHaveBeenCalledWith({
        login: "student2",
        firstName: "Пётр",
        lastName: "Петров",
      });
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: contentQueryKeys.teacherStudentsList(),
      });
    });
    expect(await screen.findByRole("dialog", { name: "Новый ученик создан" })).toBeInTheDocument();
    expect(screen.getByText("Pass123!")).toBeInTheDocument();
  }, 10000);

  it("transfers student to another teacher and refreshes list", async () => {
    vi.mocked(teacherApi.transferStudent).mockResolvedValue({
      id: "student-1",
      login: "student1",
      leadTeacherId: "teacher-2",
      leadTeacherLogin: "teacher2",
    } as never);

    const { queryClient } = renderWithQueryClient(<TeacherStudentsPanel />);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();

    expect(await screen.findByText("Иванов Иван")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Передать" }));
    await user.selectOptions(screen.getByLabelText("Новый ведущий"), "teacher-2");
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    await waitFor(() => {
      expect(teacherApi.transferStudent).toHaveBeenCalledWith("student-1", {
        leaderTeacherId: "teacher-2",
      });
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: contentQueryKeys.teacherStudentsList(),
      });
    });
  });

  it("edits student profile and refreshes students list", async () => {
    vi.mocked(teacherApi.updateStudentProfile).mockResolvedValue({
      id: "student-1",
      firstName: "Пётр",
      lastName: "Петров",
    } as never);

    const { queryClient } = renderWithQueryClient(<TeacherStudentsPanel />);
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();

    expect(await screen.findByText("Иванов Иван")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Редактировать" }));
    expect(screen.getByRole("dialog", { name: "Редактирование ученика student1" })).toBeInTheDocument();
    const [firstNameInput, lastNameInput] = screen.getAllByRole("textbox", { name: /Имя|Фамилия/ });
    await user.clear(firstNameInput);
    await user.type(firstNameInput, "Пётр");
    await user.clear(lastNameInput);
    await user.type(lastNameInput, "Петров");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(teacherApi.updateStudentProfile).toHaveBeenCalledWith("student-1", {
        firstName: "Пётр",
        lastName: "Петров",
      });
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: contentQueryKeys.teacherStudentsList(),
      });
    });
  });

  it("resets student password and shows reveal panel", async () => {
    vi.mocked(teacherApi.resetStudentPassword).mockResolvedValue({
      id: "student-1",
      login: "student1",
      password: "Reset123!",
    } as never);

    renderWithQueryClient(<TeacherStudentsPanel />);
    const user = userEvent.setup();

    expect(await screen.findByText("Иванов Иван")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Сбросить пароль" }));
    expect(screen.getByText("Сбросить пароль для student1?")).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Сбросить пароль" })[1]);

    await waitFor(() => {
      expect(teacherApi.resetStudentPassword).toHaveBeenCalledWith("student-1");
    });
    expect(await screen.findByRole("dialog", { name: "Пароль обновлён" })).toBeInTheDocument();
    expect(screen.getByText("Reset123!")).toBeInTheDocument();
  });

  it("navigates to review inbox and student profile routes", async () => {
    renderWithQueryClient(<TeacherStudentsPanel />);
    const user = userEvent.setup();

    expect(await screen.findByText("Иванов Иван")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "К проверке фото" }));
    expect(pushMock).toHaveBeenCalledWith("/teacher/review?status=pending_review&sort=oldest&studentId=student-1");

    pushMock.mockReset();
    await user.click(screen.getByText("Иванов Иван"));
    expect(pushMock).toHaveBeenCalledWith("/teacher/students/student-1");
  });
});
