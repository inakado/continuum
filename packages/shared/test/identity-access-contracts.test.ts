import { describe, expect, it } from "vitest";
import {
  CreateTeacherStudentInputSchema,
  TeacherStudentsSchema,
} from "../src/contracts/identity-access";

const id = "123e4567-e89b-12d3-a456-426614174000";

describe("identity access contracts", () => {
  it("normalizes a valid student login", () => {
    expect(
      CreateTeacherStudentInputSchema.parse({
        login: " Student.One ",
        password: "Pass1234",
      }).login,
    ).toBe("student.one");
  });

  it("rejects a login that Better Auth cannot use", () => {
    expect(
      CreateTeacherStudentInputSchema.safeParse({
        login: "Иван Иванов",
        password: "Pass1234",
      }).success,
    ).toBe(false);
  });

  it("parses the teacher roster with grade access", () => {
    const parsed = TeacherStudentsSchema.parse({
      students: [
        {
          id,
          login: "student.one",
          name: "Иван Иванов",
          firstName: "Иван",
          lastName: "Иванов",
          isActive: true,
          gradeBands: ["grade_8", "grade_9"],
        },
      ],
    });

    expect(parsed.students[0]?.gradeBands).toEqual(["grade_8", "grade_9"]);
  });
});
