import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { studentApi } from "@/lib/api/student";
import type * as StudentApiModule from "@/lib/api/student";
import { renderWithQueryClient } from "@/test/render-with-query-client";
import StudentNotificationsButton from "./StudentNotificationsButton";

vi.mock("@/lib/api/student", async () => {
  const actual = await vi.importActual<typeof StudentApiModule>("@/lib/api/student");
  return {
    ...actual,
    studentApi: {
      ...actual.studentApi,
      listNotifications: vi.fn(),
      markNotificationRead: vi.fn(),
    },
  };
});

describe("StudentNotificationsButton", () => {
  beforeEach(() => {
    vi.mocked(studentApi.listNotifications).mockReset();
    vi.mocked(studentApi.markNotificationRead).mockReset();
    vi.mocked(studentApi.listNotifications).mockResolvedValue({
      activeCount: 1,
      items: [
        {
          id: "notification-1",
          type: "photo_reviewed",
          payload: {
            unitId: "unit-1",
            taskId: "task-1",
            status: "rejected",
            teacherFeedbackBoardAssetKey: "feedback.json",
            teacherFeedbackPreviewAssetKey: "feedback.png",
          },
          createdAt: "2026-06-26T01:00:00.000Z",
          readAt: null,
        },
      ],
    });
    vi.mocked(studentApi.markNotificationRead).mockResolvedValue({
      ok: true,
      notification: {
        id: "notification-1",
        type: "photo_reviewed",
        payload: {},
        createdAt: "2026-06-26T01:00:00.000Z",
        readAt: "2026-06-26T01:05:00.000Z",
      },
    });
  });

  it("renders unread badge, opens events popover and marks item read", async () => {
    renderWithQueryClient(<StudentNotificationsButton />);
    const user = userEvent.setup();

    const button = await screen.findByRole("button", { name: "События, непрочитанных: 1" });
    expect(screen.getByText("1")).toBeInTheDocument();

    await user.click(button);

    const item = await screen.findByRole("link", { name: /Задача требует правок/i });
    expect(item).toHaveAttribute("href", "/student/units/unit-1?taskId=task-1");
    expect(screen.getByText("Откройте разбор и исправьте недочеты.")).toBeInTheDocument();

    await user.click(item);

    await waitFor(() => {
      expect(studentApi.markNotificationRead).toHaveBeenCalledWith("notification-1");
    });
  });

  it("closes events popover after pointer leaves it", async () => {
    renderWithQueryClient(<StudentNotificationsButton />);
    const user = userEvent.setup();

    const button = await screen.findByRole("button", { name: "События, непрочитанных: 1" });
    await user.click(button);

    const popover = await screen.findByRole("dialog", { name: "События" });
    fireEvent.pointerLeave(popover);

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "События" })).not.toBeInTheDocument();
    });
  });
});
