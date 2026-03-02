import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ApiError } from "@/lib/api/client";
import { studentApi } from "@/lib/api/student";
import { teacherApi } from "@/lib/api/teacher";

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });

describe("wave3 runtime parsing (non-learning)", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses valid student courses response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        {
          id: "course-1",
          title: "Алгебра",
          description: null,
          status: "published",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ]),
    );

    const response = await studentApi.listCourses();

    expect(response).toHaveLength(1);
    expect(response[0]?.id).toBe("course-1");
  });

  it("throws API_RESPONSE_INVALID when student section graph payload is broken", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        sectionId: "section-1",
        nodes: [],
      }),
    );

    await expect(studentApi.getSectionGraph("section-1")).rejects.toMatchObject({
      code: "API_RESPONSE_INVALID",
    } satisfies Partial<ApiError>);
  });

  it("parses valid teacher students response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse([
        {
          id: "student-1",
          login: "student1",
          firstName: "Иван",
          lastName: "Иванов",
          leadTeacherId: "teacher-1",
          leadTeacherLogin: "teacher1",
          leadTeacherDisplayName: "Иван Иванович",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
          activeNotificationsCount: 1,
          pendingPhotoReviewCount: 0,
        },
      ]),
    );

    const response = await teacherApi.listStudents();

    expect(response).toHaveLength(1);
    expect(response[0]?.login).toBe("student1");
  });

  it("parses valid teacher section meta response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: "section-1",
        courseId: "course-1",
        title: "Линейные уравнения",
        status: "draft",
      }),
    );

    const response = await teacherApi.getSectionMeta("section-1");

    expect(response.courseId).toBe("course-1");
    expect(response.title).toBe("Линейные уравнения");
  });

  it("throws API_RESPONSE_INVALID when teacher student profile payload is broken", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        profile: {
          id: "student-1",
          login: "student1",
          leadTeacherId: "teacher-1",
          leadTeacherLogin: "teacher1",
        },
        notifications: {
          activeCount: "1",
          items: [],
        },
        courses: [],
        selectedCourseId: null,
        courseTree: null,
      }),
    );

    await expect(teacherApi.getStudentProfile("student-1")).rejects.toMatchObject({
      code: "API_RESPONSE_INVALID",
    } satisfies Partial<ApiError>);
  });
});
