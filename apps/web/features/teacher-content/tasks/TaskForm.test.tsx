import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TaskForm from "./TaskForm";

describe("TaskForm", () => {
  it("submits method guidance together with the task payload", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <TaskForm
        title="Новая задача"
        submitLabel="Сохранить"
        onSubmit={onSubmit}
      />,
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Текст условия (KaTeX)"), "x+1=2");
    await user.type(screen.getByLabelText("Подсказка для ученика"), "Сначала перенесите единицу вправо.");
    await user.type(screen.getByLabelText("Правильный ответ"), "1");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          statementLite: "x+1=2",
          methodGuidance: "Сначала перенесите единицу вправо.",
          answerType: "numeric",
        }),
      );
    });
  });
});
