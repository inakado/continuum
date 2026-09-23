"use client";

import { useQuery } from "@tanstack/react-query";
import { studentLibraryQueryKeys } from "@/lib/query/keys";
import { studentLibraryApi } from "./student-library.api";

export const useStudentLibrary = () =>
  useQuery({
    queryKey: studentLibraryQueryKeys.all(),
    queryFn: studentLibraryApi.getLibrary,
  });

export const useStudentLesson = (lessonId: string) =>
  useQuery({
    queryKey: studentLibraryQueryKeys.lesson(lessonId),
    queryFn: () => studentLibraryApi.getLesson(lessonId),
    enabled: lessonId.length > 0,
  });
