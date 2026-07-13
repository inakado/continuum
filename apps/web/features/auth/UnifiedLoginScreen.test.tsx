import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { authApi } from "@/lib/auth/client";
import UnifiedLoginScreen from "./UnifiedLoginScreen";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

vi.mock("@/lib/auth/client", () => ({
  authApi: {
    signIn: vi.fn(),
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
  const replaceMock = vi.fn();

  beforeEach(() => {
    replaceMock.mockReset();
    vi.mocked(useRouter).mockReturnValue({ replace: replaceMock } as never);
    vi.mocked(authApi.signIn).mockReset();
  });

  it("redirects teacher to /teacher after successful login", async () => {
    vi.mocked(authApi.signIn).mockResolvedValueOnce({
      user: { role: "teacher" },
    } as never);

    render(<UnifiedLoginScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Логин"), "teacher1");
    await user.type(screen.getByLabelText("Пароль"), "Pass123!");
    await user.click(screen.getByRole("button", { name: "Войти" }));

    await waitFor(() => {
      expect(authApi.signIn).toHaveBeenCalledWith("teacher1", "Pass123!");
    });
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/teacher");
    });
  });

  it("redirects student to /student after successful login", async () => {
    vi.mocked(authApi.signIn).mockResolvedValueOnce({
      user: { role: "student" },
    } as never);

    render(<UnifiedLoginScreen />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Логин"), "student1");
    await user.type(screen.getByLabelText("Пароль"), "Pass123!");
    await user.click(screen.getByRole("button", { name: "Войти" }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/student");
    });
  });

  it("shows auth error message on 401 response", async () => {
    vi.mocked(authApi.signIn).mockRejectedValueOnce(
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
