import { describe, expect, it } from "vitest";
import {
  CreateLessonInputSchema,
  GradeBandSchema,
  LessonDetailSchema,
  StudentLibrarySchema,
} from "../src/contracts/library";

const id = "123e4567-e89b-12d3-a456-426614174000";

describe("library contracts", () => {
  it("fixes the supported grade bands", () => {
    expect(GradeBandSchema.options).toEqual([
      "grade_7",
      "grade_8",
      "grade_9",
      "grade_10_11",
    ]);
    expect(GradeBandSchema.safeParse("grade_10").success).toBe(false);
  });

  it("accepts a dense student catalog payload", () => {
    const parsed = StudentLibrarySchema.parse({
      gradeBands: [
        {
          code: "grade_10_11",
          sections: [
            {
              id,
              gradeBand: "grade_10_11",
              title: "Механика",
              description: null,
              status: "published",
              sortOrder: 0,
              lessons: [
                {
                  id,
                  title: "Кинематика",
                  description: null,
                  status: "published",
                  sortOrder: 0,
                  formats: { pdf: true, interactive: true, tasks: true },
                },
              ],
            },
          ],
        },
      ],
    });

    expect(parsed.gradeBands[0]?.sections[0]?.lessons[0]?.title).toBe("Кинематика");
  });

  it("keeps lesson artifacts free from legacy progress fields", () => {
    const parsed = LessonDetailSchema.parse({
      id,
      title: "Кинематика",
      description: null,
      status: "published",
      sortOrder: 0,
      formats: { pdf: true, interactive: false, tasks: true },
      section: { id, gradeBand: "grade_10_11", title: "Механика" },
      artifacts: [
        {
          id,
          type: "pdf",
          version: 1,
          filename: "kinematics.pdf",
          contentType: "application/pdf",
          sizeBytes: 42,
          status: "published",
          isActive: true,
          publishedAt: "2026-09-23T00:00:00.000Z",
        },
        {
          id,
          type: "tasks_pdf",
          version: 1,
          filename: "kinematics-tasks.pdf",
          contentType: "application/pdf",
          sizeBytes: 58,
          status: "published",
          isActive: true,
          publishedAt: "2026-09-23T00:00:00.000Z",
        },
      ],
    });

    expect(parsed.artifacts[0]?.type).toBe("pdf");
    expect(parsed.artifacts[1]?.type).toBe("tasks_pdf");
    expect("completionPercent" in parsed).toBe(false);
  });

  it("rejects blank lesson titles", () => {
    expect(
      CreateLessonInputSchema.safeParse({ sectionId: id, title: "   " }).success,
    ).toBe(false);
  });
});
