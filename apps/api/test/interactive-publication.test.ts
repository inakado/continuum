import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { ConflictException } from '@nestjs/common';
import { LibraryWriteService } from '../src/library/library-write.service';
import { LibraryReadService } from '../src/library/library-read.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { ObjectStorageService } from '../src/infra/storage/object-storage.service';
import { interactiveLessonPolicy } from '@continuum/shared';
const lessonId = '123e4567-e89b-12d3-a456-426614174002';
const teacherId = '123e4567-e89b-12d3-a456-426614174001';
describe('interactive publication boundaries', () => {
  it('rejects an invalid ZIP before storing any bytes or allocating artifact records', async () => {
    const storage = { putObject: vi.fn(), deleteObject: vi.fn() };
    const prisma = { lesson: { findFirst: vi.fn().mockResolvedValue({ id: lessonId }) }, $transaction: vi.fn() };
    const service = new LibraryWriteService(prisma as unknown as PrismaService, storage as unknown as ObjectStorageService);
    await expect(service.uploadArtifact(teacherId, lessonId, { type: 'interactive', filename: 'bad.zip', contentType: 'application/zip', sizeBytes: 8 }, '8', Readable.from(['PKbroken']))).rejects.toThrow();
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('detects upload/delete changes between validation and the locked publish transaction', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      lesson: { findFirst: vi.fn().mockResolvedValue({ section: { status: 'published' } }), update: vi.fn() },
      lessonArtifact: { findMany: vi.fn().mockResolvedValue([{ id: 'new-pdf', type: 'pdf' }]), update: vi.fn(), updateMany: vi.fn() },
    };
    const prisma = {
      lesson: { findFirst: vi.fn().mockResolvedValue({ id: lessonId, section: { status: 'published' } }) },
      lessonArtifact: { findMany: vi.fn().mockResolvedValue([{ id: 'old-pdf', type: 'pdf' }]) },
      $transaction: vi.fn((work) => work(tx)),
    };
    const service = new LibraryWriteService(prisma as unknown as PrismaService, {} as ObjectStorageService);
    await expect(service.publishLesson(teacherId, lessonId)).rejects.toBeInstanceOf(ConflictException);
    expect(tx.$queryRaw).toHaveBeenCalled();
    expect(tx.lessonArtifact.updateMany).not.toHaveBeenCalled();
    expect(tx.lesson.update).not.toHaveBeenCalled();
  });
  it('rejects oversized legacy stored artifacts without opening an S3 download', async () => {
    const prisma = { lessonArtifact: { findFirst: vi.fn().mockResolvedValue({ asset: { objectKey: 'legacy.zip', sizeBytes: BigInt(interactiveLessonPolicy.zipBytes + 1), contentHash: '' } }) } };
    const storage = { getObjectStream: vi.fn() };
    const service = new LibraryReadService(prisma as unknown as PrismaService, storage as unknown as ObjectStorageService);
    await expect(service.getTeacherInteractive(teacherId, lessonId)).rejects.toThrow();
    expect(storage.getObjectStream).not.toHaveBeenCalled();
  });
  it('denies an ungranted student before querying an artifact or accessing storage', async () => {
    const prisma = { accessGrant: { findMany: vi.fn().mockResolvedValue([]) }, lessonArtifact: { findFirst: vi.fn() } };
    const storage = { getObjectStream: vi.fn() };
    const service = new LibraryReadService(prisma as unknown as PrismaService, storage as unknown as ObjectStorageService);
    await expect(service.getStudentInteractive(teacherId, lessonId)).rejects.toThrow();
    expect(prisma.lessonArtifact.findFirst).not.toHaveBeenCalled();
    expect(storage.getObjectStream).not.toHaveBeenCalled();
  });
});
