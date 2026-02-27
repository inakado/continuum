import { describe, expect, it } from "vitest";
import {
  StudentCourseListResponseSchema,
  StudentSectionGraphResponseSchema,
  TeacherCreateStudentRequestSchema,
  TeacherStudentProfileQuerySchema,
  TeacherStudentProfileResponseSchema,
  TeacherStudentsListQuerySchema,
  TeacherStudentsListResponseSchema,
} from "../src/contracts/content-non-learning";

describe("content non-learning contracts", () => {
  it("accepts valid student dashboard payloads", () => {
    const list = StudentCourseListResponseSchema.parse([
      {
        id: "course-1",
        title: "Алгебра",
        description: null,
        status: "published",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);

    const graph = StudentSectionGraphResponseSchema.parse({
      sectionId: "section-1",
      nodes: [
        {
          unitId: "unit-1",
          title: "Тема 1",
          status: "available",
          position: { x: 0, y: 0 },
          completionPercent: 50,
          solvedPercent: 30,
        },
      ],
      edges: [{ id: "edge-1", fromUnitId: "unit-1", toUnitId: "unit-2" }],
    });

    expect(list[0].id).toBe("course-1");
    expect(graph.sectionId).toBe("section-1");
  });

  it("accepts valid teacher students query/request shapes", () => {
    expect(TeacherStudentsListQuerySchema.parse({ query: "student" })).toEqual({
      query: "student",
    });

    expect(
      TeacherCreateStudentRequestSchema.parse({
        login: "student-1",
        firstName: "Иван",
        extra: true,
      }),
    ).toMatchObject({
      login: "student-1",
      firstName: "Иван",
      extra: true,
    });

    expect(TeacherStudentProfileQuerySchema.parse({ courseId: "course-1" })).toEqual({
      courseId: "course-1",
    });
  });

  it("rejects invalid teacher students response and profile response shapes", () => {
    const studentsResult = TeacherStudentsListResponseSchema.safeParse([
      {
        id: "student-1",
        login: "student1",
      },
    ]);

    const profileResult = TeacherStudentProfileResponseSchema.safeParse({
      profile: {
        id: "student-1",
        login: "student1",
        leadTeacherId: "teacher-1",
        leadTeacherLogin: "teacher1",
      },
      notifications: { activeCount: "1", items: [] },
      courses: [],
      selectedCourseId: null,
      courseTree: null,
    });

    expect(studentsResult.success).toBe(false);
    expect(profileResult.success).toBe(false);
  });

  it("rejects invalid graph payloads", () => {
    const result = StudentSectionGraphResponseSchema.safeParse({
      sectionId: "section-1",
      nodes: [],
    });

    expect(result.success).toBe(false);
  });
});
