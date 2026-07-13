import {
  TeacherTeachersListResponseSchema,
  type TeacherSummary as SharedTeacherSummary,
} from "@continuum/shared";
import { apiRequest, apiRequestParsed } from "./client";

export type AdminTeacherSummary = SharedTeacherSummary;

export const adminApi = {
  listTeachers() {
    return apiRequestParsed("/admin/teachers", TeacherTeachersListResponseSchema);
  },

  createTeacher(data: {
    login: string;
    firstName: string;
    lastName: string;
    middleName?: string | null;
    password?: string | null;
    generatePassword?: boolean;
  }) {
    return apiRequest<AdminTeacherSummary & { password?: string | null }>("/admin/teachers", {
      method: "POST",
      body: data,
    });
  },

  deleteTeacher(id: string) {
    return apiRequest<AdminTeacherSummary>(`/admin/teachers/${id}`, {
      method: "DELETE",
    });
  },
};
