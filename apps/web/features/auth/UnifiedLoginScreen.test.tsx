import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { authApi } from "@/lib/auth/client";
import UnifiedLoginScreen from "./UnifiedLoginScreen";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function showLogin() { return render(<QueryClientProvider client={new QueryClient()}><UnifiedLoginScreen /></QueryClientProvider>); }

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
    window.history.replaceState({}, '', '/login');
    replaceMock.mockReset();
    vi.mocked(useRouter).mockReturnValue({ replace: replaceMock } as never);
    vi.mocked(authApi.signIn).mockReset();
  });

  it("redirects teacher to /teacher after successful login", async () => {
    vi.mocked(authApi.signIn).mockResolvedValueOnce({
      user: { role: "teacher" },
    } as never);

    showLogin();
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

    showLogin();
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

    showLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Логин"), "bad-user");
    await user.type(screen.getByLabelText("Пароль"), "bad-pass");
    await user.click(screen.getByRole("button", { name: "Войти" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Неверный логин или пароль",
    );
  });

  it.each([
    ['/student/works/00000000-0000-4000-8000-000000000001', '/student/works/00000000-0000-4000-8000-000000000001'],
    ['https://example.org/steal', '/student'],
  ])('limits returnTo %s to an internal work and replaces the previous account cache', async (returnTo, expected) => {
    window.history.replaceState({}, '', `/login?returnTo=${encodeURIComponent(returnTo)}`);
    const cache = new QueryClient();
    cache.setQueryData(['private'], { oldAccount: true });
    vi.mocked(authApi.signIn).mockResolvedValue({ user: { id: 'new', role: 'student', login: 'student1', name: 'Иван' } });
    render(<QueryClientProvider client={cache}><UnifiedLoginScreen /></QueryClientProvider>);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Логин'), 'student1');
    await user.type(screen.getByLabelText('Пароль'), 'password');
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith(expected));
    expect(cache.getQueryData(['private'])).toBeUndefined();
  });

  it("не показывает внутреннее сообщение сервера", async () => {
    vi.mocked(authApi.signIn).mockRejectedValueOnce(
      new ApiError(500, "Authentication request failed"),
    );

    showLogin();
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Логин"), "teacher1");
    await user.type(screen.getByLabelText("Пароль"), "Pass123!");
    await user.click(screen.getByRole("button", { name: "Войти" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Не удалось войти. Попробуйте ещё раз.",
    );
    expect(screen.queryByText("Authentication request failed")).not.toBeInTheDocument();
  });
});
