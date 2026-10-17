import { describe, expect, it } from "vitest";
import { BulkCreateStudentsInputSchema, parseRoster, SchoolClassInputSchema } from "../src/contracts/school-classes";

describe("school class contracts", () => {
  it("parses pasted names without merging namesakes", () => {
    expect(parseRoster("1. Иванов Иван Иванович\r\n\n2. Иванов\tИван\tИванович")).toEqual([
      { lastName: "Иванов", firstName: "Иван", middleName: "Иванович" },
      { lastName: "Иванов", firstName: "Иван", middleName: "Иванович" },
    ]);
  });
  it("keeps incomplete lines visible for correction", () => {
    expect(parseRoster("Петров")).toEqual([{ lastName: "Петров", firstName: "", middleName: "" }]);
  });
  it("requires exactly one target class and bounds the batch", () => {
    const input = { requestId: "123e4567-e89b-12d3-a456-426614174000", students: parseRoster("Иванов Иван") };
    expect(BulkCreateStudentsInputSchema.safeParse(input).success).toBe(false);
    const newClass = { title: "8А", grade: 8, academicYear: 2026 };
    expect(BulkCreateStudentsInputSchema.safeParse({ ...input, newClass }).success).toBe(true);
    expect(BulkCreateStudentsInputSchema.safeParse({ ...input, newClass, classId: input.requestId }).success).toBe(false);
    expect(BulkCreateStudentsInputSchema.safeParse({ ...input, newClass, students: [] }).success).toBe(false);
    expect(SchoolClassInputSchema.safeParse({ ...newClass, grade: 12 }).success).toBe(false);
  });
});
