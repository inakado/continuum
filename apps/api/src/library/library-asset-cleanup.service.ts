import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../infra/storage/object-storage.service';

const retryMs = 60000;

@Injectable()
export class LibraryAssetCleanupService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(LibraryAssetCleanupService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(ObjectStorageService) private readonly storage: ObjectStorageService) {}
  onApplicationBootstrap() { this.kick(); this.timer = setInterval(() => this.kick(), retryMs); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  kick() { void this.flush().catch(() => this.logger.warn('Очистка файлов библиотеки отложена; повторим позже.')); }
  async flush() {
    if (this.running) return;
    this.running = true;
    try {
      const pending = await this.db.libraryAssetDeletion.findMany({ where: { retryAt: { lte: new Date() } }, orderBy: { retryAt: 'asc' }, take: 20 });
      for (const item of pending) {
        try {
          await this.storage.deleteObject(item.objectKey);
          await this.db.libraryAssetDeletion.deleteMany({ where: { objectKey: item.objectKey } });
        } catch {
          await this.db.libraryAssetDeletion.updateMany({ where: { objectKey: item.objectKey }, data: { retryAt: new Date(Date.now() + retryMs) } });
          this.logger.warn('Файл библиотеки ожидает повторного удаления из хранилища.');
        }
      }
    } finally { this.running = false; }
  }
}
