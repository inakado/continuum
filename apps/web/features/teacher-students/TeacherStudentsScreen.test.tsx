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
  isActive: true,
  gradeBands: ["grade_8" as const],
};

describe("StudentRows", () => {
  it("shows identity, grade access and account state controls", () => {
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

    expect(screen.getByText("Иван Иванов")).toBeInTheDocument();
    expect(screen.getByText("student.one")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "8 класс: доступ выдан" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "9 класс: доступ закрыт" }));
    expect(onSetAccess).toHaveBeenCalledWith(student, "grade_9", true);

    fireEvent.click(screen.getByRole("button", { name: "Отключить" }));
    expect(onSetActive).toHaveBeenCalledWith(student);
  });
});
