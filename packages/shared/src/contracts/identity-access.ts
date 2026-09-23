import { z } from "zod";
import { GradeBandSchema } from "./library";

export const TeacherStudentSchema = z.object({
  id: z.uuid(),
  login: z.string().min(1),
  name: z.string().min(1),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
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
});

export const SetStudentActiveInputSchema = z.object({
  isActive: z.boolean(),
});

export const TeacherStudentMutationResultSchema = z.object({
  id: z.uuid(),
  isActive: z.boolean(),
});

export type TeacherStudent = z.infer<typeof TeacherStudentSchema>;
export type TeacherStudents = z.infer<typeof TeacherStudentsSchema>;
export type CreateTeacherStudentInput = z.infer<typeof CreateTeacherStudentInputSchema>;
export type SetStudentActiveInput = z.infer<typeof SetStudentActiveInputSchema>;
export type TeacherStudentMutationResult = z.infer<typeof TeacherStudentMutationResultSchema>;
