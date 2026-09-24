import { LessonArtifactViewResultSchema, LessonDetailSchema, StudentLibrarySchema } from "@continuum/shared";
import { apiRequestParsed } from "@/lib/api/client";

export const studentLibraryApi = {
  getLibrary: () => apiRequestParsed("/student/library", StudentLibrarySchema),
  getLesson: (lessonId: string) =>
    apiRequestParsed(`/student/library/lessons/${lessonId}`, LessonDetailSchema),
  getArtifactView: (artifactId: string) =>
    apiRequestParsed(`/student/library/artifacts/${artifactId}/view`, LessonArtifactViewResultSchema),
};
