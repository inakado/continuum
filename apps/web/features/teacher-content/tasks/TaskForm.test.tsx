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

  it("renders method guidance after the answer editing section", () => {
    render(<TaskForm title="Новая задача" submitLabel="Сохранить" onSubmit={vi.fn()} />);

    const answerInput = screen.getByLabelText("Правильный ответ");
    const methodGuidanceInput = screen.getByLabelText("Подсказка для ученика");
    const position = answerInput.compareDocumentPosition(methodGuidanceInput);

    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("autosaves before returning to tasks when the form has valid changes", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    const onCancel = vi.fn();

    render(
      <TaskForm
        title="Новая задача"
        submitLabel="Сохранить"
        onSubmit={onSubmit}
        onCancel={onCancel}
        cancelLabel="К задачам"
      />,
    );
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Текст условия (KaTeX)"), "x+1=2");
    await user.type(screen.getByLabelText("Правильный ответ"), "1");
    await user.click(screen.getByRole("button", { name: "К задачам" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          statementLite: "x+1=2",
          answerType: "numeric",
        }),
      );
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });
});
