import { expect, it } from 'vitest';
import { AssessmentWorkUpdateSchema, AssessmentWorkFreezeSchema } from '../src/contracts/assessment-works';

const id = '00000000-0000-4000-8000-000000000001';
const input = { requestId: id, expectedRevision: 1, title: 'МКТ', instructions: '', gradeBand: 'grade_10_11', items: [{ taskId: id, version: 1 }] };
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
