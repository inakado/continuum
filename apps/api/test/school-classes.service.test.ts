import { describe, expect, it, vi } from 'vitest';
import { SchoolClassesWriteService } from '../src/identity-access/school-classes-write.service';

describe('school class provisioning', () => {
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
