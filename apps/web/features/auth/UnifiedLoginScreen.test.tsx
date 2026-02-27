import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { teacherApi } from "@/lib/api/teacher";
import UnifiedLoginScreen from "./UnifiedLoginScreen";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/lib/api/teacher", () => ({
  teacherApi: {
    login: vi.fn(),
  },
}));

vi.mock("@/components/useTheme", () => ({
  useTheme: () => ({
    theme: "light",
    toggle: vi.fn(),
  }),
}));

vi.mock("@/components/Grainient", () => ({
  default: () => null,
}));

describe("UnifiedLoginScreen", () => {
  const pushMock = vi.fn();

  beforeEach(() => {
    pushMock.mockReset();
    vi.mocked(useRouter).mockReturnValue({ push: pushMock } as never);
    vi.mocked(teacherApi.login).mockReset();
  });

  it("redirects teacher to /teacher after successful login", async () => {
    vi.mocked(teacherApi.login).mockResolvedValueOnce({
      user: { role: "teacher" },
    } as never);

    render(<UnifiedLoginScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Логин"), "teacher1");
    await user.type(screen.getByLabelText("Пароль"), "Pass123!");
    await user.click(screen.getByRole("button", { name: "Войти" }));

    await waitFor(() => {
      expect(teacherApi.login).toHaveBeenCalledWith("teacher1", "Pass123!");
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/teacher");
    });
  });

  it("redirects student to /student after successful login", async () => {
    vi.mocked(teacherApi.login).mockResolvedValueOnce({
      user: { role: "student" },
    } as never);

    render(<UnifiedLoginScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Логин"), "student1");
    await user.type(screen.getByLabelText("Пароль"), "Pass123!");
    await user.click(screen.getByRole("button", { name: "Войти" }));

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/student");
    });
  });

  it("shows auth error message on 401 response", async () => {
    vi.mocked(teacherApi.login).mockRejectedValueOnce(
      new ApiError(401, "Unauthorized"),
    );

    render(<UnifiedLoginScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Логин"), "bad-user");
    await user.type(screen.getByLabelText("Пароль"), "bad-pass");
    await user.click(screen.getByRole("button", { name: "Войти" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Неверный логин или пароль",
    );
  });
});
