import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContentWriteCourseSectionService } from '../src/content/content-write-course-section.service';

describe('ContentWriteCourseSectionService', () => {
  const prisma = {
    course: {
      findUnique: vi.fn(),
    },
    section: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  };

  const service = new ContentWriteCourseSectionService(prisma as never);

  beforeEach(() => {
    prisma.course.findUnique.mockReset();
    prisma.section.findFirst.mockReset();
    prisma.section.create.mockReset();
  });

  it('appends a new section after the current max sortOrder', async () => {
    prisma.course.findUnique.mockResolvedValue({ id: 'course-1' });
    prisma.section.findFirst.mockResolvedValue({ sortOrder: 3 });
    prisma.section.create.mockResolvedValue({
      id: 'section-4',
      courseId: 'course-1',
      title: 'Оптика',
      description: null,
      sortOrder: 4,
    });

    const result = await service.createSection({
      courseId: 'course-1',
      title: 'Оптика',
      description: null,
      sortOrder: 0,
    });

    expect(prisma.section.create).toHaveBeenCalledWith({
      data: {
        courseId: 'course-1',
        title: 'Оптика',
        description: null,
        sortOrder: 4,
      },
    });
    expect(result.sortOrder).toBe(4);
  });
});
