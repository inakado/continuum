import {
  SetAccessGrantResultSchema,
  TeacherStudentMutationResultSchema,
  TeacherStudentsSchema,
  type CreateTeacherStudentInput,
  type SetAccessGrantInput,
  type SetStudentActiveInput,
} from "@continuum/shared";
import { apiRequestParsed } from "@/lib/api/client";

export const teacherStudentsApi = {
  getStudents: () => apiRequestParsed("/teacher/students", TeacherStudentsSchema),
  createStudent: (input: CreateTeacherStudentInput) =>
    apiRequestParsed("/teacher/students", TeacherStudentMutationResultSchema, {
      method: "POST",
      body: input,
    }),
  setActive: ({ studentId, input }: { studentId: string; input: SetStudentActiveInput }) =>
    apiRequestParsed(
      `/teacher/students/${studentId}/active`,
      TeacherStudentMutationResultSchema,
      { method: "PATCH", body: input },
    ),
  setAccess: (input: SetAccessGrantInput) =>
    apiRequestParsed("/teacher/library/access-grants", SetAccessGrantResultSchema, {
      method: "PUT",
      body: input,
    }),
};
