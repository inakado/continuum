import {
  SetAccessGrantResultSchema,
  TeacherStudentMutationResultSchema,
  TeacherStudentsSchema,
  type CreateTeacherStudentInput,
  type SetAccessGrantInput,
  type SetStudentActiveInput,
  SchoolClassesSchema, SchoolClassSchema, BulkCreateStudentsResultSchema, StudentClassResultSchema, ResetStudentPasswordResultSchema,
  type SchoolClassInput, type UpdateSchoolClassInput, type BulkCreateStudentsInput,
  DeletedSchoolClassResultSchema, DeletedStudentResultSchema,
} from "@continuum/shared";
import { apiRequestParsed } from "@/lib/api/client";

export const teacherStudentsApi = {
  deleteClass: ({ id, deleteStudents }: { id: string; deleteStudents: boolean }) => apiRequestParsed(`/teacher/classes/${id}`, DeletedSchoolClassResultSchema, { method: "DELETE", body: { deleteStudents } }),
  deleteStudent: (id: string) => apiRequestParsed(`/teacher/students/${id}`, DeletedStudentResultSchema, { method: "DELETE" }),
  getClasses: () => apiRequestParsed("/teacher/classes", SchoolClassesSchema),
  createClass: (input: SchoolClassInput) => apiRequestParsed("/teacher/classes", SchoolClassSchema, { method: "POST", body: input }),
  updateClass: ({ id, input }: { id: string; input: UpdateSchoolClassInput }) => apiRequestParsed(`/teacher/classes/${id}`, SchoolClassSchema, { method: "PATCH", body: input }),
  createStudents: (input: BulkCreateStudentsInput) => apiRequestParsed("/teacher/classes/students", BulkCreateStudentsResultSchema, { method: "POST", body: input }),
  setClass: ({ studentId, classId }: { studentId: string; classId: string | null }) => apiRequestParsed(`/teacher/students/${studentId}/class`, StudentClassResultSchema, { method: "PATCH", body: { classId } }),
  resetPassword: ({ studentId, requestId }: { studentId: string; requestId: string }) => apiRequestParsed(`/teacher/students/${studentId}/password-reset`, ResetStudentPasswordResultSchema, { method: "POST", body: { requestId } }),
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
