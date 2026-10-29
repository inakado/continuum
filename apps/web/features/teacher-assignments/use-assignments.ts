"use client";
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { assignmentQueryKeys, teacherWorkQueryKeys } from '@/lib/query/keys';
import type { AssignmentCreate, AssignmentReport } from '@continuum/shared';
import { teacherAssignmentsApi } from './teacher-assignments.api';

export const useAssignments = () => useQuery({ queryKey: assignmentQueryKeys.list(), queryFn: teacherAssignmentsApi.list, refetchInterval: 10000, refetchIntervalInBackground: false });
export const useAssignmentReport = (id: string) => useQuery({ queryKey: assignmentQueryKeys.report(id), queryFn: () => teacherAssignmentsApi.report(id), refetchInterval: 10000, refetchIntervalInBackground: false });
export const useAssignmentPrepare = (id: string, version?: number) => useQuery({ queryKey: assignmentQueryKeys.prepare(id, version), queryFn: () => teacherAssignmentsApi.prepare(id, version), staleTime: Infinity, gcTime: 0, refetchOnWindowFocus: false });
export const useRevocationPreview = (id: string) => useQuery({ queryKey: assignmentQueryKeys.revocation(id), queryFn: () => teacherAssignmentsApi.revocation(id), gcTime: 0, retry: false, refetchOnWindowFocus: false });
export function useRevokeAssignment(onRemoved: () => void) {
  const cache = useQueryClient();
  return useMutation({ mutationFn: teacherAssignmentsApi.revoke, retry: false, onSuccess: (result) => {
    cache.setQueryData<AssignmentReport>(assignmentQueryKeys.report(result.versionId), (previous) => {
      if (!previous) return previous;
      const recipients = previous.recipients.filter((item) => item.assignmentId !== result.id);
      return { ...previous, classes: previous.classes.filter((item) => item.id !== result.id), recipients, studentCount: recipients.length, completedCount: recipients.filter((item) => item.status === 'completed').length,
        allPhotosCount: previous.extendedTaskCount ? recipients.filter((item) => item.progress.photoTaskCount === previous.extendedTaskCount).length : 0,
        allReviewsPublishedCount: previous.extendedTaskCount ? recipients.filter((item) => item.progress.publishedReviewTaskCount === previous.extendedTaskCount).length : 0 };
    });
    cache.removeQueries({ queryKey: assignmentQueryKeys.revocation(result.id) });
    onRemoved();
    void cache.invalidateQueries({ queryKey: assignmentQueryKeys.all() });
    void cache.invalidateQueries({ queryKey: teacherWorkQueryKeys.all() });
  } });
}
export function useAssignWork(id: string) {
  const cache = useQueryClient();
  return useMutation({ mutationFn: (input: AssignmentCreate) => teacherAssignmentsApi.assign(id, input), retry: false,
    onSuccess: () => { void cache.invalidateQueries({ queryKey: assignmentQueryKeys.all() }); void cache.invalidateQueries({ queryKey: teacherWorkQueryKeys.list() }); } });
}
