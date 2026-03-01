import { QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { teacherApi } from "@/lib/api/teacher";
import type * as TeacherApiModule from "@/lib/api/teacher";
import { createQueryClient } from "@/lib/query/query-client";
import { useTeacherIdentity } from "./use-teacher-identity";

vi.mock("@/lib/api/teacher", async () => {
  const actual = await vi.importActual<typeof TeacherApiModule>("@/lib/api/teacher");
  return {
    ...actual,
    teacherApi: {
      ...actual.teacherApi,
      getTeacherMe: vi.fn(),
    },
  };
});

describe("useTeacherIdentity", () => {
  beforeEach(() => {
    vi.mocked(teacherApi.getTeacherMe).mockReset();
  });

  it("shares teacher identity through query cache and derives displayName", async () => {
    vi.mocked(teacherApi.getTeacherMe).mockResolvedValue({
      user: { id: "teacher-1", login: "teacher1", role: "teacher" },
      profile: {
        firstName: "Анна",
        lastName: "Петрова",
        middleName: "Игоревна",
      },
    } as never);

    const queryClient = createQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const first = renderHook(() => useTeacherIdentity(), { wrapper });
    const second = renderHook(() => useTeacherIdentity(), { wrapper });

    await waitFor(() => {
      expect(first.result.current.displayName).toBe("Петрова Анна");
    });

    expect(second.result.current.displayName).toBe("Петрова Анна");
    expect(teacherApi.getTeacherMe).toHaveBeenCalledTimes(1);
  });

  it("returns empty identity on request failure", async () => {
    vi.mocked(teacherApi.getTeacherMe).mockRejectedValue(new Error("network failed"));

    const queryClient = createQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useTeacherIdentity(), { wrapper });

    await waitFor(() => {
      expect(result.current.displayName).toBe("");
    });

    expect(result.current.login).toBeNull();
    expect(result.current.firstName).toBeNull();
    expect(result.current.lastName).toBeNull();
    expect(result.current.middleName).toBeNull();
  });
});
