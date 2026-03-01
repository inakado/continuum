import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter, useSearchParams } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { contentQueryKeys } from "@/lib/query/keys";
import { teacherApi } from "@/lib/api/teacher";
import type * as TeacherApiModule from "@/lib/api/teacher";
import { renderWithQueryClient } from "@/test/render-with-query-client";
import TeacherStudentProfilePanel from "./TeacherStudentProfilePanel";

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
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
      getStudentProfile: vi.fn(),
      listTeacherPhotoInbox: vi.fn(),
      creditTask: vi.fn(),
      overrideOpenUnit: vi.fn(),
    },
  };
});

const createSearchParams = (params: Record<string, string>) => ({
  get: (name: string) => params[name] ?? null,
});

const profileResponse = {
  profile: {
    id: "student-1",
    login: "student1",
    firstName: "Иван",
    lastName: "Иванов",
    leadTeacherId: "teacher-1",
    leadTeacherLogin: "teacher1",
    leadTeacherDisplayName: "Teacher One",
  },
  notifications: {
    activeCount: 0,
    items: [],
  },
  courses: [{ id: "course-1", title: "Алгебра" }],
  selectedCourseId: "course-1",
  courseTree: {
    id: "course-1",
    title: "Алгебра",
    sections: [
      {
        id: "section-1",
        title: "Линейные уравнения",
        sortOrder: 1,
        units: [
          {
            id: "unit-1",
            title: "Юнит 1",
            sortOrder: 1,
            state: {
              status: "in_progress",
              completionPercent: 20,
              solvedPercent: 10,
              countedTasks: 1,
              solvedTasks: 0,
              totalTasks: 3,
              overrideOpened: false,
            },
            tasks: [
              {
                id: "task-1",
                title: "Задача 1",
                statementLite: "x + 1 = 2",
                answerType: "numeric",
                isRequired: true,
                sortOrder: 1,
                pendingPhotoReviewCount: 0,
                state: {
                  status: "in_progress",
                  attemptsUsed: 1,
                  wrongAttempts: 1,
                  blockedUntil: null,
                  requiredSkippedFlag: false,
                  isCredited: false,
                  isTeacherCredited: false,
                  canTeacherCredit: true,
                },
              },
            ],
          },
        ],
      },
    ],
  },
} as const;

