import { z } from 'zod';
import { ReviewerKeysSchema, ReviewerKeyCreatedSchema, ReviewerTargetsSchema, type ReviewerKeyCreate } from '@continuum/shared';
import { apiRequestParsed } from '@/lib/api/client';

const root = '/teacher/reviewer-access';
const ok = z.strictObject({ ok: z.literal(true) });
export const reviewerApi = {
  keys: () => apiRequestParsed(`${root}/keys`, ReviewerKeysSchema),
  targets: () => apiRequestParsed(`${root}/targets`, ReviewerTargetsSchema),
  createKey: (body: ReviewerKeyCreate, signal: AbortSignal) => apiRequestParsed(`${root}/keys`, ReviewerKeyCreatedSchema, { method: 'POST', body, signal }),
  revokeKey: (id: string) => apiRequestParsed(`${root}/keys/${id}`, ok, { method: 'DELETE' }),
};
