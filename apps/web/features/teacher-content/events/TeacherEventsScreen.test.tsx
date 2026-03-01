import { screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { teacherApi } from "@/lib/api/teacher";
import type * as TeacherApiModule from "@/lib/api/teacher";
import { renderWithQueryClient } from "@/test/render-with-query-client";
import TeacherEventsScreen from "./TeacherEventsScreen";

const logoutMock = vi.fn();

vi.mock("@/components/TeacherShell", () => ({
  default: ({
    children,
    title,
  }: {
    children: ReactNode;
    title: ReactNode;
  }) => (
    <div>
      <div>{title}</div>
      {children}
    </div>
  ),
}));

vi.mock("../auth/AuthRequired", () => ({
  default: () => <div>AUTH_REQUIRED</div>,
}));

vi.mock("../auth/use-teacher-logout", () => ({
  useTeacherLogout: () => logoutMock,
}));

vi.mock("@/lib/api/teacher", async () => {
  const actual = await vi.importActual<typeof TeacherApiModule>("@/lib/api/teacher");
  return {
    ...actual,
    teacherApi: {
      ...actual.teacherApi,
      listEvents: vi.fn(),
    },
  };
});

describe("TeacherEventsScreen", () => {
  beforeEach(() => {
    logoutMock.mockReset();
    vi.mocked(teacherApi.listEvents).mockReset();
  });

  it("loads and renders teacher events through query layer", async () => {
    vi.mocked(teacherApi.listEvents).mockResolvedValue({
      items: [
        {
          id: "event-1",
          category: "admin",
          eventType: "TaskSolutionPdfCompiled",
          actorUserId: "teacher-1",
          actorUser: { login: "teacher1" },
          entityType: "task_revision",
          entityId: "revision-1",
          payload: { task_id: "task-1" },
          occurredAt: "2026-03-01T10:00:00.000Z",
        },
      ],
      total: 1,
      limit: 50,
      offset: 0,
    } as never);

    renderWithQueryClient(<TeacherEventsScreen />);

    expect(await screen.findByText("События")).toBeInTheDocument();
    expect(await screen.findByText("TaskSolutionPdfCompiled")).toBeInTheDocument();
    expect(screen.getByText("teacher1")).toBeInTheDocument();
    expect(screen.getByText("task_revision:revision-1")).toBeInTheDocument();
    expect(teacherApi.listEvents).toHaveBeenCalledWith({ category: "admin", limit: 50, offset: 0 });
  });

  it("shows auth required state on relogin error", async () => {
    vi.mocked(teacherApi.listEvents).mockRejectedValue(
      new ApiError(401, "Unauthorized", "AUTH_REQUIRED"),
    );

    renderWithQueryClient(<TeacherEventsScreen />);

    expect(await screen.findByText("AUTH_REQUIRED")).toBeInTheDocument();
    expect(screen.queryByText("Загрузка…")).not.toBeInTheDocument();
  });
});
