import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render as baseRender, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { SchoolClass, TeacherStudent } from "@continuum/shared";
import TeacherStudentsScreen from "./TeacherStudentsScreen";

const data = vi.hoisted(() => ({ classes: [] as SchoolClass[], students: [] as TeacherStudent[] }));
vi.mock("@/components/ContinuumHeader", () => ({ default: () => null }));
vi.mock("./use-teacher-students", () => {
  const mutation = () => ({ isPending: false, error: null, mutate: vi.fn() });
  return {
    useTeacherStudents: () => ({ data: { students: data.students } }),
    useSchoolClasses: () => ({ data: { classes: data.classes } }),
    useSetStudentActive: mutation, useSetStudentAccess: mutation, useSetStudentClass: mutation,
    useUpdateSchoolClass: mutation, useResetStudentPassword: mutation,
    useDeleteSchoolClass: mutation,
  };
});
afterEach(() => { cleanup(); data.classes = []; data.students = []; });

it("groups classes and filters archived pupils without a separate archive switch", () => {
  data.classes = [
    { id: "current", title: "11А", grade: 11, academicYear: 2026, isArchived: false, studentCount: 1 },
    { id: "archived", title: "11Б", grade: 11, academicYear: 2025, isArchived: true, studentCount: 1 },
  ];
  data.students = data.classes.map((item, index) => ({
    id: `pupil-${index}`, login: `pupil${index}`, name: `Ученик ${index}`, firstName: null,
    lastName: null, middleName: null, classId: item.id, isActive: true, gradeBands: [],
  }));
  render(<TeacherStudentsScreen />);
  const select = screen.getByRole("combobox", { name: "Класс" });
  const current = within(select).getByRole("group", { name: "Текущие классы" });
  const archived = within(select).getByRole("group", { name: "Архивные классы" });
  expect(within(current).getByRole("option")).toHaveValue("current");
  expect(within(archived).getByRole("option")).toHaveValue("archived");
  expect(screen.queryByRole("button", { name: /Показать архив|Скрыть архив/ })).not.toBeInTheDocument();

  fireEvent.change(select, { target: { value: "archived" } });
  expect(screen.getByRole("heading", { name: "11Б · Архив" })).toBeInTheDocument();
  expect(screen.getByText("pupil1")).toBeInTheDocument();
  expect(screen.queryByText("pupil0")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Восстановить" })).toBeInTheDocument();

  fireEvent.change(select, { target: { value: "current" } });
  expect(screen.getByText("pupil0")).toBeInTheDocument();
  expect(screen.queryByText("pupil1")).not.toBeInTheDocument();
});

it("omits empty class groups and keeps all-pupils and no-class filters", () => {
  render(<TeacherStudentsScreen />);
  const select = within(screen.getByRole("combobox", { name: "Класс" }));
  expect(select.queryByRole("group")).not.toBeInTheDocument();
  expect(select.getByRole("option", { name: "Все ученики" })).toBeInTheDocument();
  expect(select.getByRole("option", { name: "Без класса" })).toBeInTheDocument();
});

function render(ui: Parameters<typeof baseRender>[0]) { return baseRender(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{ui}</QueryClientProvider>); }
