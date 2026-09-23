"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { teacherStudentsQueryKeys } from "@/lib/query/keys";
import { teacherStudentsApi } from "./teacher-students.api";

const useRefreshStudents = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: teacherStudentsQueryKeys.all() });
};

export const useTeacherStudents = () =>
  useQuery({
    queryKey: teacherStudentsQueryKeys.all(),
    queryFn: teacherStudentsApi.getStudents,
  });

export const useCreateStudent = () => {
  const refresh = useRefreshStudents();
  return useMutation({ mutationFn: teacherStudentsApi.createStudent, onSuccess: refresh });
};

export const useSetStudentActive = () => {
  const refresh = useRefreshStudents();
  return useMutation({ mutationFn: teacherStudentsApi.setActive, onSuccess: refresh });
};

export const useSetStudentAccess = () => {
  const refresh = useRefreshStudents();
  return useMutation({ mutationFn: teacherStudentsApi.setAccess, onSuccess: refresh });
};
