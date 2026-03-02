import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@prisma/client', () => ({
  ContentStatus: {
    published: 'published',
  },
  PrismaClient: class PrismaClient {},
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
}));

import { StudentTaskStatus, StudentUnitStatus } from '@prisma/client';
import { LearningAvailabilityService } from '../src/learning/learning-availability.service';

const createDbMock = () => ({
  section: {
    findFirst: vi.fn(),
  },
  unit: {
    findFirst: vi.fn(),
  },
  unitGraphEdge: {
    findMany: vi.fn(),
  },
  task: {
    findMany: vi.fn(),
  },
  studentUnitState: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  unitUnlockOverride: {
    findMany: vi.fn(),
  },
  studentTaskState: {
    findMany: vi.fn(),
  },
  attempt: {
    findMany: vi.fn(),
  },
});

describe('LearningAvailabilityService', () => {
  const prisma = createDbMock();
  const service = new LearningAvailabilityService(prisma as never);

  beforeEach(() => {
    vi.useRealTimers();

    prisma.section.findFirst.mockReset();
    prisma.unit.findFirst.mockReset();
    prisma.unitGraphEdge.findMany.mockReset();
    prisma.task.findMany.mockReset();
    prisma.studentUnitState.findMany.mockReset();
    prisma.studentUnitState.upsert.mockReset();
    prisma.studentUnitState.upsert.mockResolvedValue(undefined);
    prisma.unitUnlockOverride.findMany.mockReset();
    prisma.studentTaskState.findMany.mockReset();
    prisma.attempt.findMany.mockReset();
  });

  it('opens downstream unit after prerequisite unit becomes completed', async () => {
    prisma.section.findFirst.mockResolvedValue({
      units: [
        { id: 'unit-a', sortOrder: 1, minOptionalCountedTasksToComplete: 0 },
        { id: 'unit-b', sortOrder: 2, minOptionalCountedTasksToComplete: 0 },
      ],
    });
    prisma.unitGraphEdge.findMany.mockResolvedValue([{ prereqUnitId: 'unit-a', unitId: 'unit-b' }]);
    prisma.task.findMany.mockResolvedValue([
      { id: 'task-a-1', unitId: 'unit-a', isRequired: true },
      { id: 'task-a-2', unitId: 'unit-a', isRequired: false },
      { id: 'task-b-1', unitId: 'unit-b', isRequired: true },
    ]);
    prisma.studentUnitState.findMany.mockResolvedValue([]);
    prisma.unitUnlockOverride.findMany.mockResolvedValue([]);
    prisma.studentTaskState.findMany.mockResolvedValue([
      { taskId: 'task-a-1', status: StudentTaskStatus.correct },
      { taskId: 'task-a-2', status: StudentTaskStatus.accepted },
    ]);
    prisma.attempt.findMany.mockResolvedValue([{ taskId: 'task-a-1' }]);

    const snapshots = await service.recomputeSectionAvailability('student-1', 'section-1');

    expect(snapshots.get('unit-a')).toMatchObject({
      status: StudentUnitStatus.completed,
      countedTasks: 2,
      solvedTasks: 2,
      hasAttempt: true,
      completionPercent: 100,
    });
    expect(snapshots.get('unit-b')).toMatchObject({
      status: StudentUnitStatus.available,
      countedTasks: 0,
      solvedTasks: 0,
      hasAttempt: false,
    });
    expect(prisma.studentUnitState.upsert).toHaveBeenCalledTimes(2);
  });

  it('requires all optional tasks when unit has only optional tasks and zero minOptional gate', async () => {
    prisma.section.findFirst.mockResolvedValue({
      units: [{ id: 'unit-opt', sortOrder: 1, minOptionalCountedTasksToComplete: 0 }],
    });
    prisma.unitGraphEdge.findMany.mockResolvedValue([]);
    prisma.task.findMany.mockResolvedValue([
      { id: 'task-1', unitId: 'unit-opt', isRequired: false },
      { id: 'task-2', unitId: 'unit-opt', isRequired: false },
    ]);
    prisma.studentUnitState.findMany.mockResolvedValue([]);
    prisma.unitUnlockOverride.findMany.mockResolvedValue([]);
    prisma.studentTaskState.findMany.mockResolvedValue([
      { taskId: 'task-1', status: StudentTaskStatus.credited_without_progress },
    ]);
    prisma.attempt.findMany.mockResolvedValue([{ taskId: 'task-1' }]);

    const snapshots = await service.recomputeSectionAvailability('student-1', 'section-1');

    expect(snapshots.get('unit-opt')).toMatchObject({
      status: StudentUnitStatus.in_progress,
      totalTasks: 2,
      countedTasks: 1,
      solvedTasks: 0,
      hasAttempt: true,
      isCompleted: false,
      effectiveMinOptionalCountedTasksToComplete: 2,
    });
  });

  it('keeps override-open unit available and preserves existing timestamps on persist', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-01T10:00:00.000Z'));

    prisma.section.findFirst.mockResolvedValue({
      units: [
        { id: 'unit-a', sortOrder: 1, minOptionalCountedTasksToComplete: 0 },
        { id: 'unit-b', sortOrder: 2, minOptionalCountedTasksToComplete: 0 },
      ],
    });
    prisma.unitGraphEdge.findMany.mockResolvedValue([{ prereqUnitId: 'unit-a', unitId: 'unit-b' }]);
    prisma.task.findMany.mockResolvedValue([{ id: 'task-b-1', unitId: 'unit-b', isRequired: true }]);
    prisma.studentUnitState.findMany.mockResolvedValue([
      {
        unitId: 'unit-b',
        overrideOpened: false,
        becameAvailableAt: new Date('2026-02-20T08:00:00.000Z'),
        startedAt: new Date('2026-02-20T09:00:00.000Z'),
        completedAt: null,
      },
    ]);
    prisma.unitUnlockOverride.findMany.mockResolvedValue([{ unitId: 'unit-b' }]);
    prisma.studentTaskState.findMany.mockResolvedValue([
      { taskId: 'task-b-1', status: StudentTaskStatus.pending_review },
    ]);
    prisma.attempt.findMany.mockResolvedValue([{ taskId: 'task-b-1' }]);

    const snapshots = await service.recomputeSectionAvailability('student-1', 'section-1');

    expect(snapshots.get('unit-a')?.status).toBe(StudentUnitStatus.completed);
    expect(snapshots.get('unit-b')).toMatchObject({
      status: StudentUnitStatus.in_progress,
      hasAttempt: true,
    });
    expect(prisma.studentUnitState.upsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        create: expect.objectContaining({
          overrideOpened: true,
          becameAvailableAt: new Date('2026-02-20T08:00:00.000Z'),
          startedAt: new Date('2026-02-20T09:00:00.000Z'),
          completedAt: null,
        }),
        update: expect.objectContaining({
          overrideOpened: true,
          becameAvailableAt: new Date('2026-02-20T08:00:00.000Z'),
          startedAt: new Date('2026-02-20T09:00:00.000Z'),
          completedAt: null,
        }),
      }),
    );
  });

  it('builds graph snapshot without persisting student unit state', async () => {
    prisma.section.findFirst.mockResolvedValue({
      units: [
        { id: 'unit-a', sortOrder: 1, minOptionalCountedTasksToComplete: 0 },
        { id: 'unit-b', sortOrder: 2, minOptionalCountedTasksToComplete: 0 },
      ],
    });
    prisma.unitGraphEdge.findMany.mockResolvedValue([{ prereqUnitId: 'unit-a', unitId: 'unit-b' }]);
    prisma.task.findMany.mockResolvedValue([
      { id: 'task-a-1', unitId: 'unit-a', isRequired: true },
      { id: 'task-a-2', unitId: 'unit-a', isRequired: false },
      { id: 'task-b-1', unitId: 'unit-b', isRequired: true },
    ]);
    prisma.studentUnitState.findMany.mockResolvedValue([]);
    prisma.unitUnlockOverride.findMany.mockResolvedValue([]);
    prisma.studentTaskState.findMany.mockResolvedValue([
      { taskId: 'task-a-1', status: StudentTaskStatus.correct },
      { taskId: 'task-a-2', status: StudentTaskStatus.accepted },
    ]);
    prisma.attempt.findMany.mockResolvedValue([{ taskId: 'task-a-1' }]);

    const snapshots = await service.getSectionGraphAvailabilitySnapshot('student-1', 'section-1');

    expect(snapshots.get('unit-a')).toMatchObject({
      status: StudentUnitStatus.completed,
      countedTasks: 2,
      solvedTasks: 2,
      completionPercent: 100,
      solvedPercent: 100,
    });
    expect(snapshots.get('unit-b')).toMatchObject({
      status: StudentUnitStatus.available,
      countedTasks: 0,
      solvedTasks: 0,
      completionPercent: 0,
      solvedPercent: 0,
    });
    expect(prisma.studentUnitState.upsert).not.toHaveBeenCalled();
  });
});
