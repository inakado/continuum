import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StudentRows } from "./TeacherStudentsScreen";

const student = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  login: "student.one",
  name: "Иван Иванов",
  firstName: "Иван",
  lastName: "Иванов",
  middleName: null,
  classId: null,
  isActive: true,
  gradeBands: ["grade_8" as const],
};

describe("StudentRows", () => {
  it("shows identity, grade access and account state controls", async () => {
    const onSetAccess = vi.fn();
    const onSetActive = vi.fn();
    render(
      <StudentRows
        busy={false}
        onSetAccess={onSetAccess}
        onSetActive={onSetActive}
        students={[student]}
      />,
    );

    expect(screen.getByText("Иванов Иван")).toBeInTheDocument();
    expect(screen.getByText("student.one")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "8 класс: доступ выдан" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "9 класс: доступ закрыт" }));
    expect(onSetAccess).toHaveBeenCalledWith(student, "grade_9", true);

    fireEvent.keyDown(screen.getByRole("button", { name: "Действия: Иван Иванов" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Отключить" }));
    expect(onSetActive).toHaveBeenCalledWith(student);
  });
  it("offers separate class removal and account deletion", async () => {
    const onSetClass = vi.fn();
    const onDelete = vi.fn();
    const enrolled = { ...student, classId: "123e4567-e89b-12d3-a456-426614174001" };
    render(<StudentRows students={[enrolled]} busy={false} onSetClass={onSetClass} onDelete={onDelete} onSetActive={vi.fn()} onSetAccess={vi.fn()} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Действия: Иван Иванов" }), { key: "Enter" });
    expect(await screen.findByRole("menuitem", { name: "Удалить ученика" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("menuitem", { name: "Убрать из класса" }));
    expect(onSetClass).toHaveBeenCalledWith(enrolled, null);
    expect(onDelete).not.toHaveBeenCalled();
  });
});
