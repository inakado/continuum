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
export function useCopyTeacherWork() {
  const cache = useQueryClient();
  return useMutation({ mutationFn: teacherWorksApi.copy, retry: false,
    onSuccess: (work) => { cache.setQueryData(teacherWorkQueryKeys.detail(work.id), work); void cache.invalidateQueries({ queryKey: teacherWorkQueryKeys.list() }); },
    onError: () => { void cache.invalidateQueries({ queryKey: teacherWorkQueryKeys.list() }); },
  });
}
export function useArchiveTeacherWork(onHidden: () => void) {
  const cache = useQueryClient();
  const refresh = () => { void cache.invalidateQueries({ queryKey: teacherWorkQueryKeys.all() }); };
  return useMutation({ mutationFn: teacherWorksApi.archive, retry: false, onSuccess: () => { onHidden(); refresh(); }, onError: refresh });
}
export function useRemoveTeacherWork(onRemoved: () => void) {
  const cache = useQueryClient();
  return useMutation({ mutationFn: teacherWorksApi.remove, retry: false,
    onSuccess: ({ id }) => { onRemoved(); cache.removeQueries({ queryKey: teacherWorkQueryKeys.detail(id) }); cache.removeQueries({ queryKey: teacherWorkQueryKeys.previews(id) }); void cache.invalidateQueries({ queryKey: teacherWorkQueryKeys.all() }); },
    onError: () => { void cache.invalidateQueries({ queryKey: teacherWorkQueryKeys.all() }); },
  });
}
