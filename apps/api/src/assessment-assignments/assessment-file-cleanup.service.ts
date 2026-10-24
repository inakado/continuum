import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ObjectStorageService } from '../infra/storage/object-storage.service';

const retryMs = 60000;
@Injectable()
export class AssessmentFileCleanupService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AssessmentFileCleanupService.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(ObjectStorageService) private readonly storage: ObjectStorageService) {}
  onApplicationBootstrap() { this.kick(); this.timer = setInterval(() => this.kick(), retryMs); this.timer.unref(); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  kick() { void this.flush().catch(() => this.logger.warn('Очистка файлов отозванных назначений отложена.')); }
  async flush() {
    if (this.running) return;
    this.running = true;
    try {
      const rows = await this.db.assessmentFileDeletion.findMany({ where: { retryAt: { lte: new Date() } }, orderBy: { retryAt: 'asc' }, take: 20 });
      for (const row of rows) {
        try {
          await this.storage.deleteObject(row.objectKey);
          await this.db.assessmentFileDeletion.deleteMany({ where: { objectKey: row.objectKey } });
        } catch {
          await this.db.assessmentFileDeletion.updateMany({ where: { objectKey: row.objectKey }, data: { retryAt: new Date(Date.now() + retryMs) } });
          this.logger.warn('Файл отозванного назначения ожидает повторной очистки.');
        }
      }
    } finally { this.running = false; }
  }
}
