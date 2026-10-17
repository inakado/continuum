"use client";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assignmentQueryKeys } from '@/lib/query/keys';
import type { AssignmentCreate } from '@continuum/shared';
import { teacherAssignmentsApi } from './teacher-assignments.api';

export const useAssignments = () => useQuery({ queryKey: assignmentQueryKeys.list(), queryFn: teacherAssignmentsApi.list });
export const useAssignmentReport = (id: string) => useQuery({ queryKey: assignmentQueryKeys.report(id), queryFn: () => teacherAssignmentsApi.report(id), refetchInterval: 10000, refetchIntervalInBackground: false });
export const useAssignmentPrepare = (id: string, version?: number) => useQuery({ queryKey: assignmentQueryKeys.prepare(id, version), queryFn: () => teacherAssignmentsApi.prepare(id, version), staleTime: Infinity, gcTime: 0, refetchOnWindowFocus: false });
export function useAssignWork(id: string) {
  const cache = useQueryClient();
  return useMutation({ mutationFn: (input: AssignmentCreate) => teacherAssignmentsApi.assign(id, input), retry: false,
    onSuccess: () => { void cache.invalidateQueries({ queryKey: assignmentQueryKeys.all() }); } });
}
