import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@prisma/client', () => ({
  ContentStatus: {
    published: 'published',
  },
  PhotoTaskSubmissionStatus: {
    submitted: 'submitted',
    accepted: 'accepted',
    rejected: 'rejected',
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
    pending_review: 'pending_review',
    correct: 'correct',
    accepted: 'accepted',
    rejected: 'rejected',
    credited_without_progress: 'credited_without_progress',
    teacher_credited: 'teacher_credited',
  },
  StudentUnitStatus: {
    locked: 'locked',
    available: 'available',
    in_progress: 'in_progress',
    completed: 'completed',
  },
  TaskAnswerType: {
    photo: 'photo',
  },
}));

import { ConflictException } from '@nestjs/common';
import { Role, StudentUnitStatus } from '@prisma/client';
import { PhotoTaskReadService } from '../src/learning/photo-task-read.service';

const createPrismaMock = () => ({
  task: {
    findFirst: vi.fn(),
  },
  photoTaskSubmission: {
    findMany: vi.fn(),
    count: vi.fn(),
    findFirst: vi.fn(),
  },
  $transaction: vi.fn(),
});

describe('PhotoTaskReadService', () => {
  const prisma = createPrismaMock();
  const studentsService = {
    assertTeacherOwnsStudent: vi.fn(),
  };
  const learningAvailabilityService = {
    recomputeSectionAvailability: vi.fn(),
  };
  const objectStorageService = {
    presignGetObject: vi.fn(),
  };
  const photoTaskPolicyService = {
    resolveViewTtl: vi.fn(),
    inferResponseContentType: vi.fn(),
  };

  const service = new PhotoTaskReadService(
    prisma as never,
    studentsService as never,
    learningAvailabilityService as never,
    objectStorageService as never,
    photoTaskPolicyService as never,
  );

  beforeEach(() => {
    prisma.task.findFirst.mockReset();
    prisma.photoTaskSubmission.findMany.mockReset();
    prisma.photoTaskSubmission.count.mockReset();
    prisma.photoTaskSubmission.findFirst.mockReset();
    prisma.$transaction.mockReset();
    prisma.$transaction.mockImplementation(async (operations: Array<Promise<unknown>>) => Promise.all(operations));

    studentsService.assertTeacherOwnsStudent.mockReset();
    learningAvailabilityService.recomputeSectionAvailability.mockReset();
    objectStorageService.presignGetObject.mockReset();
    photoTaskPolicyService.resolveViewTtl.mockReset();
    photoTaskPolicyService.inferResponseContentType.mockReset();
  });

  it('lists teacher inbox with mapped student/content metadata', async () => {
    prisma.photoTaskSubmission.findMany.mockResolvedValue([
      {
        id: 'submission-1',
        status: 'submitted',
        submittedAt: new Date('2026-03-01T10:00:00.000Z'),
        assetKeysJson: ['assets/photo-1.jpg', 'assets/photo-2.jpg'],
        studentUserId: 'student-1',
        taskId: 'task-1',
        unitId: 'unit-1',
        student: {
          id: 'student-1',
          login: 'student1',
          studentProfile: {
            firstName: 'Иван',
            lastName: 'Иванов',
          },
        },
        task: {
          id: 'task-1',
          title: 'Фото-задача',
          sortOrder: 4,
          unit: {
            id: 'unit-1',
            title: 'Юнит 1',
            section: {
              id: 'section-1',
              title: 'Раздел 1',
              course: {
                id: 'course-1',
                title: 'Алгебра',
              },
            },
          },
        },
      },
    ]);
    prisma.photoTaskSubmission.count.mockResolvedValue(1);

    const result = await service.listInboxForTeacher('teacher-1', {
      status: 'pending_review',
      sort: 'oldest',
      limit: 10,
      offset: 0,
      studentId: undefined,
      courseId: undefined,
      sectionId: undefined,
      unitId: undefined,
      taskId: undefined,
    });

    expect(result).toEqual({
      items: [
        {
          submissionId: 'submission-1',
          status: 'pending_review',
          submittedAt: new Date('2026-03-01T10:00:00.000Z'),
          assetKeysCount: 2,
          student: {
            id: 'student-1',
            login: 'student1',
            firstName: 'Иван',
            lastName: 'Иванов',
          },
          course: {
            id: 'course-1',
            title: 'Алгебра',
          },
          section: {
            id: 'section-1',
            title: 'Раздел 1',
          },
          unit: {
            id: 'unit-1',
            title: 'Юнит 1',
          },
          task: {
            id: 'task-1',
            title: 'Фото-задача',
            sortOrder: 4,
          },
        },
      ],
      total: 1,
      limit: 10,
      offset: 0,
      sort: 'oldest',
    });
  });

  it('lists teacher queue for owned student with asset count mapping', async () => {
    prisma.photoTaskSubmission.findMany.mockResolvedValue([
      {
        id: 'submission-1',
        taskId: 'task-1',
        unitId: 'unit-1',
        status: 'accepted',
        submittedAt: new Date('2026-03-01T11:00:00.000Z'),
        rejectedReason: null,
        assetKeysJson: ['assets/photo-1.jpg'],
        task: {
          title: 'Фото-задача',
          unit: {
            title: 'Юнит 1',
          },
        },
      },
    ]);
    prisma.photoTaskSubmission.count.mockResolvedValue(1);

    const result = await service.listQueueForTeacher('teacher-1', 'student-1', {
      status: 'accepted',
      limit: 20,
      offset: 0,
    });

    expect(studentsService.assertTeacherOwnsStudent).toHaveBeenCalledWith('teacher-1', 'student-1');
    expect(result).toEqual({
      items: [
        {
          submissionId: 'submission-1',
          taskId: 'task-1',
          taskTitle: 'Фото-задача',
          unitId: 'unit-1',
          unitTitle: 'Юнит 1',
          status: 'accepted',
          submittedAt: new Date('2026-03-01T11:00:00.000Z'),
          rejectedReason: null,
          assetKeysCount: 1,
        },
      ],
      total: 1,
      limit: 20,
      offset: 0,
    });
  });

  it('presigns student photo view only for owned asset keys in available unit', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 'task-1',
      unitId: 'unit-1',
      activeRevisionId: 'revision-1',
      activeRevision: {
        id: 'revision-1',
        answerType: 'photo',
      },
      unit: {
        id: 'unit-1',
        sectionId: 'section-1',
      },
    });
    learningAvailabilityService.recomputeSectionAvailability.mockResolvedValue(
      new Map([['unit-1', { status: StudentUnitStatus.available }]]),
    );
    prisma.photoTaskSubmission.findFirst.mockResolvedValue({ id: 'submission-1' });
    photoTaskPolicyService.resolveViewTtl.mockReturnValue(180);
    photoTaskPolicyService.inferResponseContentType.mockReturnValue('image/jpeg');
    objectStorageService.presignGetObject.mockResolvedValue('https://storage.example/photo-1.jpg');

    const result = await service.presignViewForStudent('student-1', 'task-1', {
      assetKey: 'assets/photo-1.jpg',
      ttlSec: 180,
    });

    expect(result).toEqual({
      ok: true,
      assetKey: 'assets/photo-1.jpg',
      expiresInSec: 180,
      url: 'https://storage.example/photo-1.jpg',
    });
    expect(photoTaskPolicyService.resolveViewTtl).toHaveBeenCalledWith(Role.student, 180);
    expect(objectStorageService.presignGetObject).toHaveBeenCalledWith(
      'assets/photo-1.jpg',
      180,
      'image/jpeg',
    );
  });

  it('rejects student presign view when asset key is not owned', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 'task-1',
      unitId: 'unit-1',
      activeRevisionId: 'revision-1',
      activeRevision: {
        id: 'revision-1',
        answerType: 'photo',
      },
      unit: {
        id: 'unit-1',
        sectionId: 'section-1',
      },
    });
    learningAvailabilityService.recomputeSectionAvailability.mockResolvedValue(
      new Map([['unit-1', { status: StudentUnitStatus.available }]]),
    );
    prisma.photoTaskSubmission.findFirst.mockResolvedValue(null);

    await expect(
      service.presignViewForStudent('student-1', 'task-1', {
        assetKey: 'assets/missing.jpg',
        ttlSec: 180,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
