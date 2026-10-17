"use client";

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssessmentBankQuery } from '@continuum/shared';
import { teacherBankQueryKeys } from '@/lib/query/keys';
import { teacherBankApi } from './teacher-bank.api';

export const useTeacherBank = (query: AssessmentBankQuery) => useQuery({ queryKey: teacherBankQueryKeys.list(query), queryFn: () => teacherBankApi.list(query) });
export const useTeacherBankTask = (id: string | null, version?: number) => useQuery({ queryKey: teacherBankQueryKeys.task(id ?? '', version), queryFn: () => teacherBankApi.view(id!, version), enabled: Boolean(id) });
export const useBankImportTask = (id: string | null, stableId: string | null) => useQuery({ queryKey: teacherBankQueryKeys.importTask(id ?? '', stableId ?? ''), queryFn: () => teacherBankApi.previewTask(id!, stableId!), enabled: Boolean(id && stableId), gcTime: 0, retry: false });
export const usePreviewBankImport = () => useMutation({ mutationFn: teacherBankApi.preview, retry: false, gcTime: 0 });
export function useConfirmBankImport() {
  const cache = useQueryClient();
  return useMutation({ mutationFn: teacherBankApi.confirm, retry: false, onSuccess: () => cache.invalidateQueries({ queryKey: teacherBankQueryKeys.all() }) });
}
