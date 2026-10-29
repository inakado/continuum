import { expect, it } from 'vitest';
import { AssessmentWorkUpdateSchema, AssessmentWorkFreezeSchema, AssessmentWorkCopySchema, AssessmentWorkArchiveSchema, AssessmentWorkDeleteSchema } from '../src/contracts/assessment-works';
import { AssessmentWorkAnswerCheckSchema, AssessmentWorkListSchema } from '../src/contracts/assessment-works';

const id = '00000000-0000-4000-8000-000000000001';

it('requires factual assignment presence in the work list instead of inferring it from deletion permission', () => {
  const work = { id, title: 'Кинематика', gradeBand: 'grade_10_11', revision: 1, taskCount: 30, maxPoints: 45, updatedAt: '2026-10-29T00:00:00Z', canDelete: false };
  for (const hasAssignments of [true, false]) expect(AssessmentWorkListSchema.parse([{ ...work, hasAssignments }])[0].hasAssignments).toBe(hasAssignments);
  expect(AssessmentWorkListSchema.safeParse([work]).success).toBe(false);
  expect(AssessmentWorkListSchema.safeParse([{ ...work, hasAssignments: 'true' }]).success).toBe(false);
});
const input = { requestId: id, expectedRevision: 1, title: 'МКТ', instructions: '', gradeBand: 'grade_10_11', items: [{ taskId: id, version: 1 }] };
it('checks only an answer against an explicit draft revision or immutable version', () => {
  const check = { taskId: id, source: { kind: 'draft', expectedRevision: 2 }, answer: { type: 'short_number', value: '-2,5' } };
  expect(AssessmentWorkAnswerCheckSchema.parse(check)).toEqual(check);
  expect(AssessmentWorkAnswerCheckSchema.parse({ ...check, source: { kind: 'version', number: 1 }, answer: null }).answer).toBeNull();
  for (const invalid of [{ ...check, source: { kind: 'draft' } }, { ...check, source: { kind: 'version', number: 0 } }, { ...check, grading: { answer: '1' } }, { ...check, source: { kind: 'draft', expectedRevision: 1, number: 1 } }, { ...check, answer: { type: 'short_number', value: '1'.repeat(65) } }]) expect(AssessmentWorkAnswerCheckSchema.safeParse(invalid).success).toBe(false);
});
it('accepts ordered pinned task references and an empty draft', () => {
  expect(AssessmentWorkUpdateSchema.parse(input).items).toEqual(input.items);
  expect(AssessmentWorkUpdateSchema.parse({ ...input, items: [] }).items).toEqual([]);
});
it('rejects duplicates, foreign content payloads and unversioned references', () => {
  expect(AssessmentWorkUpdateSchema.safeParse({ ...input, items: [...input.items, ...input.items] }).success).toBe(false);
  expect(AssessmentWorkUpdateSchema.safeParse({ ...input, items: [{ taskId: id }] }).success).toBe(false);
  expect(AssessmentWorkUpdateSchema.safeParse({ ...input, grading: {} }).success).toBe(false);
});
it('requires a positive revision when freezing a work', () => {
  expect(AssessmentWorkFreezeSchema.safeParse({ expectedRevision: 0 }).success).toBe(false);
  expect(AssessmentWorkFreezeSchema.parse({ expectedRevision: 1 })).toEqual({ expectedRevision: 1 });
});
it('accepts only a destination UUID and positive source revision for copying', () => {
  expect(AssessmentWorkCopySchema.parse({ id, expectedRevision: 2 })).toEqual({ id, expectedRevision: 2 });
  for (const invalid of [{ id: 'wrong', expectedRevision: 1 }, { id, expectedRevision: 0 }, { id }, { id, expectedRevision: 1, items: [] }, { id, expectedRevision: 1, teacherId: id }]) {
    expect(AssessmentWorkCopySchema.safeParse(invalid).success).toBe(false);
  }
});
it('requires explicit desired archive state and positive lifecycle revision', () => {
  expect(AssessmentWorkArchiveSchema.parse({ isArchived: false, expectedLifecycleRevision: 2 })).toEqual({ isArchived: false, expectedLifecycleRevision: 2 });
  for (const invalid of [{ isArchived: 'false', expectedLifecycleRevision: 1 }, { isArchived: true }, { isArchived: true, expectedLifecycleRevision: 0 }, { isArchived: true, expectedLifecycleRevision: 1, teacherId: id }]) expect(AssessmentWorkArchiveSchema.safeParse(invalid).success).toBe(false);
});
it('requires both revisions and rejects untrusted deletion options', () => {
  expect(AssessmentWorkDeleteSchema.parse({ expectedRevision: 3, expectedLifecycleRevision: 2 })).toEqual({ expectedRevision: 3, expectedLifecycleRevision: 2 });
  for (const invalid of [{ expectedRevision: 1 }, { expectedRevision: 0, expectedLifecycleRevision: 1 }, { expectedRevision: 1, expectedLifecycleRevision: 0 }, { expectedRevision: 1, expectedLifecycleRevision: 1, cascade: true }]) expect(AssessmentWorkDeleteSchema.safeParse(invalid).success).toBe(false);
});

it('creates an empty or atomically seeded work with the same reference rules as updates', async () => {
  const { AssessmentWorkCreateSchema } = await import('../src/contracts/assessment-works');
  const base = { id, title: 'Из пакета', gradeBand: 'grade_10_11' };
  expect(AssessmentWorkCreateSchema.parse(base)).toEqual(base);
  expect(AssessmentWorkCreateSchema.parse({ ...base, items: input.items }).items).toEqual(input.items);
  for (const items of [[...input.items, ...input.items], [{ taskId: id }], [{ taskId: id, version: 0 }], [{ ...input.items[0], statement: 'untrusted' }], Array.from({ length: 501 }, (_, index) => ({ taskId: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`, version: 1 }))]) {
    expect(AssessmentWorkCreateSchema.safeParse({ ...base, items }).success).toBe(false);
  }
});