describe("TeacherStudentProfilePanel", () => {
  const pushMock = vi.fn();
  const replaceMock = vi.fn();

  beforeEach(() => {
    pushMock.mockReset();
    replaceMock.mockReset();
    vi.mocked(useRouter).mockReturnValue({ push: pushMock, replace: replaceMock } as never);
    vi.mocked(useSearchParams).mockReturnValue(createSearchParams({}) as never);
    vi.mocked(teacherApi.getStudentProfile).mockReset();
    vi.mocked(teacherApi.listTeacherPhotoInbox).mockReset();
    vi.mocked(teacherApi.creditTask).mockReset();
    vi.mocked(teacherApi.overrideOpenUnit).mockReset();
    vi.mocked(teacherApi.getStudentProfile).mockResolvedValue(profileResponse as never);
    vi.mocked(teacherApi.listTeacherPhotoInbox).mockResolvedValue({ total: 2 } as never);
    vi.mocked(teacherApi.creditTask).mockResolvedValue({
      ok: true,
      status: "teacher_credited",
      taskId: "task-1",
      studentId: "student-1",
    } as never);
  });

  it("renders profile and opens review inbox with current student filter", async () => {
    renderWithQueryClient(
      <TeacherStudentProfilePanel studentId="student-1" fallbackName="student1" />,
    );
    const user = userEvent.setup();

    expect(await screen.findByText("Иванов Иван")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Фото на проверке: 2/i }));

    expect(pushMock).toHaveBeenCalledWith(
      "/teacher/review?status=pending_review&sort=oldest&studentId=student-1",
    );
  });

  it("credits task and invalidates profile-related queries", async () => {
    const onRefreshStudents = vi.fn().mockResolvedValue(undefined);
    const { queryClient } = renderWithQueryClient(
      <TeacherStudentProfilePanel
        studentId="student-1"
        fallbackName="student1"
        onRefreshStudents={onRefreshStudents}
      />,
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Алгебра/i }));
    await user.click(await screen.findByRole("button", { name: /Линейные уравнения/i }));
    await user.click(await screen.findByRole("button", { name: "Юнит 1" }));

    expect(
      await screen.findByText((_, element) => element?.textContent === "Задачи юнита: Юнит 1"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Зачесть" }));

    await waitFor(() => {
      expect(teacherApi.creditTask).toHaveBeenCalledWith("student-1", "task-1");
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: contentQueryKeys.teacherStudentProfileRoot("student-1"),
      });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: contentQueryKeys.teacherStudentReviewPendingTotal("student-1"),
    });
    expect(onRefreshStudents).toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Задача зачтена. Прогресс и доступность пересчитаны.",
    );
  });

  it("opens unit manually, invalidates queries and shows notice", async () => {
    const onRefreshStudents = vi.fn().mockResolvedValue(undefined);
    vi.mocked(teacherApi.getStudentProfile).mockResolvedValue({
      ...profileResponse,
      courseTree: {
        ...profileResponse.courseTree,
        sections: [
          {
            ...profileResponse.courseTree.sections[0],
            units: [
              {
                ...profileResponse.courseTree.sections[0].units[0],
                state: {
                  ...profileResponse.courseTree.sections[0].units[0].state,
                  status: "locked",
                },
              },
            ],
          },
        ],
      },
    } as never);
    const { queryClient } = renderWithQueryClient(
      <TeacherStudentProfilePanel
        studentId="student-1"
        fallbackName="student1"
        onRefreshStudents={onRefreshStudents}
      />,
    );
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const user = userEvent.setup();

    vi.mocked(teacherApi.overrideOpenUnit).mockResolvedValue({
      ok: true,
      unitId: "unit-1",
      status: "available",
    } as never);

    await user.click(await screen.findByRole("button", { name: /Алгебра/i }));
    await user.click(await screen.findByRole("button", { name: /Линейные уравнения/i }));
    await user.click(screen.getByRole("button", { name: "Открыть вручную" }));

    await waitFor(() => {
      expect(teacherApi.overrideOpenUnit).toHaveBeenCalledWith("student-1", "unit-1");
    });
    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({
        queryKey: contentQueryKeys.teacherStudentProfileRoot("student-1"),
      });
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: contentQueryKeys.teacherStudentReviewPendingTotal("student-1"),
    });
    expect(onRefreshStudents).toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Доступ к юниту открыт вручную. Статусы обновлены.",
    );
  });

  it("syncs drilldown context to route and toggles task statement", async () => {
    renderWithQueryClient(
      <TeacherStudentProfilePanel studentId="student-1" fallbackName="student1" />,
    );
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: /Алгебра/i }));
    expect(replaceMock).toHaveBeenLastCalledWith("/teacher/students/student-1?courseId=course-1");

    await user.click(await screen.findByRole("button", { name: /Линейные уравнения/i }));
    expect(replaceMock).toHaveBeenLastCalledWith(
      "/teacher/students/student-1?courseId=course-1&sectionId=section-1",
    );

    await user.click(await screen.findByRole("button", { name: "Юнит 1" }));
    expect(replaceMock).toHaveBeenLastCalledWith(
      "/teacher/students/student-1?courseId=course-1&sectionId=section-1&unitId=unit-1",
    );

    await user.click(screen.getByRole("button", { name: "Показать условие" }));
    expect(replaceMock).toHaveBeenLastCalledWith(
      "/teacher/students/student-1?courseId=course-1&sectionId=section-1&unitId=unit-1&taskId=task-1",
    );
    expect(await screen.findByText("x + 1 = 2")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Скрыть условие" }));
    expect(replaceMock).toHaveBeenLastCalledWith(
      "/teacher/students/student-1?courseId=course-1&sectionId=section-1&unitId=unit-1",
    );
  });
});
