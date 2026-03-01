import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter, useSearchParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { teacherApi } from "@/lib/api/teacher";
import type * as TeacherApiModule from "@/lib/api/teacher";
import { renderWithQueryClient } from "@/test/render-with-query-client";
import TeacherReviewSubmissionDetailPanel from "./TeacherReviewSubmissionDetailPanel";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

vi.mock("@/components/LiteTex", () => ({
  default: ({ value }: { value: string }) => <div>{value}</div>,
}));

vi.mock("@/lib/api/teacher", async () => {
  const actual = await vi.importActual<typeof TeacherApiModule>("@/lib/api/teacher");
  return {
    ...actual,
    teacherApi: {
      ...actual.teacherApi,
      getTeacherPhotoSubmissionDetail: vi.fn(),
      presignStudentTaskPhotoView: vi.fn(),
      acceptStudentTaskPhotoSubmission: vi.fn(),
      rejectStudentTaskPhotoSubmission: vi.fn(),
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

const submissionDetail = {
  submission: {
    submissionId: "submission-1",
    status: "pending_review",
    submittedAt: "2026-03-01T09:15:00.000Z",
    reviewedAt: null,
    rejectedReason: null,
    assetKeys: ["asset-1", "asset-2"],
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
      title: "Фото-ответ",
      statementLite: "x^2 + y^2",
    },
  },
  navigation: {
    prevSubmissionId: "submission-0",
    nextSubmissionId: "submission-2",
  },
} as const;

describe("TeacherReviewSubmissionDetailPanel", () => {
  const pushMock = vi.fn();

  beforeEach(() => {
    pushMock.mockReset();
    vi.mocked(useRouter).mockReturnValue({ push: pushMock } as never);
    vi.mocked(useSearchParams).mockReturnValue(
      createSearchParams({
        status: "pending_review",
        sort: "oldest",
        studentId: "student-1",
      }) as never,
    );
    vi.mocked(teacherApi.getTeacherPhotoSubmissionDetail).mockReset();
    vi.mocked(teacherApi.presignStudentTaskPhotoView).mockReset();
    vi.mocked(teacherApi.acceptStudentTaskPhotoSubmission).mockReset();
    vi.mocked(teacherApi.rejectStudentTaskPhotoSubmission).mockReset();
    vi.mocked(teacherApi.getTeacherPhotoSubmissionDetail).mockResolvedValue(submissionDetail as never);
    vi.mocked(teacherApi.presignStudentTaskPhotoView).mockResolvedValue({
      ok: true,
      assetKey: "asset-1",
      expiresInSec: 300,
      url: "https://cdn.test/asset-1.jpg",
    } as never);
  });

  it("renders submission details and loads active preview", async () => {
    renderWithQueryClient(<TeacherReviewSubmissionDetailPanel submissionId="submission-1" />);

    expect(await screen.findByText("Иванов Иван")).toBeInTheDocument();
    expect(screen.getByText("Алгебра / Линейные уравнения / Юнит 1")).toBeInTheDocument();
    expect(screen.getByText("Фото-ответ")).toBeInTheDocument();
    expect(screen.getByText("x^2 + y^2")).toBeInTheDocument();
    expect(screen.getByAltText("Фото-ответ ученика")).toHaveAttribute("src", "https://cdn.test/asset-1.jpg");

    await waitFor(() => {
      expect(teacherApi.getTeacherPhotoSubmissionDetail).toHaveBeenCalledWith("submission-1", {
        status: "pending_review",
        sort: "oldest",
        studentId: "student-1",
      });
    });
    await waitFor(() => {
      expect(teacherApi.presignStudentTaskPhotoView).toHaveBeenCalledWith(
        "student-1",
        "task-1",
        "asset-1",
        300,
      );
    });
  });

  it("accepts submission, invalidates review queries and opens next submission", async () => {
    const { queryClient } = renderWithQueryClient(
      <TeacherReviewSubmissionDetailPanel submissionId="submission-1" />,
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();

    vi.mocked(teacherApi.acceptStudentTaskPhotoSubmission).mockResolvedValue({
      ok: true,
      status: "accepted",
    } as never);

    await screen.findByText("Иванов Иван");
    await user.click(screen.getByRole("button", { name: "Принять" }));

    await waitFor(() => {
      expect(teacherApi.acceptStudentTaskPhotoSubmission).toHaveBeenCalledWith(
        "student-1",
        "task-1",
        "submission-1",
      );
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: ["learning-photo", "teacher", "review"],
      });
    });
    expect(pushMock).toHaveBeenCalledWith(
      "/teacher/review/submission-2?status=pending_review&sort=oldest&studentId=student-1",
    );
  });

  it("rejects submission and returns to inbox when queue ends", async () => {
    vi.mocked(teacherApi.getTeacherPhotoSubmissionDetail).mockResolvedValue({
      ...submissionDetail,
      navigation: {
        prevSubmissionId: null,
        nextSubmissionId: null,
      },
    } as never);
    vi.mocked(teacherApi.rejectStudentTaskPhotoSubmission).mockResolvedValue({
      ok: true,
      status: "rejected",
    } as never);

    renderWithQueryClient(<TeacherReviewSubmissionDetailPanel submissionId="submission-1" />);
    const user = userEvent.setup();

    await screen.findByText("Иванов Иван");
    await user.click(screen.getByRole("button", { name: "Отклонить" }));

    await waitFor(() => {
      expect(teacherApi.rejectStudentTaskPhotoSubmission).toHaveBeenCalledWith(
        "student-1",
        "task-1",
        "submission-1",
      );
    });
    expect(pushMock).toHaveBeenCalledWith("/teacher/review?status=pending_review&sort=oldest&studentId=student-1");
  });

  it("opens student profile with current review focus", async () => {
    renderWithQueryClient(<TeacherReviewSubmissionDetailPanel submissionId="submission-1" />);
    const user = userEvent.setup();

    await screen.findByText("Иванов Иван");
    await user.click(screen.getByRole("button", { name: "Профиль ученика" }));

    expect(pushMock).toHaveBeenCalledWith(
      "/teacher/students/student-1?courseId=course-1&sectionId=section-1&unitId=unit-1&taskId=task-1",
    );
  });
});
