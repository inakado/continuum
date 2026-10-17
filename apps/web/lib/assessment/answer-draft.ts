import { z } from 'zod';
import { AssessmentAnswerSchema, type StudentWorkDetail } from '@continuum/shared';

const prefix = 'continuum:answer-draft:';
const schema = z.strictObject({ owner: z.string().min(1), recipient: z.string(), version: z.number().int().positive(), revision: z.number().int().positive(), expires: z.number(),
  answers: z.record(z.string(), AssessmentAnswerSchema), base: z.record(z.string(), AssessmentAnswerSchema) });
export type AnswerDraft = z.infer<typeof schema>;
const key = (owner: string, work: StudentWorkDetail) => `${prefix}${owner}:${work.id}:${work.versionNumber}`;
export function clearAnswerDrafts(exceptOwner?: string) {
  try {
    for (const name of Object.keys(localStorage)) {
      if (!name.startsWith(prefix)) continue;
      let keep = false;
      try { const draft = schema.safeParse(JSON.parse(localStorage.getItem(name) ?? 'null')); keep = Boolean(exceptOwner && name.startsWith(`${prefix}${exceptOwner}:`) && draft.success && draft.data.expires > Date.now()); } catch { keep = false; }
      if (!keep) localStorage.removeItem(name);
    }
  } catch { /* Storage can be unavailable on shared/private devices. */ }
}
export function readAnswerDraft(owner: string, work: StudentWorkDetail): AnswerDraft | null {
  try {
    const name = key(owner, work), raw = localStorage.getItem(name);
    if (!raw) return null;
    const result = schema.safeParse(JSON.parse(raw));
    if (!result.success || result.data.owner !== owner || result.data.recipient !== work.id || result.data.version !== work.versionNumber || result.data.expires <= Date.now() || work.status === 'completed') { localStorage.removeItem(name); return null; }
    return result.data;
  } catch { return null; }
}
export function removeAnswerDraft(owner: string, work: StudentWorkDetail) {
  try { localStorage.removeItem(key(owner, work)); } catch { /* Storage can be unavailable. */ }
}

export function draftMatchesServer(draft: AnswerDraft, work: StudentWorkDetail): boolean {
  const ids = new Set([...Object.keys(draft.answers), ...Object.keys(draft.base)]);
  return [...ids].every((id) => work.items.some((item) => item.id === id) && JSON.stringify(work.answers[id] ?? null) === JSON.stringify(draft.base[id] ?? null));
}
