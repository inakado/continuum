import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import {
  StudentUnitContextPanel,
  UNIT_CONTEXT_COLLAPSED_STORAGE_KEY,
} from "./StudentUnitContextPanel";

const props = {
  title: "Векторы в физике",
  description: "Сложение и разложение векторов.",
  showProgress: true,
  completionMeter: 64,
  requiredDone: 2,
  requiredTotal: 3,
  solvedTasks: 4,
  totalTasks: 6,
};

describe("StudentUnitContextPanel", () => {
  beforeEach(() => {
    window.localStorage.removeItem(UNIT_CONTEXT_COLLAPSED_STORAGE_KEY);
  });

  it("collapses detailed context into a compact progress row and persists the choice", async () => {
    render(<StudentUnitContextPanel {...props} />);
    const user = userEvent.setup();

    expect(screen.getByText(props.description)).toBeInTheDocument();
    expect(screen.getByLabelText("Прогресс юнита")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Свернуть сведения о юните" }));

    expect(screen.queryByText(props.description)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Прогресс юнита")).not.toBeVisible();
    expect(screen.getByLabelText("Краткий прогресс юнита")).toHaveTextContent("64%");
    expect(screen.getByLabelText("Краткий прогресс юнита")).toHaveTextContent("4/6");
    expect(screen.getByLabelText("Краткий прогресс юнита")).toHaveTextContent("2/3");
    expect(screen.getByRole("button", { name: "Развернуть сведения о юните" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await waitFor(() => {
      expect(window.localStorage.getItem(UNIT_CONTEXT_COLLAPSED_STORAGE_KEY)).toBe("true");
    });
  });

  it("restores the saved compact mode", async () => {
    window.localStorage.setItem(UNIT_CONTEXT_COLLAPSED_STORAGE_KEY, "true");
    render(<StudentUnitContextPanel {...props} />);

    expect(
      await screen.findByRole("button", { name: "Развернуть сведения о юните" }),
    ).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByLabelText("Прогресс юнита")).not.toBeVisible();
  });
});
