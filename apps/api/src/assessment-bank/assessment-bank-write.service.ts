import { BadRequestException, ConflictException, GoneException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AssessmentImportResultSchema, type AssessmentImportPreview } from '@continuum/shared';
import type { Prisma } from '@prisma/client';
import type { Readable } from 'node:stream';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { AssessmentArchiveError, parseAssessmentArchive } from './assessment-archive';
import { BaselineSchema, StoredAssessmentImportSchema, type StoredAssessmentTask } from './assessment-bank.mapper';
import { assessmentPolicy } from './assessment-policy';

const json = (value: object): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

@Injectable()
export class AssessmentBankWriteService {
  private readonly logger = new Logger(AssessmentBankWriteService.name);
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(ObjectStorageService) private readonly storage: ObjectStorageService) {}
  private async lock(tx: Prisma.TransactionClient, teacherId: string) {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${teacherId}::uuid FOR UPDATE`;
  }
  private async deleteFiles(entries: StoredAssessmentTask[]) {
    for (const entry of entries) for (const image of entry.images) await this.storage.deleteObject(image.key);
  }
  async discard(teacherId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, teacherId);
      const row = await tx.assessmentBankImport.findFirst({ where: { id, teacherId } });
      if (!row) return;
      const entries = StoredAssessmentImportSchema.parse(row.data);
      const used = row.result ? await tx.assessmentTaskVersion.findMany({ where: { task: { teacherId, stableId: { in: entries.map((entry) => entry.task.id) } } }, select: { data: true } }) : [];
      const referenced = new Set(used.flatMap((version) => StoredAssessmentImportSchema.element.parse(version.data).images.map((image) => image.key)));
      await this.deleteFiles(entries.map((entry) => ({ ...entry, images: entry.images.filter((image) => !referenced.has(image.key)) })));
      await tx.assessmentBankImport.delete({ where: { id } });
    }, { timeout: 30000 });
    return { id };
  }
  private async cleanExpired(teacherId: string) {
    const rows = await this.prisma.assessmentBankImport.findMany({ where: { teacherId, expiresAt: { lte: new Date() } }, select: { id: true }, take: 20 });
    for (const row of rows) await this.discard(teacherId, row.id);
  }
  async preview(teacherId: string, stream: Readable, contentLength?: string): Promise<AssessmentImportPreview> {
    if (contentLength && (!/^\d+$/.test(contentLength) || Number(contentLength) > assessmentPolicy.zipBytes)) throw new BadRequestException('ZIP превышает 25 МБ.');
    const chunks: Buffer[] = []; let size = 0;
    for await (const chunk of stream) { size += chunk.length; if (size > assessmentPolicy.zipBytes) throw new BadRequestException('ZIP превышает 25 МБ.'); chunks.push(Buffer.from(chunk)); }
    if (contentLength && Number(contentLength) !== size) throw new BadRequestException('Загрузка файла не завершена.');
    let parsed;
    try { parsed = await parseAssessmentArchive(Buffer.concat(chunks)); }
    catch (error) { if (error instanceof AssessmentArchiveError) return { id: null, title: '', expiresAt: null, items: [], issues: error.issues }; throw error; }
    await this.cleanExpired(teacherId);
    const id = randomUUID();
    const entries: StoredAssessmentTask[] = [];
    const expiresAt = new Date(Date.now() + assessmentPolicy.previewTtlMs);
    for (const entry of parsed.tasks) entries.push({ task: entry.task, statement: entry.statement, solution: entry.solution, hash: entry.hash,
      images: entry.images.map((image) => ({ path: image.path, key: `assessment-bank/${teacherId}/${id}/${entry.task.id}/${image.path}`, contentType: image.contentType, hash: image.hash })) });
    await this.prisma.assessmentBankImport.create({ data: { id, teacherId, title: parsed.manifest.title, data: json(entries), baseline: {}, expiresAt } });
    try {
      for (const entry of parsed.tasks) {
        for (const image of entry.images) {
          const key = `assessment-bank/${teacherId}/${id}/${entry.task.id}/${image.path}`;
          await this.storage.putObject({ key, body: image.bytes, contentType: image.contentType, cacheControl: 'private, no-store' });
        }
      }
      const current = await this.prisma.assessmentBankTask.findMany({ where: { teacherId, stableId: { in: entries.map((entry) => entry.task.id) } }, select: { stableId: true, latestVersion: { select: { contentHash: true, version: true } } } });
      const byId = new Map(current.map((row) => [row.stableId, row.latestVersion]));
      const baseline = Object.fromEntries(entries.map((entry) => [entry.task.id, byId.get(entry.task.id)?.contentHash ?? null]));
      await this.prisma.assessmentBankImport.update({ where: { id }, data: { baseline: json(baseline) } });
      return { id, title: parsed.manifest.title, expiresAt: expiresAt.toISOString(), issues: [], items: entries.map((entry) => {
        const previous = byId.get(entry.task.id);
        const status = !previous ? 'new' : previous.contentHash === entry.hash ? 'unchanged' : 'changed';
        return { stableId: entry.task.id, title: entry.task.title, source: entry.task.source, status, version: (previous?.version ?? 0) + (status === 'unchanged' ? 0 : 1) };
      }) };
    } catch (error) {
      try { await this.discard(teacherId, id); }
      catch { this.logger.warn(`Не удалось очистить предпросмотр ${id}; сохранена запись для повторной очистки.`); }
      throw error;
    }
  }
  async confirm(teacherId: string, id: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, teacherId);
      const preview = await tx.assessmentBankImport.findFirst({ where: { id, teacherId } });
      if (!preview) throw new NotFoundException('Проверка пакета не найдена.');
      if (preview.result) return AssessmentImportResultSchema.parse(preview.result);
      if (preview.expiresAt.getTime() <= Date.now()) throw new GoneException('Срок предпросмотра истёк. Загрузите пакет повторно.');
      const entries = StoredAssessmentImportSchema.parse(preview.data);
      const baseline = BaselineSchema.parse(preview.baseline);
      if (entries.some((entry) => !(entry.task.id in baseline))) throw new ConflictException('Загрузка пакета ещё не завершена.');
      const current = await tx.assessmentBankTask.findMany({ where: { teacherId, stableId: { in: entries.map((entry) => entry.task.id) } }, select: { id: true, stableId: true, latestVersion: { select: { contentHash: true, version: true } } } });
      const byId = new Map(current.map((row) => [row.stableId, row]));
      const result = { added: 0, updated: 0, unchanged: 0, taskIds: [] as string[] };
      for (const entry of entries) {
        const previous = byId.get(entry.task.id);
        if ((previous?.latestVersion?.contentHash ?? null) !== baseline[entry.task.id]) throw new ConflictException('Банк изменился после проверки. Загрузите пакет повторно, чтобы увидеть актуальные изменения.');
        if (previous?.latestVersion?.contentHash === entry.hash) { result.unchanged++; result.taskIds.push(previous.id); continue; }
        const bankTask = previous ?? await tx.assessmentBankTask.create({ data: { teacherId, stableId: entry.task.id } });
        const version = await tx.assessmentTaskVersion.create({ data: {
          taskId: bankTask.id, version: (previous?.latestVersion?.version ?? 0) + 1, contentHash: entry.hash, data: json(entry), title: entry.task.title, gradeBand: entry.task.gradeBand, type: entry.task.type, topicPath: entry.task.topicPath,
          searchText: [entry.task.id, entry.task.title, entry.statement, ...entry.task.topicPath, ...Object.values(entry.task.source), ...('options' in entry.task ? entry.task.options.map((option) => option.content) : [])].join(' '),
        } });
        await tx.assessmentBankTask.update({ where: { id: bankTask.id }, data: { latestVersionId: version.id } });
        result[previous ? 'updated' : 'added']++; result.taskIds.push(bankTask.id);
      }
      await tx.assessmentBankImport.update({ where: { id }, data: { result: json(result) } });
      return result;
    }, { timeout: 30000 });
    return result;
  }
}
