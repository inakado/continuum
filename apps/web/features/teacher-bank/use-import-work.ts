"use client";

import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { AssessmentImportResult, AssessmentWorkCreate, GradeBand } from '@continuum/shared';
import { useCreateTeacherWork } from '@/features/teacher-works/use-teacher-works';
import { teacherBankApi } from './teacher-bank.api';

export function useImportWork(importId: string, title: string, result: AssessmentImportResult) {
  const create = useCreateTeacherWork();
  const router = useRouter();
  const request = useRef<AssessmentWorkCreate | null>(null);
  const inFlight = useRef(false);
  async function createWork(gradeBand: GradeBand) {
    if (inFlight.current || !result.items?.length) return;
    inFlight.current = true;
    request.current ??= { id: crypto.randomUUID(), title, gradeBand, items: result.items };
    try {
      const work = await create.mutateAsync(request.current);
      router.push(`/teacher/works/${work.id}?from=import`);
      // Confirmed task assets remain owned by bank versions; failed cleanup is retried by the existing TTL flow.
      void teacherBankApi.discard(importId).catch(() => undefined);
    } catch { /* The mutation exposes the error and retains the same request for retry. */ }
    finally { inFlight.current = false; }
  }
  return { createWork, pending: create.isPending, error: create.error };
}
