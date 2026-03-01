import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@prisma/client', () => ({
  AttemptResult: {
    correct: 'correct',
    incorrect: 'incorrect',
  },
  ContentStatus: {
    published: 'published',
  },
  NotificationType: {
    task_locked: 'task_locked',
    required_task_skipped: 'required_task_skipped',
  },
  PrismaClient: class PrismaClient {},
  Prisma: {
    DbNull: null,
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
  TaskAnswerType: {
    numeric: 'numeric',
    single_choice: 'single_choice',
    multi_choice: 'multi_choice',
    photo: 'photo',
  },
}));

import { AttemptResult, ContentStatus, NotificationType, StudentTaskStatus, TaskAnswerType } from '@prisma/client';
import { LearningAttemptsWriteService } from '../src/learning/learning-attempts-write.service';

const createTaskFixture = () => ({
  id: 'task-1',
  unitId: 'unit-1',
  isRequired: true,
  activeRevisionId: 'rev-1',
  status: ContentStatus.published,
  unit: {
    id: 'unit-1',
    sectionId: 'section-1',
    status: ContentStatus.published,
    section: {
      id: 'section-1',
      status: ContentStatus.published,
      course: {
        id: 'course-1',
        status: ContentStatus.published,
        lockDurationMinutes: 15,
      },
    },
  },
  activeRevision: {
    id: 'rev-1',
    answerType: TaskAnswerType.numeric,
    numericParts: [{ partKey: 'p1', labelLite: 'Part 1', correctValue: '42' }],
    choices: [],
    correctChoices: [],
  },
});

const createStateFixture = (overrides: Partial<Record<string, unknown>> = {}) => ({
  studentId: 'student-1',
  taskId: 'task-1',
  status: StudentTaskStatus.not_started,
  activeRevisionId: 'rev-1',
  wrongAttempts: 0,
  lockedUntil: null,
  requiredSkipped: false,
  creditedRevisionId: null,
  creditedAt: null,
  updatedAt: new Date('2026-03-01T00:00:00.000Z'),
  ...overrides,
});

const createAttemptFixture = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'attempt-1',
  attemptNo: 1,
  result: AttemptResult.correct,
  ...overrides,
});

const createTxMock = () => ({
  studentProfile: {
    findUnique: vi.fn(),
  },
  studentTaskState: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  attempt: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  notification: {
    create: vi.fn(),
  },
});

