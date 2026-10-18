import { describe, expect, it, vi } from 'vitest';
import { LibraryAssetCleanupService } from '../src/library/library-asset-cleanup.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { ObjectStorageService } from '../src/infra/storage/object-storage.service';

describe('LibraryAssetCleanupService', () => {
  it('удаляет запись очереди только после S3, откладывает сбой и повторяет', async () => {
    const queue = { findMany: vi.fn().mockResolvedValue([{ objectKey: 'fixture.pdf' }]), deleteMany: vi.fn(), updateMany: vi.fn() };
    const storage = { deleteObject: vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined) };
    const cleanup = new LibraryAssetCleanupService({ libraryAssetDeletion: queue } as unknown as PrismaService, storage as unknown as ObjectStorageService);
    await cleanup.flush();
    expect(queue.deleteMany).not.toHaveBeenCalled();
    expect(queue.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { objectKey: 'fixture.pdf' } }));
    await cleanup.flush();
    expect(queue.deleteMany).toHaveBeenCalledWith({ where: { objectKey: 'fixture.pdf' } });
    expect(storage.deleteObject).toHaveBeenCalledTimes(2);
  });
});
