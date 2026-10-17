import { z } from "zod";

export const SCHOOL_ROSTER_LIMIT = 100;
const personName = z.string().trim().min(1, "Укажите имя и фамилию.").max(100);
export const RosterStudentSchema = z.object({
  lastName: personName,
  firstName: personName,
  middleName: z.string().trim().max(100).default(""),
});
export type RosterStudent = z.infer<typeof RosterStudentSchema>;

// Word/Excel lists retain their order and namesakes; validation happens before creation.
export function parseRoster(text: string): RosterStudent[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [lastName = "", firstName = "", ...middle] = line.replace(/^\d+[.)]\s*/, "").split(/\s+/);
    return { lastName, firstName, middleName: middle.join(" ") };
  });
}

export const SchoolClassInputSchema = z.object({
  title: z.string().trim().min(1).max(40),
  grade: z.number().int().min(7).max(11),
  academicYear: z.number().int().min(2020).max(2100),
});
export const SchoolClassSchema = SchoolClassInputSchema.extend({
  id: z.uuid(),
  isArchived: z.boolean(),
  studentCount: z.number().int().nonnegative(),
});
export const SchoolClassesSchema = z.object({ classes: z.array(SchoolClassSchema) });
export const UpdateSchoolClassInputSchema = SchoolClassInputSchema.partial().extend({
  isArchived: z.boolean().optional(),
});
export const DeleteSchoolClassInputSchema = z.object({ deleteStudents: z.boolean().default(false) });
export const DeletedStudentResultSchema = z.object({ id: z.uuid() });
export const DeletedSchoolClassResultSchema = DeletedStudentResultSchema.extend({ deletedStudentsCount: z.number().int().nonnegative() });
export const BulkCreateStudentsInputSchema = z.object({
  requestId: z.uuid(),
  classId: z.uuid().optional(),
  newClass: SchoolClassInputSchema.optional(),
  students: z.array(RosterStudentSchema).min(1).max(SCHOOL_ROSTER_LIMIT),
}).refine((input) => Boolean(input.classId) !== Boolean(input.newClass), {
  message: "Выберите существующий класс или создайте новый.",
});
export const StudentCredentialSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  login: z.string(),
  password: z.string(),
});
export const BulkCreateStudentsResultSchema = z.object({
  classId: z.uuid(),
  studentIds: z.array(z.uuid()),
  // Replays never store or return plaintext passwords again.
  credentials: z.array(StudentCredentialSchema).nullable(),
  replayed: z.boolean(),
});
export const SetStudentClassInputSchema = z.object({ classId: z.uuid().nullable() });
export const StudentClassResultSchema = SetStudentClassInputSchema.extend({ id: z.uuid() });
export const ResetStudentPasswordInputSchema = z.object({ requestId: z.uuid() });
export const ResetStudentPasswordResultSchema = z.object({
  credential: StudentCredentialSchema.nullable(),
  replayed: z.boolean(),
});

export type SchoolClassInput = z.infer<typeof SchoolClassInputSchema>;
export type SchoolClass = z.infer<typeof SchoolClassSchema>;
export type UpdateSchoolClassInput = z.infer<typeof UpdateSchoolClassInputSchema>;
export type BulkCreateStudentsInput = z.infer<typeof BulkCreateStudentsInputSchema>;
export type BulkCreateStudentsResult = z.infer<typeof BulkCreateStudentsResultSchema>;
export type StudentCredential = z.infer<typeof StudentCredentialSchema>;
