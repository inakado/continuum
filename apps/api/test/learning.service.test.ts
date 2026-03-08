import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StudentUnitStatus } from '@prisma/client';
import { LearningService } from '../src/learning/learning.service';

describe('LearningService', () => {
  const prisma = {
    course: {
      findFirst: vi.fn(),
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
    contentService.getPublishedSectionGraph.mockReset();
    learningAvailabilityService.getSectionGraphAvailabilitySnapshot.mockReset();
    learningAvailabilityService.recomputeSectionAvailability.mockReset();
  });

  it('maps student graph from graph-specific availability snapshot path', async () => {
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
        },
        {
          unitId: 'unit-2',
          title: 'Тема 2',
          position: { x: 1, y: 1 },
          status: StudentUnitStatus.locked,
          completionPercent: 0,
          solvedPercent: 0,
        },
      ],
      edges: [{ id: 'edge-1', fromUnitId: 'unit-1', toUnitId: 'unit-2' }],
    });
    expect(learningAvailabilityService.getSectionGraphAvailabilitySnapshot).toHaveBeenCalledWith(
      'student-1',
      'section-1',
    );
    expect(learningAvailabilityService.recomputeSectionAvailability).not.toHaveBeenCalled();
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
});
