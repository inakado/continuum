import { BULK_ACTION_LIMIT } from './bulk-actions';
import { z } from "zod";
import { GradeBandSchema } from "./library";

export const TeacherStudentSchema = z.object({
  lifecycleRevision: z.number().int().positive().optional(),
  id: z.uuid(),
  login: z.string().min(1),
  name: z.string().min(1),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  middleName: z.string().nullable().default(null),
  classId: z.uuid().nullable().default(null),
  isActive: z.boolean(),
  gradeBands: z.array(GradeBandSchema),
});

export const TeacherStudentsSchema = z.object({
  students: z.array(TeacherStudentSchema),
});

export const CreateTeacherStudentInputSchema = z.object({
  login: z
    .string()
    .trim()
    .toLowerCase()
    .min(3)
    .max(64)
    .regex(/^[a-z0-9._-]+$/),
  password: z.string().min(8).max(128),
  firstName: z.string().trim().min(1).max(100).nullable().optional(),
  lastName: z.string().trim().min(1).max(100).nullable().optional(),
  middleName: z.string().trim().min(1).max(100).nullable().optional(),
});

export const SetStudentActiveInputSchema = z.object({
  isActive: z.boolean(),
});

const StudentNamesSchema = z.strictObject({
  firstName: z.string().max(100).nullable(),
  lastName: z.string().max(100).nullable(),
  middleName: z.string().max(100).nullable(),
});
export const UpdateStudentNamesInputSchema = z.strictObject({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  middleName: z.string().trim().min(1).max(100).nullable(),
  expected: StudentNamesSchema,
});
export type UpdateStudentNamesInput = z.infer<typeof UpdateStudentNamesInputSchema>;

export const TeacherStudentMutationResultSchema = z.object({
  id: z.uuid(),
  isActive: z.boolean(),
});

export type TeacherStudent = z.infer<typeof TeacherStudentSchema>;
export type TeacherStudents = z.infer<typeof TeacherStudentsSchema>;
export type CreateTeacherStudentInput = z.infer<typeof CreateTeacherStudentInputSchema>;
export type SetStudentActiveInput = z.infer<typeof SetStudentActiveInputSchema>;
export type TeacherStudentMutationResult = z.infer<typeof TeacherStudentMutationResultSchema>;

const StudentRevisionSchema = z.strictObject({ id: z.uuid(), expectedRevision: z.number().int().positive().max(2147483646) });
export const StudentsBulkDeleteSchema = z.strictObject({ items: z.array(StudentRevisionSchema).min(1).max(BULK_ACTION_LIMIT) }).refine(input => new Set(input.items.map(item => item.id)).size === input.items.length, 'Повторяющиеся ученики.');
export const StudentDeletionSchema = z.strictObject({ id: z.uuid(), deletionRevision: z.number().int().positive() });
export const StudentsBulkDeletionSchema = z.strictObject({ items: z.array(StudentDeletionSchema).min(1).max(BULK_ACTION_LIMIT) });
export const StudentsBulkRestoreSchema = z.strictObject({ items: z.array(StudentDeletionSchema).min(1).max(BULK_ACTION_LIMIT) }).refine(input => new Set(input.items.map(item => item.id)).size === input.items.length, 'Повторяющиеся ученики.');
export const StudentsBulkRestoredSchema = z.strictObject({ items: z.array(z.strictObject({ id: z.uuid() })).min(1).max(BULK_ACTION_LIMIT) });
export type StudentsBulkDelete = z.infer<typeof StudentsBulkDeleteSchema>;
export type StudentsBulkRestore = z.infer<typeof StudentsBulkRestoreSchema>;
export type StudentsBulkDeletion = z.infer<typeof StudentsBulkDeletionSchema>;
