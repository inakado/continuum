import { expect, it } from 'vitest';
import { AssessmentBankBulkDeleteSchema, AssessmentBankBulkRestoreSchema, StudentsBulkDeleteSchema, StudentsBulkRestoreSchema } from '../src';
const id = '00000000-0000-4000-8000-000000000001';
it('bounds destructive batches and rejects duplicate, invalid or unversioned references', () => {
  const bank = { id, expectedVersion: 1, expectedLifecycleRevision: 1 };
  const student = { id, expectedRevision: 1 };
  for (const [schema, item] of [[AssessmentBankBulkDeleteSchema, bank], [StudentsBulkDeleteSchema, student]] as const) {
    expect(schema.safeParse({ items: [item] }).success).toBe(true);
    expect(schema.safeParse({ items: [] }).success).toBe(false);
    expect(schema.safeParse({ items: [item, item] }).success).toBe(false);
    expect(schema.safeParse({ items: Array(101).fill(item) }).success).toBe(false);
    expect(schema.safeParse({ items: [{ id }] }).success).toBe(false);
    expect(schema.safeParse({ items: [{ ...item, id: 'invalid' }] }).success).toBe(false);
  }
  expect(AssessmentBankBulkRestoreSchema.safeParse({ items: [{ id, expectedVersion: 1, expectedDeletionRevision: 2 }] }).success).toBe(true);
  expect(StudentsBulkRestoreSchema.safeParse({ items: [{ id, deletionRevision: 0 }] }).success).toBe(false);
});
