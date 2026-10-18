import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { DeleteLibraryInput } from '@continuum/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LibraryAssetCleanupService } from './library-asset-cleanup.service';

@Injectable()
export class LibraryDeleteService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(LibraryAssetCleanupService) private readonly cleanup: LibraryAssetCleanupService) {}
  private matches(actual: string[], input: DeleteLibraryInput) {
    const expected = new Set(input.expectedIds);
    if (actual.length !== expected.size || actual.some((id) => !expected.has(id))) {
      throw new ConflictException({ code: 'LIBRARY_CONTENT_CHANGED', message: 'Содержимое изменилось. Закройте окно и повторите удаление.' });
    }
  }
  private async lesson(tx: Prisma.TransactionClient, teacherId: string, id: string) {
    await tx.$queryRaw`SELECT id FROM lessons WHERE id = ${id}::uuid AND created_by_id = ${teacherId}::uuid FOR UPDATE`;
    const row = await tx.lesson.findFirst({ where: { id, createdById: teacherId }, include: { artifacts: true, tasks: true } });
    if (!row) throw new NotFoundException('Занятие не найдено.');
    return row;
  }
  private async assets(tx: Prisma.TransactionClient, ids: string[]) {
    const orphaned = await tx.asset.findMany({ where: { id: { in: [...new Set(ids)] }, lessonArtifacts: { none: {} }, taskImages: { none: {} }, taskDiagramScenes: { none: {} }, taskDiagramPreviews: { none: {} } }, select: { id: true, objectKey: true } });
    if (!orphaned.length) return;
    await tx.libraryAssetDeletion.createMany({ data: orphaned.map(({ objectKey }) => ({ objectKey })), skipDuplicates: true });
    await tx.asset.deleteMany({ where: { id: { in: orphaned.map((row) => row.id) } } });
  }
  private lessonAssets(row: { artifacts: { assetId: string }[]; tasks: { imageAssetId: string | null; diagramSceneAssetId: string | null; diagramPreviewAssetId: string | null }[] }) {
    return [...row.artifacts.map((file) => file.assetId), ...row.tasks.flatMap((task) => [task.imageAssetId, task.diagramSceneAssetId, task.diagramPreviewAssetId].filter((id): id is string => id !== null))];
  }
  async pdf(teacherId: string, id: string, type: 'pdf' | 'tasks_pdf', input: DeleteLibraryInput) {
    await this.db.$transaction(async (tx) => {
      const lesson = await this.lesson(tx, teacherId, id);
      const artifacts = lesson.artifacts.filter((file) => file.type === type);
      this.matches(artifacts.map((file) => file.id), input);
      await tx.lessonArtifact.deleteMany({ where: { lessonId: id, type } });
      await this.assets(tx, artifacts.map((file) => file.assetId));
    });
    this.cleanup.kick();
    return { id };
  }
  async removeLesson(teacherId: string, id: string, input: DeleteLibraryInput) {
    await this.db.$transaction(async (tx) => {
      const row = await this.lesson(tx, teacherId, id);
      this.matches(row.artifacts.map((file) => file.id), input);
      await tx.lesson.delete({ where: { id } });
      await this.assets(tx, this.lessonAssets(row));
    });
    this.cleanup.kick();
    return { id };
  }
  async section(teacherId: string, id: string, input: DeleteLibraryInput) {
    await this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM sections WHERE id = ${id}::uuid AND created_by_id = ${teacherId}::uuid FOR UPDATE`;
      if (!await tx.section.findFirst({ where: { id, createdById: teacherId } })) throw new NotFoundException('Раздел не найден.');
      const lessons = await tx.lesson.findMany({ where: { sectionId: id }, orderBy: { id: 'asc' } });
      this.matches(lessons.map((row) => row.id), input);
      const assets: string[] = [];
      for (const item of lessons) {
        const row = await this.lesson(tx, teacherId, item.id);
        assets.push(...this.lessonAssets(row));
        await tx.lesson.delete({ where: { id: row.id } });
      }
      await tx.section.delete({ where: { id } });
      await this.assets(tx, assets);
    }, { timeout: 15000 });
    this.cleanup.kick();
    return { id };
  }
}
