import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@prisma/client', () => ({
  AttemptKind: {
    photo: 'photo',
  },
  ContentStatus: {
    published: 'published',
  },
  PhotoTaskSubmissionStatus: {
    submitted: 'submitted',
  },
  PrismaClient: class PrismaClient {},
  Role: {
    teacher: 'teacher',
    student: 'student',
  },
  StudentTaskStatus: {
    not_started: 'not_started',
    in_progress: 'in_progress',
    blocked: 'blocked',
    correct: 'correct',
    accepted: 'accepted',
    credited_without_progress: 'credited_without_progress',
    teacher_credited: 'teacher_credited',
  },
  StudentUnitStatus: {
    locked: 'locked',
  },
}));

const argon2Mock = vi.hoisted(() => ({
  hash: vi.fn(),
  verify: vi.fn(),
}));

vi.mock('argon2', () => ({
  default: argon2Mock,
  hash: argon2Mock.hash,
  verify: argon2Mock.verify,
}));

import { ConflictException, NotFoundException } from '@nestjs/common';
import { StudentsService } from '../src/students/students.service';

const createTransactionMock = () => ({
  user: {
    create: vi.fn(),
    update: vi.fn(),
  },
  teacherProfile: {
    create: vi.fn(),
  },
  authSession: {
    updateMany: vi.fn(),
  },
  authRefreshToken: {
    updateMany: vi.fn(),
  },
});

describe('StudentsService teacher accounts slice', () => {
  const tx = createTransactionMock();
  const prisma = {
    user: {
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    teacherProfile: {
      upsert: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const service = new StudentsService(prisma as never);

  beforeEach(() => {
    prisma.user.findFirst.mockReset();
    prisma.user.delete.mockReset();
    prisma.teacherProfile.upsert.mockReset();
    prisma.$transaction.mockReset();
    prisma.$transaction.mockImplementation(async (callback: (input: typeof tx) => Promise<unknown>) => callback(tx));

    tx.user.create.mockReset();
    tx.user.update.mockReset();
    tx.teacherProfile.create.mockReset();
    tx.authSession.updateMany.mockReset();
    tx.authRefreshToken.updateMany.mockReset();

    argon2Mock.hash.mockReset();
    argon2Mock.verify.mockReset();
  });

  it('returns teacher profile via getTeacherMe', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'teacher-1',
      login: 'teacher1',
      role: 'teacher',
      teacherProfile: {
        firstName: 'Анна',
        lastName: 'Петрова',
        middleName: 'Игоревна',
      },
    });

    const result = await service.getTeacherMe('teacher-1');

    expect(result).toEqual({
      user: {
        id: 'teacher-1',
        login: 'teacher1',
        role: 'teacher',
      },
      profile: {
        firstName: 'Анна',
        lastName: 'Петрова',
        middleName: 'Игоревна',
      },
    });
  });

  it('updates teacher profile and validates required names', async () => {
    prisma.user.findFirst.mockResolvedValue({ id: 'teacher-1' });
    prisma.teacherProfile.upsert.mockResolvedValue({
      userId: 'teacher-1',
      firstName: 'Анна',
      lastName: 'Петрова',
      middleName: null,
    });

    const result = await service.updateTeacherProfile('teacher-1', 'Анна', 'Петрова');

    expect(result).toEqual({
      id: 'teacher-1',
      firstName: 'Анна',
      lastName: 'Петрова',
      middleName: null,
    });
    expect(prisma.teacherProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'teacher-1' },
        create: expect.objectContaining({
          firstName: 'Анна',
          lastName: 'Петрова',
        }),
      }),
    );
  });

  it('changes teacher password and revokes sessions + refresh tokens', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'teacher-1',
      login: 'teacher1',
      passwordHash: 'old-hash',
    });
    argon2Mock.verify.mockResolvedValue(true);
    argon2Mock.hash.mockResolvedValue('new-hash');

    const result = await service.changeTeacherPassword('teacher-1', 'Pass123!', 'Next1234');

    expect(result).toEqual({ id: 'teacher-1', login: 'teacher1' });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'teacher-1' },
      data: { passwordHash: 'new-hash' },
    });
    expect(tx.authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'teacher-1', revokedAt: null }),
        data: expect.objectContaining({ revokeReason: 'PASSWORD_CHANGED' }),
      }),
    );
    expect(tx.authRefreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          revokedAt: null,
          session: { userId: 'teacher-1' },
        }),
      }),
    );
  });

  it('creates teacher and maps duplicate login to LOGIN_ALREADY_EXISTS', async () => {
    argon2Mock.hash.mockResolvedValue('hashed-password');
    tx.user.create.mockRejectedValue(Object.assign(new Error('duplicate'), { code: 'P2002' }));

    await expect(
      service.createTeacher({
        login: 'teacher1',
        firstName: 'Анна',
        lastName: 'Петрова',
        generatePassword: true,
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'LOGIN_ALREADY_EXISTS',
      },
    });
  });

  it('forbids self-delete and maps teacher-with-students FK errors', async () => {
    await expect(service.deleteTeacher('teacher-1', 'teacher-1')).rejects.toBeInstanceOf(ConflictException);

    prisma.user.findFirst.mockResolvedValue({
      id: 'teacher-2',
      login: 'teacher2',
      teacherProfile: {
        firstName: 'Борис',
        lastName: 'Сидоров',
        middleName: null,
      },
    });
    prisma.user.delete.mockRejectedValue(Object.assign(new Error('fk'), { code: 'P2003' }));

    await expect(service.deleteTeacher('teacher-2', 'teacher-1')).rejects.toMatchObject({
      response: {
        code: 'TEACHER_HAS_STUDENTS',
      },
    });
  });

  it('throws TEACHER_NOT_FOUND when getTeacherMe misses active teacher', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(service.getTeacherMe('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
