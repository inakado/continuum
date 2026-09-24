import {
  LessonSummarySchema,
  LessonArtifactSchema,
  LessonArtifactViewResultSchema,
  LibrarySectionSchema,
  PrepareLessonArtifactUploadResultSchema,
  PublicationResultSchema,
  TeacherLessonDetailSchema,
  TeacherLibrarySchema,
  type LessonArtifactType,
  type CreateLessonInput,
  type CreateSectionInput,
} from "@continuum/shared";
import { ApiError, apiRequestParsed } from "@/lib/api/client";

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
    const metadata = {
      type,
      filename: file.name,
      contentType,
      sizeBytes: file.size,
    };
    const ticket = await apiRequestParsed(
      `/teacher/library/lessons/${lessonId}/artifacts/upload-url`,
      PrepareLessonArtifactUploadResultSchema,
      { method: "POST", body: metadata },
    );
    const upload = await fetch(ticket.uploadUrl, {
      method: "PUT",
      headers: ticket.headers,
      body: file,
    });
    if (!upload.ok) {
      throw new ApiError(upload.status, "Не удалось загрузить файл.", "ARTIFACT_UPLOAD_FAILED");
    }
    return apiRequestParsed(
      `/teacher/library/lessons/${lessonId}/artifacts`,
      LessonArtifactSchema,
      {
        method: "POST",
        body: { ...metadata, objectKey: ticket.objectKey },
      },
    );
  },
  getArtifactView: (artifactId: string) =>
    apiRequestParsed(
      `/teacher/library/artifacts/${artifactId}/view`,
      LessonArtifactViewResultSchema,
    ),
};