describe('LearningAttemptsWriteService', () => {
  const tx = createTxMock();
  const prisma = {
    task: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  const learningAuditLogService = {
    appendStudentLearningEvent: vi.fn(),
    appendStudentSystemEvent: vi.fn(),
  };
  const learningAvailabilityService = {
    recomputeSectionAvailability: vi.fn(),
  };

  const service = new LearningAttemptsWriteService(
    prisma as never,
    learningAuditLogService as never,
    learningAvailabilityService as never,
  );

  beforeEach(() => {
    prisma.task.findFirst.mockReset();
    prisma.$transaction.mockReset();
    prisma.$transaction.mockImplementation(async (callback: (input: typeof tx) => Promise<unknown>) => callback(tx));

    tx.studentProfile.findUnique.mockReset();
    tx.studentTaskState.findUnique.mockReset();
    tx.studentTaskState.create.mockReset();
    tx.studentTaskState.update.mockReset();
    tx.attempt.findFirst.mockReset();
    tx.attempt.create.mockReset();
    tx.notification.create.mockReset();

    learningAvailabilityService.recomputeSectionAvailability.mockReset();
    learningAvailabilityService.recomputeSectionAvailability.mockResolvedValue(
      new Map([['unit-1', { status: 'available' }]]),
    );

    learningAuditLogService.appendStudentLearningEvent.mockReset();
    learningAuditLogService.appendStudentSystemEvent.mockReset();
  });

  it('marks correct numeric attempt as correct and writes learning audit events', async () => {
    prisma.task.findFirst.mockResolvedValue(createTaskFixture());
    tx.studentProfile.findUnique.mockResolvedValue({ userId: 'student-1', leadTeacherId: 'teacher-1' });
    tx.studentTaskState.findUnique.mockResolvedValue(null);
    tx.studentTaskState.create.mockResolvedValue(createStateFixture());
    tx.attempt.findFirst.mockResolvedValue(null);
    tx.attempt.create.mockResolvedValue(createAttemptFixture());
    tx.studentTaskState.update.mockResolvedValue(
      createStateFixture({
        status: StudentTaskStatus.correct,
        wrongAttempts: 0,
        creditedRevisionId: 'rev-1',
      }),
    );

    const response = await service.submitAttempt('student-1', 'task-1', {
      answers: [{ partKey: 'p1', value: '42' }],
    });

    expect(response).toMatchObject({
      status: StudentTaskStatus.correct,
      attemptNo: 1,
      wrongAttempts: 0,
      blockedUntil: null,
      perPart: [{ partKey: 'p1', correct: true }],
    });
    expect(tx.attempt.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          result: AttemptResult.correct,
          kind: TaskAnswerType.numeric,
        }),
      }),
    );
    expect(learningAuditLogService.appendStudentLearningEvent).toHaveBeenCalledTimes(2);
    expect(learningAuditLogService.appendStudentLearningEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        eventType: 'AttemptEvaluatedCorrect',
        entityId: 'attempt-1',
      }),
    );
    expect(learningAuditLogService.appendStudentSystemEvent).not.toHaveBeenCalled();
  });

  it('locks task on third wrong attempt and emits teacher notification + system audit', async () => {
    prisma.task.findFirst.mockResolvedValue(createTaskFixture());
    tx.studentProfile.findUnique.mockResolvedValue({ userId: 'student-1', leadTeacherId: 'teacher-1' });
    tx.studentTaskState.findUnique.mockResolvedValue(
      createStateFixture({
        status: StudentTaskStatus.in_progress,
        wrongAttempts: 2,
      }),
    );
    tx.attempt.findFirst.mockResolvedValue({ attemptNo: 2 });
    tx.attempt.create.mockResolvedValue(
      createAttemptFixture({
        id: 'attempt-3',
        attemptNo: 3,
        result: AttemptResult.incorrect,
      }),
    );
    tx.studentTaskState.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      createStateFixture({
        status: data.status,
        wrongAttempts: data.wrongAttempts,
        lockedUntil: data.lockedUntil,
      }),
    );

    const response = await service.submitAttempt('student-1', 'task-1', {
      answers: [{ partKey: 'p1', value: '0' }],
    });

    expect(response.status).toBe(StudentTaskStatus.blocked);
    expect(response.wrongAttempts).toBe(3);
    expect(response.blockedUntil).toBeInstanceOf(Date);
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipientUserId: 'teacher-1',
          type: NotificationType.task_locked,
        }),
      }),
    );
    expect(learningAuditLogService.appendStudentSystemEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'TaskLockedForStudent',
        entityId: 'task-1',
      }),
    );
  });

  it('resets non-credited task state when active revision changes before evaluating attempt', async () => {
    prisma.task.findFirst.mockResolvedValue(createTaskFixture());
    tx.studentProfile.findUnique.mockResolvedValue({ userId: 'student-1', leadTeacherId: 'teacher-1' });
    tx.studentTaskState.findUnique.mockResolvedValue(
      createStateFixture({
        status: StudentTaskStatus.in_progress,
        activeRevisionId: 'rev-old',
        wrongAttempts: 2,
        lockedUntil: new Date('2026-03-01T01:00:00.000Z'),
        requiredSkipped: true,
      }),
    );
    tx.studentTaskState.update
      .mockResolvedValueOnce(
        createStateFixture({
          status: StudentTaskStatus.not_started,
          activeRevisionId: 'rev-1',
          wrongAttempts: 0,
          lockedUntil: null,
          requiredSkipped: false,
          creditedRevisionId: null,
          creditedAt: null,
        }),
      )
      .mockResolvedValueOnce(
        createStateFixture({
          status: StudentTaskStatus.correct,
          activeRevisionId: 'rev-1',
          wrongAttempts: 0,
          lockedUntil: null,
          requiredSkipped: false,
          creditedRevisionId: 'rev-1',
          creditedAt: new Date('2026-03-01T00:00:00.000Z'),
        }),
      );
    tx.attempt.findFirst.mockResolvedValue(null);
    tx.attempt.create.mockResolvedValue(createAttemptFixture());

    const response = await service.submitAttempt('student-1', 'task-1', {
      answers: [{ partKey: 'p1', value: '42' }],
    });

    expect(response).toMatchObject({
      status: StudentTaskStatus.correct,
      wrongAttempts: 0,
      blockedUntil: null,
    });
    expect(tx.studentTaskState.update).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          status: StudentTaskStatus.not_started,
          activeRevisionId: 'rev-1',
          wrongAttempts: 0,
          lockedUntil: null,
          requiredSkipped: false,
          creditedRevisionId: null,
          creditedAt: null,
        }),
      }),
    );
  });

  it('auto-credits required task without progress on sixth wrong attempt', async () => {
    prisma.task.findFirst.mockResolvedValue(createTaskFixture());
    tx.studentProfile.findUnique.mockResolvedValue({ userId: 'student-1', leadTeacherId: 'teacher-1' });
    tx.studentTaskState.findUnique.mockResolvedValue(
      createStateFixture({
        status: StudentTaskStatus.in_progress,
        wrongAttempts: 5,
      }),
    );
    tx.attempt.findFirst.mockResolvedValue({ attemptNo: 5 });
    tx.attempt.create.mockResolvedValue(
      createAttemptFixture({
        id: 'attempt-6',
        attemptNo: 6,
        result: AttemptResult.incorrect,
      }),
    );
    tx.studentTaskState.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      createStateFixture({
        status: data.status,
        wrongAttempts: data.wrongAttempts,
        requiredSkipped: data.requiredSkipped,
        creditedRevisionId: data.creditedRevisionId,
        creditedAt: data.creditedAt,
        lockedUntil: data.lockedUntil,
      }),
    );

    const response = await service.submitAttempt('student-1', 'task-1', {
      answers: [{ partKey: 'p1', value: '0' }],
    });

    expect(response).toMatchObject({
      status: StudentTaskStatus.credited_without_progress,
      wrongAttempts: 6,
      blockedUntil: null,
      perPart: [{ partKey: 'p1', correct: false }],
    });
    expect(tx.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recipientUserId: 'teacher-1',
          type: NotificationType.required_task_skipped,
        }),
      }),
    );
    expect(learningAuditLogService.appendStudentSystemEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        eventType: 'TaskAutoCreditedWithoutProgress',
      }),
    );
    expect(learningAuditLogService.appendStudentSystemEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        eventType: 'RequiredTaskSkippedFlagSet',
      }),
    );
  });
});
