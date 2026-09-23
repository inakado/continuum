import { NotFoundException } from '@nestjs/common';
import { PublicationStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { LibraryReadService } from '../src/library/library-read.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const studentId = '123e4567-e89b-12d3-a456-426614174000';
const teacherId = '123e4567-e89b-12d3-a456-426614174001';
const lessonId = '123e4567-e89b-12d3-a456-426614174002';

const makePrisma = () => ({
  accessGrant: { findMany: vi.fn() },
  section: { findMany: vi.fn() },
  lesson: { findFirst: vi.fn() },
});

describe('LibraryReadService', () => {
  it('returns no catalog rows when the student has no grants', async () => {
    const prisma = makePrisma();
    prisma.accessGrant.findMany.mockResolvedValue([]);
    const service = new LibraryReadService(prisma as unknown as PrismaService);

    await expect(service.getStudentLibrary(studentId)).resolves.toEqual({ gradeBands: [] });
    expect(prisma.section.findMany).not.toHaveBeenCalled();
  });

  it('scopes catalog reads by both grade and granting teacher', async () => {
    const prisma = makePrisma();
    prisma.accessGrant.findMany.mockResolvedValue([
      { gradeBand: 'grade_10_11', grantedById: teacherId },
    ]);
    prisma.section.findMany.mockResolvedValue([
      {
        id: 'section-1',
        gradeBand: 'grade_10_11',
        title: 'Механика',
        description: null,
        status: 'published',
        sortOrder: 0,
        lessons: [
          {
            id: lessonId,
            title: 'Кинематика',
            description: null,
            status: 'published',
            sortOrder: 0,
            artifacts: [{ type: 'pdf' }],
            _count: { tasks: 1 },
          },
        ],
      },
    ]);
    const service = new LibraryReadService(prisma as unknown as PrismaService);

    const result = await service.getStudentLibrary(studentId);

    expect(prisma.section.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: PublicationStatus.published,
          OR: [{ gradeBand: 'grade_10_11', createdById: teacherId }],
        },
      }),
    );
    expect(result.gradeBands[0]?.sections[0]?.lessons[0]?.formats).toEqual({
      pdf: true,
      interactive: false,
      tasks: true,
    });
  });

  it('prevents a direct-link bypass and hides drafts behind the same query', async () => {
    const prisma = makePrisma();
    prisma.accessGrant.findMany.mockResolvedValue([
      { gradeBand: 'grade_8', grantedById: teacherId },
    ]);
    prisma.lesson.findFirst.mockResolvedValue(null);
    const service = new LibraryReadService(prisma as unknown as PrismaService);

    await expect(service.getStudentLesson(studentId, lessonId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.lesson.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: lessonId,
          status: PublicationStatus.published,
          section: {
            is: {
              status: PublicationStatus.published,
              OR: [{ gradeBand: 'grade_8', createdById: teacherId }],
            },
          },
        },
      }),
    );
  });

  it('rejects direct lesson reads before querying when access is absent', async () => {
    const prisma = makePrisma();
    prisma.accessGrant.findMany.mockResolvedValue([]);
    const service = new LibraryReadService(prisma as unknown as PrismaService);

    await expect(service.getStudentLesson(studentId, lessonId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.lesson.findFirst).not.toHaveBeenCalled();
  });
});
