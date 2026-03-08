import { describe, expect, it } from "vitest";
import {
  StudentCourseDetailResponseSchema,
  StudentDashboardOverviewResponseSchema,
  StudentCourseListResponseSchema,
  StudentSectionGraphResponseSchema,
  TeacherCreateStudentRequestSchema,
  TeacherSectionMetaSchema,
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

    const overview = StudentDashboardOverviewResponseSchema.parse({
      courses: [
        {
          id: "course-1",
          title: "Алгебра",
          description: null,
          coverImageAssetKey: "courses/course-1/cover/1700000000000-abcd1234.webp",
          status: "published",
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
          sectionCount: 3,
          unitCount: 12,
          progressPercent: 40,
          coverImageKey: "courses/course-1/cover/1700000000000-abcd1234.webp",
          coverImageUrl: "https://cdn.example.com/course-1.webp",
        },
      ],
      continueLearning: {
        courseId: "course-1",
        courseTitle: "Алгебра",
        sectionId: "section-1",
        sectionTitle: "Линейные уравнения",
        unitId: "unit-2",
        unitTitle: "Системы уравнений",
        completionPercent: 50,
        solvedPercent: 25,
        href: "/student/units/unit-2",
      },
      stats: {
        totalUnits: 12,
        availableUnits: 2,
        inProgressUnits: 1,
        completedUnits: 4,
      },
    });

    expect(list[0].id).toBe("course-1");
    expect(graph.sectionId).toBe("section-1");
    expect(overview.continueLearning?.unitId).toBe("unit-2");

    const courseDetail = StudentCourseDetailResponseSchema.parse({
      id: "course-1",
      title: "Алгебра",
      description: null,
      status: "published",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      sections: [
        {
          id: "section-1",
          courseId: "course-1",
          title: "Линейные уравнения",
          description: null,
          completionPercent: 45,
          status: "published",
          sortOrder: 1,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-02T00:00:00.000Z",
        },
      ],
    });

    expect(courseDetail.sections[0]?.completionPercent).toBe(45);
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

    expect(
      TeacherSectionMetaSchema.parse({
        id: "section-1",
        courseId: "course-1",
        title: "Раздел 1",
        status: "draft",
      }),
    ).toMatchObject({
      id: "section-1",
      courseId: "course-1",
      title: "Раздел 1",
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
