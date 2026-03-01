import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@prisma/client', () => ({
  ContentStatus: {
    draft: 'draft',
    published: 'published',
  },
  Prisma: {
    DbNull: Symbol('DbNull'),
  },
  PrismaClient: class PrismaClient {},
  TaskAnswerType: {
    numeric: 'numeric',
    single_choice: 'single_choice',
    multi_choice: 'multi_choice',
    text: 'text',
  },
}));

import { ConflictException, NotFoundException } from '@nestjs/common';
import { ContentWriteService } from '../src/content/content-write.service';

const taskRevisionPayloadService = {
  normalizeTaskPayload: vi.fn(),
  createTaskRevision: vi.fn(),
  mapTaskWithRevision: vi.fn(),
  nextTaskRevisionNo: vi.fn(),
};

describe('ContentWriteService courses and sections slice', () => {
  const prisma = {
    course: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    section: {
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };

  const service = new ContentWriteService(prisma as never, taskRevisionPayloadService as never);

  beforeEach(() => {
    prisma.course.create.mockReset();
    prisma.course.findUnique.mockReset();
    prisma.course.update.mockReset();
    prisma.course.delete.mockReset();
    prisma.section.count.mockReset();
    prisma.section.findUnique.mockReset();
    prisma.section.create.mockReset();
    prisma.section.update.mockReset();
    prisma.section.delete.mockReset();
  });

  it('creates course and normalizes optional description to null', async () => {
    prisma.course.create.mockResolvedValue({
      id: 'course-1',
      title: 'Алгебра',
      description: null,
    });

    const result = await service.createCourse({ title: 'Алгебра' });

    expect(result).toEqual({
      id: 'course-1',
      title: 'Алгебра',
      description: null,
    });
    expect(prisma.course.create).toHaveBeenCalledWith({
      data: {
        title: 'Алгебра',
        description: null,
      },
    });
  });

  it('rejects deleting a course while sections still exist', async () => {
    prisma.course.findUnique.mockResolvedValue({ id: 'course-1' });
    prisma.section.count.mockResolvedValue(2);

    await expect(service.deleteCourse('course-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.course.delete).not.toHaveBeenCalled();
  });

  it('rejects publishing a section when parent course is draft', async () => {
    prisma.section.findUnique.mockResolvedValue({
      id: 'section-1',
      course: { id: 'course-1', status: 'draft' },
    });

    await expect(service.publishSection('section-1')).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.section.update).not.toHaveBeenCalled();
  });

  it('throws not found when updating a missing course', async () => {
    prisma.course.findUnique.mockResolvedValue(null);

    await expect(service.updateCourse('missing', { title: 'Новый курс' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
