import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SchoolClassWizard } from "./SchoolClassWizard";
import { credentialsCsv } from "./student-credentials";
import { ApiError } from "@/lib/api/client";

const mutation = vi.hoisted(() => ({ mutateAsync: vi.fn(), reset: vi.fn(), isPending: false }));
vi.mock("./use-teacher-students", () => ({ useBulkCreateStudents: () => mutation }));
const id = "123e4567-e89b-12d3-a456-426614174000";
afterEach(() => { cleanup(); vi.clearAllMocks(); });

function start() {
  render(<SchoolClassWizard classes={[]} onClose={vi.fn()} />);
  fireEvent.change(screen.getByRole("textbox", { name: "Название" }), { target: { value: "8А" } });
  fireEvent.change(screen.getByRole("textbox", { name: "Список учеников" }), { target: { value: "Иванов Иван Иванович\nИванов Иван Иванович" } });
  fireEvent.click(screen.getByRole("button", { name: /Проверить список/ }));
}
describe("bulk student workflow", () => {
  it("does not create before review; permits namesakes and edited names", async () => {
    start(); expect(mutation.mutateAsync).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Имя, строка 2" }), { target: { value: "Пётр" } });
    mutation.mutateAsync.mockResolvedValue({ classId: id, studentIds: [id], credentials: [{ id, name: "Иванов Иван", login: "s.demo", password: "demo-password" }], replayed: false });
    fireEvent.click(screen.getByRole("button", { name: "Создать класс и учеников" }));
    await screen.findByText("Доступы готовы");
    expect(mutation.mutateAsync.mock.calls[0][0].students).toHaveLength(2);
    expect(mutation.mutateAsync.mock.calls[0][0].students[1].firstName).toBe("Пётр");
    expect(screen.getAllByText("demo-password")).toHaveLength(2); // Table and print-only card.
  });
  it("retries an uncertain result with the same key and frozen payload", async () => {
    start(); mutation.mutateAsync.mockRejectedValueOnce(new TypeError("Соединение прервано"));
    fireEvent.click(screen.getByRole("button", { name: "Создать класс и учеников" }));
    await screen.findByText("Соединение прервано");
    expect(screen.getByRole("textbox", { name: "Имя, строка 1" })).toBeDisabled();
    mutation.mutateAsync.mockResolvedValueOnce({ classId: id, studentIds: [id], credentials: null, replayed: true });
    fireEvent.click(screen.getByRole("button", { name: "Повторить запрос" }));
    await screen.findByText("Ученики уже созданы");
    expect(mutation.mutateAsync.mock.calls[0][0]).toEqual(mutation.mutateAsync.mock.calls[1][0]);
    expect(screen.queryByRole("button", { name: /Скачать/ })).not.toBeInTheDocument();
  });
  it("permits correction after a definite validation conflict", async () => {
    start(); mutation.mutateAsync.mockRejectedValueOnce(new ApiError(409, "Класс уже есть", "CLASS_TITLE_TAKEN"));
    fireEvent.click(screen.getByRole("button", { name: "Создать класс и учеников" }));
    await screen.findByText("Класс уже есть");
    await waitFor(() => expect(screen.getByRole("button", { name: "Назад" })).toBeEnabled());
  });
  it("exports Russian CSV with formula protection and quoted cells", () => {
    const csv = credentialsCsv([{ id, name: '=HYPERLINK("bad")', login: "s.demo", password: "demo" }], "8А");
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""bad"")"`);
    expect(csv).toContain('"Начальный пароль"');
  });
});
