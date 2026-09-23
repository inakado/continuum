import { LessonDetailSchema, StudentLibrarySchema } from "@continuum/shared";
import { apiRequestParsed } from "@/lib/api/client";

export const studentLibraryApi = {
  getLibrary: () => apiRequestParsed("/student/library", StudentLibrarySchema),
  getLesson: (lessonId: string) =>
    apiRequestParsed(`/student/library/lessons/${lessonId}`, LessonDetailSchema),
};
