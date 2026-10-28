import { StudentsBulkDeleteSchema, StudentsBulkRestoreSchema, StudentsBulkDeletionSchema, StudentsBulkRestoredSchema, type StudentsBulkDelete, type StudentsBulkRestore } from '@continuum/shared';
import {
  SetAccessGrantResultSchema,
  TeacherStudentMutationResultSchema,
  TeacherStudentsSchema,
  type CreateTeacherStudentInput,
  type SetAccessGrantInput,
  type SetStudentActiveInput,
  SchoolClassesSchema, SchoolClassSchema, BulkCreateStudentsResultSchema, StudentClassResultSchema, ResetStudentPasswordResultSchema,
  type SchoolClassInput, type UpdateSchoolClassInput, type BulkCreateStudentsInput,
  DeletedSchoolClassResultSchema,
  type UpdateStudentNamesInput,
} from "@continuum/shared";
import { apiRequestParsed } from "@/lib/api/client";

export const teacherStudentsApi = {
  removeMany: (input: StudentsBulkDelete) => apiRequestParsed('/teacher/students/bulk-delete', StudentsBulkDeletionSchema, { method: 'POST', body: StudentsBulkDeleteSchema.parse(input) }),
  restoreMany: (input: StudentsBulkRestore) => apiRequestParsed('/teacher/students/bulk-restore', StudentsBulkRestoredSchema, { method: 'POST', body: StudentsBulkRestoreSchema.parse(input) }),
  updateNames: ({ studentId, input }: { studentId: string; input: UpdateStudentNamesInput }) => apiRequestParsed(`/teacher/students/${studentId}/names`, TeacherStudentMutationResultSchema, { method: 'PATCH', body: input }),
  deleteClass: ({ id, deleteStudents }: { id: string; deleteStudents: boolean }) => apiRequestParsed(`/teacher/classes/${id}`, DeletedSchoolClassResultSchema, { method: "DELETE", body: { deleteStudents } }),
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
