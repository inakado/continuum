"use client";

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AssessmentBankQuery, AssessmentBankDelete, AssessmentBankDeletion, AssessmentBankCorrection } from '@continuum/shared';
import { teacherBankQueryKeys, teacherWorkQueryKeys, statisticsQueryKeys } from '@/lib/query/keys';
import { teacherBankApi } from './teacher-bank.api';

export function useTeacherBank(query: AssessmentBankQuery) {
  const [settledSearch, setSettledSearch] = useState(query.search);
  useEffect(() => {
    const timer = setTimeout(() => setSettledSearch(query.search), 300);
    return () => clearTimeout(timer);
  }, [query.search]);
  return useQuery({
    queryKey: teacherBankQueryKeys.list(query),
    queryFn: ({ signal }) => teacherBankApi.list(query, signal),
    enabled: !query.search || query.search === settledSearch,
  });
}
export const useTeacherBankTask = (id: string | null, version?: number) => useQuery({ queryKey: teacherBankQueryKeys.task(id ?? '', version), queryFn: () => teacherBankApi.view(id!, version), enabled: Boolean(id) });
export const useBankImportTask = (id: string | null, stableId: string | null) => useQuery({ queryKey: teacherBankQueryKeys.importTask(id ?? '', stableId ?? ''), queryFn: () => teacherBankApi.previewTask(id!, stableId!), enabled: Boolean(id && stableId), gcTime: 0, retry: false });
export const useBankDuplicateHints = (id: string | null) => useQuery({ queryKey: teacherBankQueryKeys.duplicates(id ?? ''), queryFn: () => teacherBankApi.duplicates(id!), enabled: Boolean(id), gcTime: 0, retry: false, refetchOnWindowFocus: false });
export const usePreviewBankImport = () => useMutation({ mutationFn: teacherBankApi.preview, retry: false, gcTime: 0 });
export const useBankCorrectionImpact = (id: string, importId: string | null, version: number, enabled: boolean) => useQuery({
  queryKey: teacherBankQueryKeys.correctionImpact(id, importId ?? '', version), queryFn: () => teacherBankApi.correctionPreview(id, { importId: importId!, expectedVersion: version }),
  enabled: enabled && Boolean(importId), gcTime: 0, retry: false, refetchOnWindowFocus: false,
});
export function useCorrectBankTask() {
  const cache = useQueryClient();
  return useMutation({ mutationFn: ({ id, ...input }: AssessmentBankCorrection & { id: string }) => teacherBankApi.correct(id, input), retry: false,
    onSuccess: async () => { await Promise.all([teacherBankQueryKeys.all(), teacherWorkQueryKeys.all(), statisticsQueryKeys.all()].map((queryKey) => cache.invalidateQueries({ queryKey }))); } });
}
export function useConfirmBankImport() {
  const cache = useQueryClient();
  return useMutation({ mutationFn: teacherBankApi.confirm, retry: false, onSuccess: () => cache.invalidateQueries({ queryKey: teacherBankQueryKeys.all() }) });
}

export function useRemoveBankTask(onDeleted: (receipt: AssessmentBankDeletion) => void) {
  const cache = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: AssessmentBankDelete & { id: string }) => teacherBankApi.remove(id, input),
    retry: false,
    onSuccess: async (receipt) => { onDeleted(receipt); await cache.invalidateQueries({ queryKey: teacherBankQueryKeys.all() }); },
    onError: () => { void cache.invalidateQueries({ queryKey: teacherBankQueryKeys.all() }); },
  });
}
