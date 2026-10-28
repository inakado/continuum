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
  return useMutation({ mutationFn: teacherStudentsApi.createStudent, onSuccess: refresh, gcTime: 0, retry: false });
};

export const useSetStudentActive = () => {
  const refresh = useRefreshStudents();
  return useMutation({ mutationFn: teacherStudentsApi.setActive, onSuccess: refresh });
};

export const useSetStudentAccess = () => {
  const refresh = useRefreshStudents();
  return useMutation({ mutationFn: teacherStudentsApi.setAccess, onSuccess: refresh });
};

export const useSchoolClasses = () => useQuery({ queryKey: teacherStudentsQueryKeys.classes(), queryFn: teacherStudentsApi.getClasses });
export const useUpdateSchoolClass = () => {
  const refresh = useRefreshStudents();
  return useMutation({ mutationFn: teacherStudentsApi.updateClass, onSuccess: refresh });
};
export const useSetStudentClass = () => {
  const refresh = useRefreshStudents();
  return useMutation({ mutationFn: teacherStudentsApi.setClass, onSuccess: refresh });
};
export const useBulkCreateStudents = () => {
  const refresh = useRefreshStudents();
  return useMutation({ mutationFn: teacherStudentsApi.createStudents, onSuccess: refresh, retry: false, gcTime: 0 });
};
export const useResetStudentPassword = () => useMutation({ mutationFn: teacherStudentsApi.resetPassword, retry: false, gcTime: 0 });
export const useDeleteSchoolClass = () => {
  const refresh = useRefreshStudents();
  return useMutation({ mutationFn: teacherStudentsApi.deleteClass, onSuccess: refresh });
};
export const useUpdateStudentNames = () => {
  const refresh = useRefreshStudents();
  return useMutation({ mutationFn: teacherStudentsApi.updateNames, onSuccess: refresh, onError: refresh, retry: false });
};
