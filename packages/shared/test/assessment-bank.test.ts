import { expect, it } from 'vitest';
import { AssessmentBankCorrectionSchema } from '../src/contracts/assessment-bank';

it('requires a preview and a concrete version for corrections and forbids extra fields', () => {
  const input = { importId: '00000000-0000-4000-8000-000000000001', expectedVersion: 1 };
  expect(AssessmentBankCorrectionSchema.parse(input)).toEqual(input);
  for (const bad of [{ ...input, expectedVersion: 0 }, { ...input, expectedVersion: '1' }, { expectedVersion: 1 }, { ...input, grading: {} }]) expect(AssessmentBankCorrectionSchema.safeParse(bad).success).toBe(false);
});
import { AssessmentBankDeleteSchema, AssessmentBankRestoreSchema, AssessmentBankDeleteResultSchema, AssessmentBankQuerySchema } from '../src/contracts/assessment-bank';

it('validates exam and exact provider filters', () => {
  expect(AssessmentBankQuerySchema.parse({ exam: 'none', source: ' Авторское ' })).toMatchObject({ exam: 'none', source: 'Авторское' });
  expect(AssessmentBankQuerySchema.parse({})).not.toHaveProperty('exam');
  for (const input of [{ exam: 'oge' }, { source: '' }, { source: 'x'.repeat(161) }]) expect(AssessmentBankQuerySchema.safeParse(input).success).toBe(false);
});

it('requires exact content and lifecycle revisions for deletion and undo', () => {
  expect(AssessmentBankDeleteSchema.safeParse({ expectedVersion: 1 }).success).toBe(false);
  expect(AssessmentBankDeleteSchema.parse({ expectedVersion: 1, expectedLifecycleRevision: 2 })).toEqual({ expectedVersion: 1, expectedLifecycleRevision: 2 });
  for (const revision of [0, -1, 1.5, '2', 2147483647]) {
    expect(AssessmentBankRestoreSchema.safeParse({ expectedVersion: 1, expectedDeletionRevision: revision }).success).toBe(false);
  }
  expect(AssessmentBankRestoreSchema.safeParse({ expectedVersion: 1, expectedDeletionRevision: 2, extra: true }).success).toBe(false);
  expect(AssessmentBankDeleteResultSchema.safeParse({ id: '00000000-0000-4000-8000-000000000001', version: 1, deletionRevision: 2 }).success).toBe(true);
});

it('keeps pinned ordered import references and still reads old confirm receipts', async () => {
  const { AssessmentImportResultSchema } = await import('../src/contracts/assessment-bank');
  const old = { added: 0, updated: 0, unchanged: 1, taskIds: ['00000000-0000-4000-8000-000000000001'] };
  expect(AssessmentImportResultSchema.parse(old)).toEqual(old);
  const receipt = { ...old, items: [{ taskId: old.taskIds[0], version: 2 }], gradeBands: ['grade_10_11'] };
  expect(AssessmentImportResultSchema.parse(receipt)).toEqual(receipt);
  expect(AssessmentImportResultSchema.safeParse({ ...receipt, items: [{ taskId: old.taskIds[0] }] }).success).toBe(false);
});
