import {
  LessonSummarySchema,
  LibrarySectionSchema,
  PublicationResultSchema,
  TeacherLibrarySchema,
  type CreateLessonInput,
  type CreateSectionInput,
} from "@continuum/shared";
import { apiRequestParsed } from "@/lib/api/client";

export const teacherLibraryApi = {
  getLibrary: () => apiRequestParsed("/teacher/library", TeacherLibrarySchema),
  createSection: (input: CreateSectionInput) =>
    apiRequestParsed("/teacher/library/sections", LibrarySectionSchema, {
      method: "POST",
      body: input,
    }),
  createLesson: (input: CreateLessonInput) =>
    apiRequestParsed("/teacher/library/lessons", LessonSummarySchema, {
      method: "POST",
      body: input,
    }),
  publishSection: (sectionId: string) =>
    apiRequestParsed(
      `/teacher/library/sections/${sectionId}/publish`,
      PublicationResultSchema,
      { method: "PATCH" },
    ),
  publishLesson: (lessonId: string) =>
    apiRequestParsed(
      `/teacher/library/lessons/${lessonId}/publish`,
      PublicationResultSchema,
      { method: "PATCH" },
    ),
};
