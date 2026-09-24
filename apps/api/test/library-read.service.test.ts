import { NotFoundException } from '@nestjs/common';
import { PublicationStatus } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { LibraryReadService } from '../src/library/library-read.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { ObjectStorageService } from '../src/infra/storage/object-storage.service';

const studentId = '123e4567-e89b-12d3-a456-426614174000';
const teacherId = '123e4567-e89b-12d3-a456-426614174001';
const lessonId = '123e4567-e89b-12d3-a456-426614174002';

const makePrisma = () => ({
  accessGrant: { findMany: vi.fn() },
  section: { findMany: vi.fn() },
  lesson: { findFirst: vi.fn() },
  lessonArtifact: { findFirst: vi.fn() },
});

const makeStorage = () => ({ getPresignedGetUrl: vi.fn().mockResolvedValue('https://example.test/file.pdf') });

describe('LibraryReadService', () => {
  it('returns no catalog rows when the student has no grants', async () => {
    const prisma = makePrisma();
    prisma.accessGrant.findMany.mockResolvedValue([]);
    const service = new LibraryReadService(prisma as unknown as PrismaService, makeStorage() as unknown as ObjectStorageService);

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
            artifacts: [{ type: 'pdf' }, { type: 'tasks_pdf' }],
          },
        ],
      },
    ]);
    const service = new LibraryReadService(prisma as unknown as PrismaService, makeStorage() as unknown as ObjectStorageService);

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
    const service = new LibraryReadService(prisma as unknown as PrismaService, makeStorage() as unknown as ObjectStorageService);

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
    const service = new LibraryReadService(prisma as unknown as PrismaService, makeStorage() as unknown as ObjectStorageService);

    await expect(service.getStudentLesson(studentId, lessonId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.lesson.findFirst).not.toHaveBeenCalled();
  });

  it('gates student PDF URLs by grant, publication and active version', async () => {
    const prisma = makePrisma();
    const storage = makeStorage();
    prisma.accessGrant.findMany.mockResolvedValue([{ gradeBand: 'grade_8', grantedById: teacherId }]);
    prisma.lessonArtifact.findFirst.mockResolvedValue({
      asset: { objectKey: 'pdf/task-file', contentType: 'application/pdf' },
    });
    const service = new LibraryReadService(
      prisma as unknown as PrismaService,
      storage as unknown as ObjectStorageService,
    );

    await expect(service.getStudentArtifactView(studentId, lessonId)).resolves.toEqual({
      url: 'https://example.test/file.pdf',
    });
    expect(prisma.lessonArtifact.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        type: { in: ['pdf', 'tasks_pdf'] },
        status: PublicationStatus.published,
        isActive: true,
        lesson: { is: {
          status: PublicationStatus.published,
          section: { is: {
            status: PublicationStatus.published,
            OR: [{ gradeBand: 'grade_8', createdById: teacherId }],
          } },
        } },
      }),
    }));
  });

  it('does not expose a file URL when the student has no grant or file is not visible', async () => {
    const prisma = makePrisma();
    const storage = makeStorage();
    const service = new LibraryReadService(
      prisma as unknown as PrismaService,
      storage as unknown as ObjectStorageService,
    );
    prisma.accessGrant.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      { gradeBand: 'grade_8', grantedById: teacherId },
    ]);
    prisma.lessonArtifact.findFirst.mockResolvedValue(null);

    await expect(service.getStudentArtifactView(studentId, lessonId)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getStudentArtifactView(studentId, lessonId)).rejects.toBeInstanceOf(NotFoundException);
    expect(storage.getPresignedGetUrl).not.toHaveBeenCalled();
    expect(prisma.lessonArtifact.findFirst).toHaveBeenCalledTimes(1);
  });
});
