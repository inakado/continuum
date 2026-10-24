import { expect, it, vi } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { ObjectStorageService } from '../src/infra/storage/object-storage.service';
import { AssessmentFileCleanupService } from '../src/assessment-assignments/assessment-file-cleanup.service';

it('retains failed photo/PDF deletions and removes the queue entry only after a successful storage retry', async () => {
  const queue = { findMany: vi.fn().mockResolvedValue([{ objectKey: 'qa-revocation/file.pdf' }]), deleteMany: vi.fn(), updateMany: vi.fn() };
  const storage = { deleteObject: vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined) };
  const cleanup = new AssessmentFileCleanupService({ assessmentFileDeletion: queue } as unknown as PrismaService, storage as unknown as ObjectStorageService);
  await cleanup.flush();
  expect(queue.deleteMany).not.toHaveBeenCalled();
  expect(queue.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { objectKey: 'qa-revocation/file.pdf' } }));
  await cleanup.flush();
  expect(queue.deleteMany).toHaveBeenCalledWith({ where: { objectKey: 'qa-revocation/file.pdf' } });
  expect(storage.deleteObject).toHaveBeenCalledTimes(2);
});
