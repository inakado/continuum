import {
  LessonSummarySchema,
  LessonArtifactSchema,
  LessonArtifactViewResultSchema,
  LibrarySectionSchema,
  PublicationResultSchema,
  TeacherLessonDetailSchema,
  TeacherLibrarySchema,
  type LessonArtifactType,
  type CreateLessonInput,
  type CreateSectionInput,
} from "@continuum/shared";
import { apiRequestParsed } from "@/lib/api/client";

type ArtifactUpload = {
  lessonId: string;
  type: LessonArtifactType;
  file: File;
};

const normalizedContentType = (type: LessonArtifactType, file: File) => {
  if (file.type) return file.type;
  return type === "interactive" ? "application/zip" : "application/pdf";
};

export const teacherLibraryApi = {
  getLibrary: () => apiRequestParsed("/teacher/library", TeacherLibrarySchema),
  getLesson: (lessonId: string) =>
    apiRequestParsed(`/teacher/library/lessons/${lessonId}`, TeacherLessonDetailSchema),
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
  updateSection: (sectionId: string, title: string) =>
    apiRequestParsed(`/teacher/library/sections/${sectionId}`, LibrarySectionSchema, {
      method: "PATCH",
      body: { title },
    }),
  updateLesson: (lessonId: string, title: string) =>
    apiRequestParsed(`/teacher/library/lessons/${lessonId}`, LessonSummarySchema, {
      method: "PATCH",
      body: { title },
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
  uploadArtifact: async ({ lessonId, type, file }: ArtifactUpload) => {
    const contentType = normalizedContentType(type, file);
    const query = new URLSearchParams({
      type,
      filename: file.name,
      sizeBytes: String(file.size),
    });
    return apiRequestParsed(
      `/teacher/library/lessons/${lessonId}/artifacts/upload?${query}`,
      LessonArtifactSchema,
      { method: "PUT", body: file, contentType },
    );
  },
  getArtifactView: (artifactId: string) =>
    apiRequestParsed(
      `/teacher/library/artifacts/${artifactId}/view`,
      LessonArtifactViewResultSchema,
    ),
};
