import { setTimeout } from 'node:timers/promises';
import { beforeEach, expect, it, vi } from 'vitest';
import { isTransactionWriteConflict, retryTransaction } from '../src/prisma/transaction-retry';

vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn().mockResolvedValue(undefined) }));
beforeEach(() => vi.clearAllMocks());

it('recognizes serialization/deadlock rollbacks, not connection failures or arbitrary constraint errors', () => {
  for (const code of ['40001', '40P01']) {
    expect(isTransactionWriteConflict(Object.assign(new Error('adapter'), { cause: { originalCode: code } }))).toBe(true);
    expect(isTransactionWriteConflict({ code: 'P2010', meta: { code } })).toBe(true);
    expect(isTransactionWriteConflict({ code: 'P2010', meta: { driverAdapterError: { cause: { originalCode: code } } } })).toBe(true);
  }
  for (const error of [{ code: 'P2002' }, { code: 'P2028' }, { code: 'ECONNRESET' }, { cause: { originalCode: '23505' } }, new Error('40001')]) {
    expect(isTransactionWriteConflict(error)).toBe(false);
  }
});

it('reruns the complete callback and backs off between rolled-back transactions', async () => {
  const write = vi.fn().mockRejectedValueOnce({ code: 'P2034' }).mockRejectedValueOnce({ cause: { originalCode: '40001' } }).mockResolvedValue('committed');
  await expect(retryTransaction(write)).resolves.toBe('committed');
  expect(write).toHaveBeenCalledTimes(3);
  expect(setTimeout).toHaveBeenCalledTimes(2);
  const delays = vi.mocked(setTimeout).mock.calls.map(([delay]) => delay!);
  expect(delays[0]).toBeGreaterThanOrEqual(25); expect(delays[0]).toBeLessThan(50);
  expect(delays[1]).toBeGreaterThanOrEqual(50); expect(delays[1]).toBeLessThan(75);
});

it('stops after five attempts and preserves the last rollback error for the domain boundary', async () => {
  const error = { code: 'P2034' };
  const write = vi.fn().mockRejectedValue(error);
  await expect(retryTransaction(write)).rejects.toBe(error);
  expect(write).toHaveBeenCalledTimes(5); expect(setTimeout).toHaveBeenCalledTimes(4);
});

it('does not retry business conflicts, validation errors or ambiguous connection failures', async () => {
  for (const error of [{ status: 409 }, { status: 400 }, { code: 'ECONNRESET' }, { code: 'P2002' }]) {
    const write = vi.fn().mockRejectedValue(error);
    await expect(retryTransaction(write)).rejects.toBe(error);
    expect(write).toHaveBeenCalledTimes(1);
  }
  expect(setTimeout).not.toHaveBeenCalled();
});
