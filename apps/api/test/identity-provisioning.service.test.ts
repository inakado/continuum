import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@prisma/client', () => ({
  PrismaClient: class PrismaClient {},
  Role: {
    teacher: 'teacher',
    student: 'student',
  },
}));

const argon2Mock = vi.hoisted(() => ({ hash: vi.fn(), verify: vi.fn() }));

vi.mock('argon2', () => ({
  default: argon2Mock,
  hash: argon2Mock.hash,
  verify: argon2Mock.verify,
}));

import { IdentityProvisioningService } from '../src/auth/identity-provisioning.service';

describe('IdentityProvisioningService', () => {
  const tx = {
    user: { create: vi.fn() },
    account: { create: vi.fn(), upsert: vi.fn() },
    teacherProfile: { create: vi.fn() },
    studentProfile: { create: vi.fn() },
    session: { deleteMany: vi.fn() },
  };
  const prisma = {
    account: { findUnique: vi.fn() },
    $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
  };
  const service = new IdentityProvisioningService(prisma as never);

  beforeEach(() => {
    vi.clearAllMocks();
    argon2Mock.hash.mockResolvedValue('password-hash');
  });

  it('creates user, credential account and teacher profile atomically', async () => {
    tx.user.create.mockResolvedValue({ id: 'teacher-1', login: 'teacher.one', role: 'teacher' });
    tx.teacherProfile.create.mockResolvedValue({
      firstName: 'Анна',
      lastName: 'Петрова',
      middleName: null,
    });

    await service.createTeacher({
      login: ' Teacher.One ',
      password: 'Pass1234',
      firstName: 'Анна',
      lastName: 'Петрова',
      middleName: null,
    });

    expect(prisma.$transaction).toHaveBeenCalledOnce();
    expect(tx.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          login: 'teacher.one',
          email: 'teacher.one@users.continuum.invalid',
          name: 'Анна Петрова',
        }),
      }),
    );
    expect(tx.account.create).toHaveBeenCalledWith({
      data: {
        accountId: 'teacher-1',
        providerId: 'credential',
        userId: 'teacher-1',
        password: 'password-hash',
      },
      select: { id: true },
    });
    expect(tx.teacherProfile.create).toHaveBeenCalledOnce();
  });

  it('updates the credential password and revokes all sessions', async () => {
    await service.replacePasswordInTransaction(tx as never, 'student-1', 'next-hash');

    expect(tx.account.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { password: 'next-hash' } }),
    );
    expect(tx.session.deleteMany).toHaveBeenCalledWith({ where: { userId: 'student-1' } });
  });

  it('verifies the password from the credential account', async () => {
    prisma.account.findUnique.mockResolvedValue({ password: 'stored-hash' });
    argon2Mock.verify.mockResolvedValue(true);

    await expect(service.verifyPassword('teacher-1', 'Pass1234')).resolves.toBe(true);

    expect(argon2Mock.verify).toHaveBeenCalledWith('stored-hash', 'Pass1234');
  });
});
