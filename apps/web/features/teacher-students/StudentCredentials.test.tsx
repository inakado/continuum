import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import StudentCredentials from "./StudentCredentials";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("prints only the pupil name, current login address and credentials", () => {
  const print = vi.spyOn(window, "print").mockImplementation(() => {});
  const name = "Иванов Иван Иванович";
  render(<StudentCredentials credentials={[{ id: "pupil", name, login: "ivanov", password: "demo-password" }]} classTitle="11Б" onDone={vi.fn()} />);
  const card = within(screen.getByRole("article"));
  expect(card.getByRole("heading", { name })).toBeInTheDocument();
  expect(card.getByText(`Адрес: ${window.location.origin}/login`)).toBeInTheDocument();
  expect(card.getByText("ivanov")).toBeInTheDocument();
  expect(card.getByText("demo-password")).toBeInTheDocument();
  expect(card.queryByText(/КОНТИНУУМ|Физика|11Б/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Карточки для печати" }));
  expect(print).toHaveBeenCalledOnce();
});
