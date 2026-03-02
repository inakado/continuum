import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@prisma/client', () => ({
  AttemptKind: {
    photo: 'photo',
  },
  AttemptResult: {
    pending_review: 'pending_review',
    accepted: 'accepted',
    rejected: 'rejected',
  },
  ContentStatus: {
    published: 'published',
  },
  PrismaClient: class PrismaClient {},
  Prisma: {
    DbNull: null,
  },
  StudentTaskStatus: {
    not_started: 'not_started',
    pending_review: 'pending_review',
    accepted: 'accepted',
    rejected: 'rejected',
    correct: 'correct',
    credited_without_progress: 'credited_without_progress',
    teacher_credited: 'teacher_credited',
  },
  StudentUnitStatus: {
    locked: 'locked',
    available: 'available',
  },
  TaskAnswerType: {
    photo: 'photo',
  },
}));

import { AttemptResult, AttemptKind, Prisma, StudentTaskStatus, StudentUnitStatus, TaskAnswerType } from '@prisma/client';
import { PhotoTaskReviewWriteService } from '../src/learning/photo-task-review-write.service';

const createPublishedTask = () => ({
  id: 'task-1',
  unitId: 'unit-1',
  activeRevisionId: 'revision-1',
  activeRevision: {
    id: 'revision-1',
    answerType: TaskAnswerType.photo,
  },
  unit: {
    id: 'unit-1',
    sectionId: 'section-1',
  },
});

const createSubmission = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'submission-1',
  studentUserId: 'student-1',
  taskId: 'task-1',
  taskRevisionId: 'revision-1',
  unitId: 'unit-1',
  attemptId: 'attempt-1',
  status: 'submitted',
  assetKeysJson: ['assets/photo-1.jpg'],
  rejectedReason: null,
  submittedAt: new Date('2026-03-01T10:00:00.000Z'),
  reviewedAt: null,
  reviewedByTeacherUserId: null,
  ...overrides,
});

const createUnitSnapshot = () => ({
  unitId: 'unit-1',
  status: StudentUnitStatus.available,
  totalTasks: 1,
  countedTasks: 1,
  solvedTasks: 0,
  completionPercent: 50,
  solvedPercent: 0,
});

const createTxMock = () => ({
  task: {
    findFirst: vi.fn(),
  },
  studentTaskState: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  attempt: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  photoTaskSubmission: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
});

