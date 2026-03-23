import { ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudentUnitStatus } from '@prisma/client';
import { LearningService } from '../src/learning/learning.service';

describe('LearningService', () => {
  const prisma = {
    course: {
      findFirst: vi.fn(),
    },
    section: {
      findFirst: vi.fn(),
    },
    sectionUnlockOverride: {
      findMany: vi.fn(),
    },
  };
  const contentService = {
    getPublishedSectionGraph: vi.fn(),
  };
  const learningAvailabilityService = {
    getSectionGraphAvailabilitySnapshot: vi.fn(),
    recomputeSectionAvailability: vi.fn(),
  };
  const studentsService = {};
  const learningAttemptsWriteService = {};
  const learningTeacherActionsService = {};

  const service = new LearningService(
    prisma as never,
    contentService as never,
    learningAvailabilityService as never,
    studentsService as never,
    learningAttemptsWriteService as never,
    learningTeacherActionsService as never,
  );

  beforeEach(() => {
    prisma.course.findFirst.mockReset();
    prisma.section.findFirst.mockReset();
    prisma.sectionUnlockOverride.findMany.mockReset();
    contentService.getPublishedSectionGraph.mockReset();
    learningAvailabilityService.getSectionGraphAvailabilitySnapshot.mockReset();
    learningAvailabilityService.recomputeSectionAvailability.mockReset();
    prisma.sectionUnlockOverride.findMany.mockResolvedValue([]);
  });

  it('maps student graph from graph-specific availability snapshot path', async () => {
    prisma.section.findFirst.mockResolvedValue({
      id: 'section-1',
      courseId: 'course-1',
    });
    prisma.course.findFirst.mockResolvedValue({
      id: 'course-1',
      title: 'Физика',
      description: 'Описание',
      coverImageAssetKey: null,
      status: 'published',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      sections: [
        {
          id: 'section-1',
          courseId: 'course-1',
          title: 'Механика',
          description: 'Раздел',
          coverImageAssetKey: null,
          status: 'published',
          sortOrder: 1,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          units: [{ id: 'unit-1' }, { id: 'unit-2' }],
        },
      ],
    });
    learningAvailabilityService.recomputeSectionAvailability.mockResolvedValue(
      new Map([
        ['unit-1', { completionPercent: 100 }],
        ['unit-2', { completionPercent: 100 }],
      ]),
    );
    contentService.getPublishedSectionGraph.mockResolvedValue({
      sectionId: 'section-1',
      nodes: [
        {
          unitId: 'unit-1',
          title: 'Тема 1',
          position: { x: 0, y: 0 },
        },
        {
          unitId: 'unit-2',
          title: 'Тема 2',
          position: { x: 1, y: 1 },
        },
      ],
      edges: [{ id: 'edge-1', fromUnitId: 'unit-1', toUnitId: 'unit-2' }],
    });
    learningAvailabilityService.getSectionGraphAvailabilitySnapshot.mockResolvedValue(
      new Map([
        [
          'unit-1',
          {
            unitId: 'unit-1',
            status: StudentUnitStatus.completed,
            totalTasks: 2,
            countedTasks: 2,
            optionalCountedTasks: 1,
            solvedTasks: 2,
            completionPercent: 100,
            solvedPercent: 100,
            hasAttempt: true,
            isCompleted: true,
            requiredTasksCount: 1,
            effectiveMinOptionalCountedTasksToComplete: 0,
          },
        ],
      ]),
    );

    const result = await service.getPublishedSectionGraphForStudent('student-1', 'section-1');

    expect(result).toEqual({
      sectionId: 'section-1',
      nodes: [
        {
          unitId: 'unit-1',
          title: 'Тема 1',
          position: { x: 0, y: 0 },
          status: StudentUnitStatus.completed,
          completionPercent: 100,
          solvedPercent: 100,
          solvedTasks: 2,
          totalTasks: 2,
          requiredDone: 1,
          requiredTotal: 1,
        },
        {
          unitId: 'unit-2',
          title: 'Тема 2',
          position: { x: 1, y: 1 },
          status: StudentUnitStatus.locked,
          completionPercent: 0,
          solvedPercent: 0,
          solvedTasks: 0,
          totalTasks: 0,
          requiredDone: 0,
          requiredTotal: 0,
        },
      ],
      edges: [{ id: 'edge-1', fromUnitId: 'unit-1', toUnitId: 'unit-2' }],
    });
    expect(learningAvailabilityService.getSectionGraphAvailabilitySnapshot).toHaveBeenCalledWith(
      'student-1',
      'section-1',
    );
    expect(learningAvailabilityService.recomputeSectionAvailability).toHaveBeenCalledWith(
      'student-1',
      'section-1',
    );
  });

  it('returns published student course with per-section completion percent', async () => {
    prisma.course.findFirst.mockResolvedValue({
      id: 'course-1',
      title: 'Физика',
      description: 'Описание',
      coverImageAssetKey: null,
      status: 'published',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      sections: [
        {
          id: 'section-1',
          courseId: 'course-1',
          title: 'Механика',
          description: 'Раздел',
          coverImageAssetKey: null,
          status: 'published',
          sortOrder: 1,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          units: [{ id: 'unit-1' }, { id: 'unit-2' }],
        },
      ],
    });
    learningAvailabilityService.recomputeSectionAvailability.mockResolvedValue(
      new Map([
        ['unit-1', { completionPercent: 100 }],
        ['unit-2', { completionPercent: 50 }],
      ]),
    );

    const result = await service.getPublishedCourseForStudent('student-1', 'course-1');

    expect(result).toEqual({
      id: 'course-1',
      title: 'Физика',
      description: 'Описание',
      coverImageAssetKey: null,
      status: 'published',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
      sections: [
        {
          id: 'section-1',
          courseId: 'course-1',
          title: 'Механика',
          description: 'Раздел',
          coverImageAssetKey: null,
          completionPercent: 75,
          accessStatus: 'available',
          status: 'published',
          sortOrder: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-02T00:00:00.000Z',
        },
      ],
    });
    expect(learningAvailabilityService.recomputeSectionAvailability).toHaveBeenCalledWith(
      'student-1',
      'section-1',
    );
  });

  it('locks later sections until previous section is completed', async () => {
    prisma.course.findFirst.mockResolvedValue({
      id: 'course-1',
      title: 'Физика',
      description: 'Описание',
      coverImageAssetKey: null,
      status: 'published',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      sections: [
        {
          id: 'section-1',
          courseId: 'course-1',
          title: 'Механика',
          description: 'Раздел 1',
          coverImageAssetKey: null,
          status: 'published',
          sortOrder: 1,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          units: [{ id: 'unit-1' }],
        },
        {
          id: 'section-2',
          courseId: 'course-1',
          title: 'Оптика',
          description: 'Раздел 2',
          coverImageAssetKey: null,
          status: 'published',
          sortOrder: 2,
          createdAt: new Date('2026-01-03T00:00:00.000Z'),
          updatedAt: new Date('2026-01-04T00:00:00.000Z'),
          units: [{ id: 'unit-2' }],
        },
      ],
    });
    learningAvailabilityService.recomputeSectionAvailability
      .mockResolvedValueOnce(new Map([['unit-1', { completionPercent: 40 }]]))
      .mockResolvedValueOnce(new Map([['unit-2', { completionPercent: 0 }]]));

    const result = await service.getPublishedCourseForStudent('student-1', 'course-1');

    expect(result.sections).toMatchObject([
      { id: 'section-1', accessStatus: 'available', completionPercent: 40 },
      { id: 'section-2', accessStatus: 'locked', completionPercent: 0 },
    ]);
  });

  it('rejects student section graph when previous section is not completed', async () => {
    prisma.section.findFirst.mockResolvedValue({
      id: 'section-2',
      courseId: 'course-1',
    });
    prisma.course.findFirst.mockResolvedValue({
      id: 'course-1',
      title: 'Физика',
      description: 'Описание',
      coverImageAssetKey: null,
      status: 'published',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      sections: [
        {
          id: 'section-1',
          courseId: 'course-1',
          title: 'Механика',
          description: 'Раздел 1',
          coverImageAssetKey: null,
          status: 'published',
          sortOrder: 1,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          units: [{ id: 'unit-1' }],
        },
        {
          id: 'section-2',
          courseId: 'course-1',
          title: 'Оптика',
          description: 'Раздел 2',
          coverImageAssetKey: null,
          status: 'published',
          sortOrder: 2,
          createdAt: new Date('2026-01-03T00:00:00.000Z'),
          updatedAt: new Date('2026-01-04T00:00:00.000Z'),
          units: [{ id: 'unit-2' }],
        },
      ],
    });
    learningAvailabilityService.recomputeSectionAvailability
      .mockResolvedValueOnce(new Map([['unit-1', { completionPercent: 40 }]]))
      .mockResolvedValueOnce(new Map([['unit-2', { completionPercent: 0 }]]));

    await expect(service.getPublishedSectionGraphForStudent('student-1', 'section-2')).rejects.toMatchObject({
      response: {
        code: 'SECTION_LOCKED',
      },
    } satisfies Partial<ConflictException>);
    expect(contentService.getPublishedSectionGraph).not.toHaveBeenCalled();
  });

  it('opens locked section when teacher override exists', async () => {
    prisma.section.findFirst.mockResolvedValue({
      id: 'section-2',
      courseId: 'course-1',
    });
    prisma.course.findFirst.mockResolvedValue({
      id: 'course-1',
      title: 'Физика',
      description: 'Описание',
      coverImageAssetKey: null,
      status: 'published',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
      sections: [
        {
          id: 'section-1',
          courseId: 'course-1',
          title: 'Механика',
          description: 'Раздел 1',
          coverImageAssetKey: null,
          status: 'published',
          sortOrder: 1,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-02T00:00:00.000Z'),
          units: [{ id: 'unit-1' }],
        },
        {
          id: 'section-2',
          courseId: 'course-1',
          title: 'Оптика',
          description: 'Раздел 2',
          coverImageAssetKey: null,
          status: 'published',
          sortOrder: 2,
          createdAt: new Date('2026-01-03T00:00:00.000Z'),
          updatedAt: new Date('2026-01-04T00:00:00.000Z'),
          units: [{ id: 'unit-2' }],
        },
      ],
    });
    prisma.sectionUnlockOverride.findMany.mockResolvedValue([{ sectionId: 'section-2' }]);
    learningAvailabilityService.recomputeSectionAvailability
      .mockResolvedValueOnce(new Map([['unit-1', { completionPercent: 40 }]]))
      .mockResolvedValueOnce(new Map([['unit-2', { completionPercent: 0 }]]));
    contentService.getPublishedSectionGraph.mockResolvedValue({
      sectionId: 'section-2',
      nodes: [],
      edges: [],
    });
    learningAvailabilityService.getSectionGraphAvailabilitySnapshot.mockResolvedValue(new Map());

    const result = await service.getPublishedSectionGraphForStudent('student-1', 'section-2');

    expect(result).toEqual({
      sectionId: 'section-2',
      nodes: [],
      edges: [],
    });
    expect(contentService.getPublishedSectionGraph).toHaveBeenCalledWith('section-2');
  });
});
