import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { LibraryWriteService } from '../src/library/library-write.service';
import type { PrismaService } from '../src/prisma/prisma.service';

const teacherId = '123e4567-e89b-12d3-a456-426614174001';
const studentId = '123e4567-e89b-12d3-a456-426614174000';
const sectionId = '123e4567-e89b-12d3-a456-426614174002';

const makePrisma = () => ({
  section: {
    findFirst: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  lesson: {
    findFirst: vi.fn(),
    aggregate: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  user: { findFirst: vi.fn() },
  accessGrant: { deleteMany: vi.fn(), upsert: vi.fn() },
});

describe('LibraryWriteService', () => {
  it('does not create a lesson in another teacher section', async () => {
    const prisma = makePrisma();
    prisma.section.findFirst.mockResolvedValue(null);
    const service = new LibraryWriteService(prisma as unknown as PrismaService);

    await expect(
      service.createLesson(teacherId, { sectionId, title: 'Кинематика' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.section.findFirst).toHaveBeenCalledWith({
      where: { id: sectionId, createdById: teacherId },
      select: { id: true },
    });
    expect(prisma.lesson.create).not.toHaveBeenCalled();
  });

  it('requires the parent section to be published first', async () => {
    const prisma = makePrisma();
    prisma.lesson.findFirst.mockResolvedValue({
      id: 'lesson-1',
      section: { status: 'draft' },
    });
    const service = new LibraryWriteService(prisma as unknown as PrismaService);

    await expect(service.publishLesson(teacherId, 'lesson-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.lesson.update).not.toHaveBeenCalled();
  });

  it('does not grant access to another teacher student', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue(null);
    const service = new LibraryWriteService(prisma as unknown as PrismaService);

    await expect(
      service.setAccessGrant(teacherId, {
        studentId,
        gradeBand: 'grade_8',
        enabled: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.accessGrant.upsert).not.toHaveBeenCalled();
  });

  it('upserts an idempotent grade access grant for a managed student', async () => {
    const prisma = makePrisma();
    prisma.user.findFirst.mockResolvedValue({ id: studentId });
    prisma.accessGrant.upsert.mockResolvedValue({
      id: 'grant-1',
      studentId,
      gradeBand: 'grade_8',
      grantedById: teacherId,
      grantedAt: new Date('2026-09-23T00:00:00.000Z'),
    });
    const service = new LibraryWriteService(prisma as unknown as PrismaService);

    await expect(
      service.setAccessGrant(teacherId, {
        studentId,
        gradeBand: 'grade_8',
        enabled: true,
      }),
    ).resolves.toEqual({
      grant: {
        studentId,
        gradeBand: 'grade_8',
        grantedAt: '2026-09-23T00:00:00.000Z',
      },
    });
    expect(prisma.accessGrant.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId_gradeBand: { studentId, gradeBand: 'grade_8' } },
      }),
    );
  });
});
