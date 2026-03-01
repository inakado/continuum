import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter, useSearchParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { teacherApi } from "@/lib/api/teacher";
import type * as TeacherApiModule from "@/lib/api/teacher";
import { renderWithQueryClient } from "@/test/render-with-query-client";
import TeacherReviewInboxPanel from "./TeacherReviewInboxPanel";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock("@/lib/api/teacher", async () => {
  const actual = await vi.importActual<typeof TeacherApiModule>("@/lib/api/teacher");
  return {
    ...actual,
    teacherApi: {
      ...actual.teacherApi,
      listTeacherPhotoInbox: vi.fn(),
      listStudents: vi.fn(),
    },
  };
});

const createSearchParams = (params: Record<string, string>) => {
  const search = new URLSearchParams(params);
  return {
    get: (name: string) => search.get(name),
    toString: () => search.toString(),
  };
};

const inboxItem = {
  submissionId: "submission-1",
  status: "pending_review",
  submittedAt: "2026-03-01T09:15:00.000Z",
  assetKeysCount: 3,
  student: {
    id: "student-1",
    login: "student1",
    firstName: "Иван",
    lastName: "Иванов",
  },
  course: {
    id: "course-1",
    title: "Алгебра",
  },
  section: {
    id: "section-1",
    title: "Линейные уравнения",
  },
  unit: {
    id: "unit-1",
    title: "Юнит 1",
  },
  task: {
    id: "task-1",
    sortOrder: 2,
  },
} as const;

describe("TeacherReviewInboxPanel", () => {
  const pushMock = vi.fn();

  beforeEach(() => {
    pushMock.mockReset();
    vi.mocked(useRouter).mockReturnValue({ push: pushMock } as never);
    vi.mocked(useSearchParams).mockReturnValue(createSearchParams({}) as never);
    vi.mocked(teacherApi.listTeacherPhotoInbox).mockReset();
    vi.mocked(teacherApi.listStudents).mockReset();
    vi.mocked(teacherApi.listStudents).mockResolvedValue([
      {
        id: "student-1",
        login: "student1",
        firstName: "Иван",
        lastName: "Иванов",
      },
    ] as never);
  });

  it("renders inbox items from current filters", async () => {
    vi.mocked(teacherApi.listTeacherPhotoInbox).mockResolvedValue({
      items: [inboxItem],
      total: 1,
      limit: 50,
      offset: 0,
    } as never);

    renderWithQueryClient(<TeacherReviewInboxPanel />);

    expect(await screen.findByText("Иванов Иван")).toBeInTheDocument();
    expect(screen.getByText("Алгебра / Линейные уравнения / Юнит 1")).toBeInTheDocument();
    expect(screen.getByText("В очереди: 1")).toBeInTheDocument();

    await waitFor(() => {
      expect(teacherApi.listTeacherPhotoInbox).toHaveBeenCalledWith({
        status: "pending_review",
        sort: "oldest",
        limit: 50,
        offset: 0,
      });
    });
  });

  it("refetches inbox on manual refresh", async () => {
    vi.mocked(teacherApi.listTeacherPhotoInbox).mockResolvedValue({
      items: [inboxItem],
      total: 1,
      limit: 50,
      offset: 0,
    } as never);

    renderWithQueryClient(<TeacherReviewInboxPanel />);
    const user = userEvent.setup();

    expect(await screen.findByText("Иванов Иван")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Обновить" }));

    await waitFor(() => {
      expect(teacherApi.listTeacherPhotoInbox).toHaveBeenCalledTimes(2);
    });
  });

  it("opens first submission and preserves current filters in route", async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      createSearchParams({
        status: "accepted",
        sort: "newest",
        studentId: "student-1",
      }) as never,
    );
    vi.mocked(teacherApi.listTeacherPhotoInbox).mockResolvedValue({
      items: [inboxItem],
      total: 1,
      limit: 50,
      offset: 0,
    } as never);

    renderWithQueryClient(<TeacherReviewInboxPanel />);
    const user = userEvent.setup();

    expect(await screen.findByText("Иванов Иван")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Открыть первую на проверке" }));

    expect(pushMock).toHaveBeenCalledWith(
      "/teacher/review/submission-1?status=accepted&sort=newest&studentId=student-1",
    );
  });

  it("shows error state and lets reset filters to default route", async () => {
    vi.mocked(useSearchParams).mockReturnValue(
      createSearchParams({
        status: "accepted",
        sort: "newest",
        studentId: "student-1",
      }) as never,
    );
    vi.mocked(teacherApi.listTeacherPhotoInbox).mockRejectedValue(
      new ApiError(400, "Inbox exploded", "REVIEW_INBOX_FAILED"),
    );

    renderWithQueryClient(<TeacherReviewInboxPanel />);
    const user = userEvent.setup();

    expect(await screen.findByRole("status")).toHaveTextContent(
      '{ code: "REVIEW_INBOX_FAILED", message: "Inbox exploded" }',
    );

    await user.click(screen.getAllByRole("button", { name: "Сбросить фильтры" })[0]);

    expect(pushMock).toHaveBeenCalledWith("/teacher/review?status=pending_review&sort=oldest");
  });
});
