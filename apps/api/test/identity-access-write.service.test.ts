import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { IdentityProvisioningService } from '../src/auth/identity-provisioning.service';
import { IdentityAccessWriteService } from '../src/identity-access/identity-access-write.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const teacherId = '123e4567-e89b-12d3-a456-426614174001';
const studentId = '123e4567-e89b-12d3-a456-426614174000';

const makeService = () => {
  const tx = {
    user: { findFirst: vi.fn(), update: vi.fn() },
    session: { deleteMany: vi.fn() },
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const identities = { createStudent: vi.fn() };
  return {
    tx,
    identities,
    service: new IdentityAccessWriteService(
      prisma as unknown as PrismaService,
      identities as unknown as IdentityProvisioningService,
    ),
  };
};

describe('IdentityAccessWriteService', () => {
  it('creates a student through the centralized identity provisioner', async () => {
    const { service, identities } = makeService();
    identities.createStudent.mockResolvedValue({ user: { id: studentId } });

    await expect(
      service.createStudent(teacherId, {
        login: 'student.one',
        password: 'Pass1234',
        firstName: 'Иван',
        lastName: null,
      }),
    ).resolves.toEqual({ id: studentId, isActive: true });
    expect(identities.createStudent).toHaveBeenCalledWith(
      expect.objectContaining({ leadTeacherId: teacherId }),
    );
  });

  it('maps a unique login conflict to a stable API error', async () => {
    const { service, identities } = makeService();
    identities.createStudent.mockRejectedValue({ code: 'P2002' });

    await expect(
      service.createStudent(teacherId, { login: 'student.one', password: 'Pass1234' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('cannot deactivate another teacher student', async () => {
    const { service, tx } = makeService();
    tx.user.findFirst.mockResolvedValue(null);

    await expect(
      service.setStudentActive(teacherId, studentId, { isActive: false }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('revokes sessions when a managed student is deactivated', async () => {
    const { service, tx } = makeService();
    tx.user.findFirst.mockResolvedValue({ id: studentId });
    tx.user.update.mockResolvedValue({ id: studentId, isActive: false });

    await expect(
      service.setStudentActive(teacherId, studentId, { isActive: false }),
    ).resolves.toEqual({ id: studentId, isActive: false });
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: studentId } });
  });
});
