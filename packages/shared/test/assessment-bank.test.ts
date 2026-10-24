import { expect, it } from 'vitest';
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
