import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminApi } from "@/lib/api/admin";
import type * as AdminApiModule from "@/lib/api/admin";
import { renderWithQueryClient } from "@/test/render-with-query-client";
import AdminTeachersScreen from "./AdminTeachersScreen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/components/TeacherDashboardShell", () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/ui/AlertDialog", () => ({
  default: ({ open, title, onConfirm, confirmText }: { open: boolean; title: React.ReactNode; onConfirm: () => void; confirmText: string }) =>
    open ? <div><div>{title}</div><button type="button" onClick={onConfirm}>{confirmText}</button></div> : null,
}));
vi.mock("@/lib/api/admin", async () => {
  const actual = await vi.importActual<typeof AdminApiModule>("@/lib/api/admin");
  return {
    ...actual,
    adminApi: { listTeachers: vi.fn(), createTeacher: vi.fn(), deleteTeacher: vi.fn() },
  };
});

const teachers = [
  { id: "teacher-1", login: "teacher1", firstName: "Анна", lastName: "Петрова", middleName: null },
  { id: "teacher-2", login: "teacher2", firstName: "Борис", lastName: "Сидоров", middleName: null },
];

describe("AdminTeachersScreen", () => {
  beforeEach(() => {
    vi.mocked(adminApi.listTeachers).mockReset();
    vi.mocked(adminApi.createTeacher).mockReset();
    vi.mocked(adminApi.deleteTeacher).mockReset();
    vi.mocked(adminApi.listTeachers).mockResolvedValue(teachers as never);
  });

  it("creates a teacher and shows the generated password", async () => {
    vi.mocked(adminApi.createTeacher).mockResolvedValue({
      id: "teacher-3", login: "teacher3", firstName: "Вера", lastName: "Орлова", middleName: null, password: "Temp123!",
    } as never);
    const user = userEvent.setup();
    renderWithQueryClient(<AdminTeachersScreen />);

    const section = (await screen.findByText("Новый преподаватель")).closest("section");
    const scope = within(section as HTMLElement);
    await user.type(scope.getByLabelText("Логин"), "teacher3");
    await user.type(scope.getByLabelText("Фамилия"), "Орлова");
    await user.type(scope.getByLabelText("Имя"), "Вера");
    await user.click(scope.getByRole("button", { name: "Создать" }));

    await waitFor(() => expect(adminApi.createTeacher).toHaveBeenCalledWith(expect.objectContaining({ login: "teacher3" })));
    expect(await screen.findByText("Temp123!")).toBeInTheDocument();
  });

  it("deletes a teacher after confirmation", async () => {
    vi.mocked(adminApi.deleteTeacher).mockResolvedValue(teachers[1] as never);
    const user = userEvent.setup();
    renderWithQueryClient(<AdminTeachersScreen />);

    await screen.findByText("Сидоров Борис");
    await user.click(screen.getAllByRole("button", { name: "Удалить" })[1]);
    await user.click(screen.getByText("Удалить teacher2?").parentElement!.querySelector("button")!);

    await waitFor(() => expect(adminApi.deleteTeacher).toHaveBeenCalledWith("teacher-2"));
  });
});
