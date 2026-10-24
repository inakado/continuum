import { describe, expect, it, vi } from 'vitest';
import { SchoolClassesWriteService } from '../src/identity-access/school-classes-write.service';
import { classTransaction } from '../src/identity-access/school-class-policy';

describe('school class provisioning', () => {
  it('retries raw serialization conflicts and reports exhausted contention as 409', async () => {
    const conflict = { cause: { originalCode: '40001', kind: 'TransactionWriteConflict' } };
    const transaction = vi.fn().mockRejectedValueOnce(conflict).mockResolvedValueOnce('committed');
    await expect(classTransaction({ $transaction: transaction } as never, vi.fn())).resolves.toBe('committed');
    expect(transaction).toHaveBeenCalledTimes(2);
    transaction.mockReset().mockRejectedValue({ code: 'P2034' });
    await expect(classTransaction({ $transaction: transaction } as never, vi.fn())).rejects.toMatchObject({ status: 409 });
    expect(transaction).toHaveBeenCalledTimes(5);
  });

  it('replays a committed batch without storing or reissuing passwords', async () => {
    const findUnique = vi.fn().mockResolvedValue({ teacherId: 'teacher', inputHash: 'different' });
    const prisma = { studentProvisioningBatch: { findUnique } };
    const service = new SchoolClassesWriteService(prisma as never, {} as never);
    await expect(service.createStudents('teacher', {
      requestId: '123e4567-e89b-12d3-a456-426614174000',
      classId: '123e4567-e89b-12d3-a456-426614174001',
      students: [{ lastName: 'Иванов', firstName: 'Иван', middleName: '' }],
    })).rejects.toMatchObject({ response: { code: 'REQUEST_ALREADY_USED' } });
  });
});
