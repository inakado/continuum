import { StudentAttemptStateSchema, StudentWorkDetailSchema, StudentWorkListSchema, StudentWorkAvailabilitySchema, type AttemptSave } from '@continuum/shared';
import { apiRequestParsed } from '@/lib/api/client';

const root = '/student/assessment-works';
export const studentWorksApi = {
  list: () => apiRequestParsed(root, StudentWorkListSchema),
  detail: (id: string) => apiRequestParsed(`${root}/${id}`, StudentWorkDetailSchema),
  availability: (id: string) => apiRequestParsed(`${root}/${id}/availability`, StudentWorkAvailabilitySchema),
  start: (id: string) => apiRequestParsed(`${root}/${id}/start`, StudentAttemptStateSchema, { method: 'POST' }),
  save: (id: string, taskId: string, body: AttemptSave) => apiRequestParsed(`${root}/${id}/answers/${taskId}`, StudentAttemptStateSchema, { method: 'PATCH', body, signal: AbortSignal.timeout(20_000) }),
  finish: (id: string, expectedRevision: number) => apiRequestParsed(`${root}/${id}/finish`, StudentAttemptStateSchema, { method: 'POST', body: { expectedRevision } }),
};