describe('PhotoTaskReviewWriteService', () => {
  const tx = createTxMock();
  const prisma = {
    task: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  const studentsService = {
    assertTeacherOwnsStudent: vi.fn(),
  };
  const learningAvailabilityService = {
    recomputeSectionAvailability: vi.fn(),
  };
  const learningAuditLogService = {
    appendStudentLearningEvent: vi.fn(),
    appendTeacherAdminEvent: vi.fn(),
  };
  const objectStorageService = {
    presignPutObject: vi.fn(),
  };
  const photoTaskPolicyService = {
    resolveUploadTtl: vi.fn(),
    extensionForContentType: vi.fn(),
    assertAssetKeysMatchGeneratedPattern: vi.fn(),
  };

  const service = new PhotoTaskReviewWriteService(
    prisma as never,
    studentsService as never,
    learningAvailabilityService as never,
    learningAuditLogService as never,
    objectStorageService as never,
    photoTaskPolicyService as never,
  );

  beforeEach(() => {
    vi.useRealTimers();

    prisma.task.findFirst.mockReset();
    prisma.$transaction.mockReset();
    prisma.$transaction.mockImplementation(async (callback: (input: typeof tx) => Promise<unknown>) => callback(tx));

    tx.task.findFirst.mockReset();
    tx.studentTaskState.findUnique.mockReset();
    tx.studentTaskState.create.mockReset();
    tx.studentTaskState.update.mockReset();
    tx.studentTaskState.upsert.mockReset();
    tx.attempt.findFirst.mockReset();
    tx.attempt.create.mockReset();
    tx.attempt.update.mockReset();
    tx.photoTaskSubmission.create.mockReset();
    tx.photoTaskSubmission.findFirst.mockReset();
    tx.photoTaskSubmission.update.mockReset();

    studentsService.assertTeacherOwnsStudent.mockReset();
    learningAvailabilityService.recomputeSectionAvailability.mockReset();
    learningAuditLogService.appendStudentLearningEvent.mockReset();
    learningAuditLogService.appendTeacherAdminEvent.mockReset();
    objectStorageService.presignPutObject.mockReset();
    photoTaskPolicyService.resolveUploadTtl.mockReset();
    photoTaskPolicyService.extensionForContentType.mockReset();
    photoTaskPolicyService.assertAssetKeysMatchGeneratedPattern.mockReset();
  });

  it('presigns student upload files with generated asset keys and resolved ttl', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1710000000000);
    prisma.task.findFirst.mockResolvedValue(createPublishedTask());
    learningAvailabilityService.recomputeSectionAvailability.mockResolvedValue(
      new Map([['unit-1', { status: StudentUnitStatus.available }]]),
    );
    photoTaskPolicyService.resolveUploadTtl.mockReturnValue(300);
    photoTaskPolicyService.extensionForContentType.mockReturnValue('jpg');
    objectStorageService.presignPutObject.mockResolvedValue({
      url: 'https://storage.example/upload',
      headers: { 'x-test': '1' },
    });

    const response = await service.presignUpload('student-1', 'task-1', {
      files: [{ filename: 'photo.jpg', contentType: 'image/jpeg', sizeBytes: 1024 }],
      ttlSec: 300,
    });

    expect(response.expiresInSec).toBe(300);
    expect(response.uploads).toHaveLength(1);
    expect(response.uploads[0]).toEqual(
      expect.objectContaining({
        assetKey: expect.stringMatching(/^tasks\/task-1\/photo\/student-1\/revision-1\/1710000000000-.+\.jpg$/),
        url: 'https://storage.example/upload',
        headers: { 'x-test': '1' },
      }),
    );
    expect(objectStorageService.presignPutObject).toHaveBeenCalledWith(
      expect.stringMatching(/^tasks\/task-1\/photo\/student-1\/revision-1\/1710000000000-.+\.jpg$/),
      'image/jpeg',
      300,
    );
  });

  it('submits student photo attempt and writes learning audit', async () => {
    tx.task.findFirst.mockResolvedValue(createPublishedTask());
    learningAvailabilityService.recomputeSectionAvailability.mockResolvedValue(
      new Map([['unit-1', createUnitSnapshot()]]),
    );
    tx.studentTaskState.findUnique.mockResolvedValue(null);
    tx.studentTaskState.create.mockResolvedValue({
      studentId: 'student-1',
      taskId: 'task-1',
      status: StudentTaskStatus.not_started,
      activeRevisionId: 'revision-1',
    });
    tx.attempt.findFirst.mockResolvedValue(null);
    tx.attempt.create.mockResolvedValue({
      id: 'attempt-1',
      attemptNo: 1,
    });
    tx.photoTaskSubmission.create.mockResolvedValue(createSubmission());
    tx.studentTaskState.update.mockResolvedValue({
      status: StudentTaskStatus.pending_review,
      wrongAttempts: 0,
      lockedUntil: null,
      requiredSkipped: false,
    });

    const response = await service.submit('student-1', 'task-1', {
      assetKeys: ['assets/photo-1.jpg'],
    });

    expect(tx.attempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          kind: AttemptKind.photo,
          result: AttemptResult.pending_review,
          numericAnswers: Prisma.DbNull,
          selectedChoiceKeys: Prisma.DbNull,
        }),
      }),
    );
    expect(photoTaskPolicyService.assertAssetKeysMatchGeneratedPattern).toHaveBeenCalledWith(
      ['assets/photo-1.jpg'],
      'tasks/task-1/photo/student-1/revision-1/',
    );
    expect(learningAuditLogService.appendStudentLearningEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'PhotoAttemptSubmitted',
        entityId: 'submission-1',
      }),
    );
    expect(response).toMatchObject({
      ok: true,
      submissionId: 'submission-1',
      taskState: {
        status: StudentTaskStatus.pending_review,
      },
      unitSnapshot: {
        unitId: 'unit-1',
      },
    });
  });

  it('accepts reviewed submission and writes teacher audit event', async () => {
    studentsService.assertTeacherOwnsStudent.mockResolvedValue(undefined);
    tx.photoTaskSubmission.findFirst.mockResolvedValue({
      ...createSubmission(),
      task: {
        id: 'task-1',
        unit: {
          id: 'unit-1',
          sectionId: 'section-1',
        },
      },
    });
    tx.photoTaskSubmission.update.mockResolvedValue(
      createSubmission({
        status: 'accepted',
        reviewedByTeacherUserId: 'teacher-1',
        reviewedAt: new Date('2026-03-01T11:00:00.000Z'),
      }),
    );
    tx.studentTaskState.upsert.mockResolvedValue({
      status: StudentTaskStatus.accepted,
      wrongAttempts: 0,
      lockedUntil: null,
      requiredSkipped: false,
    });
    learningAvailabilityService.recomputeSectionAvailability.mockResolvedValue(
      new Map([['unit-1', createUnitSnapshot()]]),
    );

    const response = await service.accept('teacher-1', 'student-1', 'task-1', 'submission-1');

    expect(tx.attempt.update).toHaveBeenCalledWith({
      where: { id: 'attempt-1' },
      data: {
        result: AttemptResult.accepted,
      },
    });
    expect(learningAuditLogService.appendTeacherAdminEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'PhotoAttemptAccepted',
        entityId: 'submission-1',
      }),
    );
    expect(response).toMatchObject({
      ok: true,
      submission: {
        id: 'submission-1',
        status: 'accepted',
      },
      taskState: {
        status: StudentTaskStatus.accepted,
      },
    });
  });

  it('rejects reviewed submission with reason and writes teacher audit event', async () => {
    studentsService.assertTeacherOwnsStudent.mockResolvedValue(undefined);
    tx.photoTaskSubmission.findFirst.mockResolvedValue({
      ...createSubmission(),
      task: {
        id: 'task-1',
        unit: {
          id: 'unit-1',
          sectionId: 'section-1',
        },
      },
    });
    tx.photoTaskSubmission.update.mockResolvedValue(
      createSubmission({
        status: 'rejected',
        rejectedReason: 'Нужна более чёткая фотография',
        reviewedByTeacherUserId: 'teacher-1',
        reviewedAt: new Date('2026-03-01T11:00:00.000Z'),
      }),
    );
    tx.studentTaskState.upsert.mockResolvedValue({
      status: StudentTaskStatus.rejected,
      wrongAttempts: 0,
      lockedUntil: null,
      requiredSkipped: false,
    });
    learningAvailabilityService.recomputeSectionAvailability.mockResolvedValue(
      new Map([['unit-1', createUnitSnapshot()]]),
    );

    const response = await service.reject('teacher-1', 'student-1', 'task-1', 'submission-1', {
      reason: 'Нужна более чёткая фотография',
    });

    expect(tx.attempt.update).toHaveBeenCalledWith({
      where: { id: 'attempt-1' },
      data: {
        result: AttemptResult.rejected,
      },
    });
    expect(learningAuditLogService.appendTeacherAdminEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'PhotoAttemptRejected',
        entityId: 'submission-1',
        payload: expect.objectContaining({
          reason: 'Нужна более чёткая фотография',
        }),
      }),
    );
    expect(response).toMatchObject({
      ok: true,
      submission: {
        id: 'submission-1',
        status: 'rejected',
        rejectedReason: 'Нужна более чёткая фотография',
      },
      taskState: {
        status: StudentTaskStatus.rejected,
      },
    });
  });
});
