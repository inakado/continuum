import 'reflect-metadata';
import { expect, it, vi } from 'vitest';
import { AssignmentWriteService, isAssignmentWriteConflict } from '../src/assessment-assignments/assignment-write.service';

it('recognizes only Prisma serialization conflicts, including pg driver adapter errors', () => {
  for (const error of [{ code: 'P2034' }, { code: 'P2010', meta: { code: '40001' } }, { code: 'P2010', meta: { driverAdapterError: { cause: { originalCode: '40001', kind: 'TransactionWriteConflict' } } } }, { cause: { originalCode: '40001', kind: 'TransactionWriteConflict' } }]) expect(isAssignmentWriteConflict(error)).toBe(true);
  for (const error of [null, new Error('40001'), { code: 'P2010' }, { code: 'P2010', meta: { code: '23505' } }, { code: 'P2002' }, { code: 'P2010', meta: { driverAdapterError: { cause: { originalCode: '23505' } } } }]) expect(isAssignmentWriteConflict(error)).toBe(false);
});

it('retries rolled-back assignments but preserves business conflicts and returns 409 on exhaustion', async () => {
  const transaction = vi.fn().mockRejectedValueOnce({ cause: { originalCode: '40001' } }).mockResolvedValueOnce({ addedCount: 1 });
  const service = new AssignmentWriteService({ $transaction: transaction } as never, {} as never, {} as never, {} as never);
  const input = { requestId: 'request' } as never;
  await expect(service.assign('teacher', 'work', input)).resolves.toEqual({ addedCount: 1 });
  expect(transaction).toHaveBeenCalledTimes(2);
  const businessError = { status: 409, message: 'roster changed' };
  transaction.mockReset().mockRejectedValue(businessError);
  await expect(service.assign('teacher', 'work', input)).rejects.toBe(businessError);
  expect(transaction).toHaveBeenCalledTimes(1);
  transaction.mockReset().mockRejectedValue({ code: 'P2034' });
  await expect(service.assign('teacher', 'work', input)).rejects.toMatchObject({ status: 409 });
  expect(transaction).toHaveBeenCalledTimes(5);
});
