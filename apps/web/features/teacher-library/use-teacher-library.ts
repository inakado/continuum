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

export const useCreateSection = () => {
  const refresh = useRefreshTeacherLibrary();
  return useMutation({ mutationFn: teacherLibraryApi.createSection, onSuccess: refresh });
};

export const useCreateLesson = () => {
  const refresh = useRefreshTeacherLibrary();
  return useMutation({ mutationFn: teacherLibraryApi.createLesson, onSuccess: refresh });
};

export const usePublishSection = () => {
  const refresh = useRefreshTeacherLibrary();
  return useMutation({ mutationFn: teacherLibraryApi.publishSection, onSuccess: refresh });
};

export const usePublishLesson = () => {
  const refresh = useRefreshTeacherLibrary();
  return useMutation({ mutationFn: teacherLibraryApi.publishLesson, onSuccess: refresh });
};
