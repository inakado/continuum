import { describe, expect, it } from 'vitest';
import { ReviewerKeySchema, ReviewerMeSchema, ReviewerKeyCreateSchema, ReviewerPublicationSchema, ReviewerReportCreateSchema, ReviewerDraftSchema } from '../src/contracts/reviewer';
const id = 'cc1057ef-4534-49fc-8a7b-b1a153fed59a';
describe('reviewer boundary', () => {
  it('requires explicit classes or students and never accepts assignment or permissions overrides', () => {
    const input = { name: 'Рабочий Mac', password: 'password', classIds: [id], studentIds: [] };
    expect(ReviewerKeyCreateSchema.parse(input).classIds).toEqual([id]);
    expect(ReviewerKeyCreateSchema.safeParse({ ...input, classIds: [] }).success).toBe(false);
    expect(ReviewerKeyCreateSchema.safeParse({ ...input, classIds: [], studentIds: [id] }).success).toBe(true);
    expect(ReviewerKeyCreateSchema.safeParse({ ...input, assignmentIds: [id] }).success).toBe(false);
    expect(ReviewerKeyCreateSchema.safeParse({ ...input, scopes: ['read', 'publish'] }).success).toBe(false);
    expect(ReviewerKeyCreateSchema.safeParse({ ...input, classIds: [id, id] }).success).toBe(false);
    expect(ReviewerKeyCreateSchema.safeParse({ ...input, userId: id }).success).toBe(false);
  });
  it('accepts no-expiry keys and legacy deadlines, rejecting malformed expiry', () => {
    const principal = { userId: id, login: 'teacher', keyId: id, scopes: ['read'], classIds: [id], studentIds: [], expiresAt: null };
    expect(ReviewerMeSchema.parse(principal).expiresAt).toBeNull();
    const entry = { id, name: 'Mac', scopes: ['read'], classIds: [id], studentIds: [], createdAt: '2026-10-31T00:00:00Z', expiresAt: null, lastUsedAt: null, revokedAt: null };
    expect(ReviewerKeySchema.parse(entry).expiresAt).toBeNull();
    expect(ReviewerKeySchema.parse({ ...entry, expiresAt: '2026-11-30T00:00:00Z' }).expiresAt).not.toBeNull();
    expect(ReviewerMeSchema.safeParse({ ...principal, expiresAt: 'forever' }).success).toBe(false);
  });
  it('binds PDF and drafts to exact source revisions, with null distinct from zero', () => {
    expect(ReviewerReportCreateSchema.safeParse({ solutionId: id, sourceRevision: 1 }).success).toBe(true);
    const input = { requestId: id, sourceRevision: 1, expectedReviewRevision: 0, points: 0, reportId: id };
    expect(ReviewerDraftSchema.parse(input).points).toBe(0);
    expect(ReviewerDraftSchema.parse({ ...input, points: null }).points).toBeNull();
    expect(ReviewerDraftSchema.safeParse({ ...input, points: -1 }).success).toBe(false);
  });
  it('rejects empty publications and duplicate reviews', () => {
    const item = { reviewId: id, reviewRevision: 1, sourceRevision: 1, expectedPublishedRevision: null };
    expect(ReviewerPublicationSchema.safeParse({ requestId: id, items: [item] }).success).toBe(true);
    expect(ReviewerPublicationSchema.safeParse({ requestId: id, items: [] }).success).toBe(false);
    expect(ReviewerPublicationSchema.safeParse({ requestId: id, items: [item, item] }).success).toBe(false);
  });
});
