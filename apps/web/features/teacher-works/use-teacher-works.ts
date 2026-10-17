"use client";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { teacherWorkQueryKeys } from '@/lib/query/keys';
import { teacherWorksApi } from './teacher-works.api';

export const useTeacherWorks = () => useQuery({ queryKey: teacherWorkQueryKeys.list(), queryFn: teacherWorksApi.list });
export const useTeacherWork = (id: string) => useQuery({ queryKey: teacherWorkQueryKeys.detail(id), queryFn: () => teacherWorksApi.detail(id) });
export function useCreateTeacherWork() {
  const cache = useQueryClient();
  return useMutation({ mutationFn: teacherWorksApi.create, onSuccess: (work) => { cache.setQueryData(teacherWorkQueryKeys.detail(work.id), work); void cache.invalidateQueries({ queryKey: teacherWorkQueryKeys.list() }); } });
}
