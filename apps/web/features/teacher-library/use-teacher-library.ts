"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { teacherLibraryQueryKeys } from "@/lib/query/keys";
import { teacherLibraryApi } from "./teacher-library.api";

const useRefreshTeacherLibrary = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: teacherLibraryQueryKeys.all() });
};

export const useTeacherLibrary = () =>
  useQuery({
    queryKey: teacherLibraryQueryKeys.all(),
    queryFn: teacherLibraryApi.getLibrary,
  });

export const useTeacherLesson = (lessonId: string | null) =>
  useQuery({
    queryKey: teacherLibraryQueryKeys.lesson(lessonId ?? ""),
    queryFn: () => teacherLibraryApi.getLesson(lessonId ?? ""),
    enabled: Boolean(lessonId),
  });

export const useCreateSection = () => {
  const refresh = useRefreshTeacherLibrary();
  return useMutation({ mutationFn: teacherLibraryApi.createSection, onSuccess: refresh });
};

export const useCreateLesson = () => {
  const refresh = useRefreshTeacherLibrary();
  return useMutation({ mutationFn: teacherLibraryApi.createLesson, onSuccess: refresh });
};

export const useUpdateSection = () => {
  const refresh = useRefreshTeacherLibrary();
  return useMutation({
    mutationFn: ({ sectionId, title }: { sectionId: string; title: string }) =>
      teacherLibraryApi.updateSection(sectionId, title),
    onSuccess: refresh,
  });
};

export const useUpdateLesson = () => {
  const queryClient = useQueryClient();
  const refresh = useRefreshTeacherLibrary();
  return useMutation({
    mutationFn: ({ lessonId, title }: { lessonId: string; title: string }) =>
      teacherLibraryApi.updateLesson(lessonId, title),
    onSuccess: async (_, variables) => {
      await refresh();
      await queryClient.invalidateQueries({
        queryKey: teacherLibraryQueryKeys.lesson(variables.lessonId),
      });
    },
  });
};

export const usePublishSection = () => {
  const refresh = useRefreshTeacherLibrary();
  return useMutation({ mutationFn: teacherLibraryApi.publishSection, onSuccess: refresh });
};

export const usePublishLesson = () => {
  const queryClient = useQueryClient();
  const refresh = useRefreshTeacherLibrary();
  return useMutation({
    mutationFn: teacherLibraryApi.publishLesson,
    onSuccess: async (_, lessonId) => {
      await refresh();
      await queryClient.invalidateQueries({
        queryKey: teacherLibraryQueryKeys.lesson(lessonId),
      });
    },
  });
};

export const useUploadLessonArtifact = () => {
  const queryClient = useQueryClient();
  const refresh = useRefreshTeacherLibrary();
  return useMutation({
    mutationFn: teacherLibraryApi.uploadArtifact,
    onSuccess: async (_, variables) => {
      await refresh();
      await queryClient.invalidateQueries({
        queryKey: teacherLibraryQueryKeys.lesson(variables.lessonId),
      });
    },
  });
};
