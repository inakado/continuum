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
    available: 'available',
  },
}));

const argon2Mock = vi.hoisted(() => ({
  hash: vi.fn(),
}));

vi.mock('argon2', () => ({
  default: argon2Mock,
  hash: argon2Mock.hash,
  verify: vi.fn(),
}));

import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { StudentsService } from '../src/students/students.service';

const createTransactionMock = () => ({
  user: {
    create: vi.fn(),
  },
  studentProfile: {
    create: vi.fn(),
  },
});

describe('StudentsService teacher students slice', () => {
  const tx = createTransactionMock();
  const prisma = {
    studentProfile: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    notification: {
      findMany: vi.fn(),
    },
    photoTaskSubmission: {
      groupBy: vi.fn(),
    },
    course: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    attempt: {
      groupBy: vi.fn(),
    },
    studentTaskState: {
      findMany: vi.fn(),
    },
    studentUnitState: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  const service = new StudentsService(prisma as never);

  beforeEach(() => {
    prisma.studentProfile.findUnique.mockReset();
    prisma.studentProfile.findMany.mockReset();
    prisma.studentProfile.update.mockReset();
    prisma.user.findFirst.mockReset();
    prisma.notification.findMany.mockReset();
    prisma.photoTaskSubmission.groupBy.mockReset();
    prisma.course.findMany.mockReset();
    prisma.course.findFirst.mockReset();
    prisma.attempt.groupBy.mockReset();
    prisma.studentTaskState.findMany.mockReset();
    prisma.studentUnitState.findMany.mockReset();
    prisma.$transaction.mockReset();
    prisma.$transaction.mockImplementation(async (callback: (input: typeof tx) => Promise<unknown>) => callback(tx));

    tx.user.create.mockReset();
    tx.studentProfile.create.mockReset();

    argon2Mock.hash.mockReset();
  });

  it('assertTeacherOwnsStudent throws not found and forbidden in invalid ownership cases', async () => {
    prisma.studentProfile.findUnique.mockResolvedValueOnce(null);

    await expect(service.assertTeacherOwnsStudent('teacher-1', 'student-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    prisma.studentProfile.findUnique.mockResolvedValueOnce({
      userId: 'student-1',
      leadTeacherId: 'teacher-2',
      user: { id: 'student-1', login: 'student1', role: 'student' },
      leadTeacher: {
        id: 'teacher-2',
        login: 'teacher2',
        teacherProfile: { firstName: 'Борис', middleName: null },
      },
    });

    await expect(service.assertTeacherOwnsStudent('teacher-1', 'student-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('listStudents aggregates unread notifications and pending photo review counts', async () => {
    prisma.studentProfile.findMany.mockResolvedValue([
      {
        userId: 'student-1',
        leadTeacherId: 'teacher-1',
        firstName: 'Анна',
        lastName: 'Иванова',
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-02T00:00:00.000Z',
        user: {
          id: 'student-1',
          login: 'student1',
          createdAt: '2026-03-01T00:00:00.000Z',
          updatedAt: '2026-03-02T00:00:00.000Z',
        },
        leadTeacher: {
          id: 'teacher-1',
          login: 'teacher1',
          teacherProfile: { firstName: 'Анна', middleName: 'Игоревна' },
        },
      },
    ]);
    prisma.notification.findMany.mockResolvedValue([
      { payload: { studentId: 'student-1' } },
      { payload: { studentId: 'student-1' } },
      { payload: { studentId: 'student-2' } },
    ]);
    prisma.photoTaskSubmission.groupBy.mockResolvedValue([
      { studentUserId: 'student-1', _count: { _all: 3 } },
    ]);

    const result = await service.listStudents('teacher-1', 'ann');

    expect(result).toEqual([
      expect.objectContaining({
        id: 'student-1',
        login: 'student1',
        activeNotificationsCount: 2,
        pendingPhotoReviewCount: 3,
        leadTeacherDisplayName: 'Анна Игоревна',
      }),
    ]);
    expect(prisma.studentProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          leadTeacherId: 'teacher-1',
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it('returns minimal student profile details when no published course is selected', async () => {
    prisma.studentProfile.findUnique.mockResolvedValue({
      userId: 'student-1',
      leadTeacherId: 'teacher-1',
      firstName: 'Анна',
      lastName: 'Иванова',
      user: { id: 'student-1', login: 'student1', role: 'student' },
      leadTeacher: {
        id: 'teacher-1',
        login: 'teacher1',
        teacherProfile: { firstName: 'Анна', middleName: 'Игоревна' },
      },
    });
    prisma.notification.findMany.mockResolvedValue([
      {
        id: 'n1',
        type: 'StudentCreated',
        payload: { studentId: 'student-1' },
        createdAt: '2026-03-01T00:00:00.000Z',
        readAt: null,
      },
    ]);
    prisma.course.findMany.mockResolvedValue([]);

    const result = await service.getStudentProfileDetails('teacher-1', 'student-1');

    expect(result).toEqual({
      profile: {
        id: 'student-1',
        login: 'student1',
        firstName: 'Анна',
        lastName: 'Иванова',
        leadTeacherId: 'teacher-1',
        leadTeacherLogin: 'teacher1',
        leadTeacherDisplayName: 'Анна Игоревна',
      },
      notifications: {
        activeCount: 1,
        items: [
          {
            id: 'n1',
            type: 'StudentCreated',
            payload: { studentId: 'student-1' },
            createdAt: '2026-03-01T00:00:00.000Z',
            readAt: null,
          },
        ],
      },
      courses: [],
      selectedCourseId: null,
      courseTree: null,
    });
  });

  it('creates student with generated password via transaction', async () => {
    argon2Mock.hash.mockResolvedValue('hashed-password');
    tx.user.create.mockResolvedValue({
      id: 'student-1',
      login: 'student1',
      role: 'student',
    });
    tx.studentProfile.create.mockResolvedValue({
      userId: 'student-1',
      leadTeacherId: 'teacher-1',
      firstName: 'Анна',
      lastName: 'Иванова',
    });

    const result = await service.createStudent('student1', 'teacher-1', 'Анна', 'Иванова');

    expect(result.user).toEqual({
      id: 'student-1',
      login: 'student1',
      role: 'student',
    });
    expect(result.profile).toEqual({
      userId: 'student-1',
      leadTeacherId: 'teacher-1',
      firstName: 'Анна',
      lastName: 'Иванова',
    });
    expect(result.password).toEqual(expect.any(String));
    expect(result.password).toHaveLength(10);
  });

  it('transferStudent rejects noop transfer and supports valid reassignment', async () => {
    prisma.studentProfile.findUnique.mockResolvedValueOnce({
      userId: 'student-1',
      leadTeacherId: 'teacher-1',
      firstName: 'Анна',
      lastName: 'Иванова',
      user: { id: 'student-1', login: 'student1', role: 'student' },
      leadTeacher: {
        id: 'teacher-1',
        login: 'teacher1',
        teacherProfile: { firstName: 'Анна', middleName: 'Игоревна' },
      },
    });

    await expect(service.transferStudent('student-1', 'teacher-1', 'teacher-1')).rejects.toBeInstanceOf(
      ConflictException,
    );

    prisma.studentProfile.findUnique.mockResolvedValueOnce({
      userId: 'student-1',
      leadTeacherId: 'teacher-1',
      firstName: 'Анна',
      lastName: 'Иванова',
      user: { id: 'student-1', login: 'student1', role: 'student' },
      leadTeacher: {
        id: 'teacher-1',
        login: 'teacher1',
        teacherProfile: { firstName: 'Анна', middleName: 'Игоревна' },
      },
    });
    prisma.user.findFirst.mockResolvedValue({
      id: 'teacher-2',
      login: 'teacher2',
    });
    prisma.studentProfile.update.mockResolvedValue({
      userId: 'student-1',
      leadTeacherId: 'teacher-2',
    });

    const result = await service.transferStudent('student-1', 'teacher-1', 'teacher-2');

    expect(result).toEqual({
      id: 'student-1',
      login: 'student1',
      leadTeacherId: 'teacher-2',
      leadTeacherLogin: 'teacher2',
      previousLeadTeacherId: 'teacher-1',
    });
  });
});
