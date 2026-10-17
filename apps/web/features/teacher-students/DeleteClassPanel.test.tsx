import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DeleteClassPanel from "./DeleteClassPanel";

const schoolClass = { id: "123e4567-e89b-12d3-a456-426614174001", title: "11А", grade: 11, academicYear: 2026, studentCount: 19, isArchived: false };
describe("class deletion confirmation", () => {
  it("preserves pupil accounts unless the teacher explicitly opts in", () => {
    const onConfirm = vi.fn();
    render(<DeleteClassPanel schoolClass={schoolClass} busy={false} onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Удалить класс" }));
    expect(onConfirm).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Удалить класс и учеников" }));
    expect(onConfirm).toHaveBeenLastCalledWith(true);
  });
});
