import { BadRequestException, GoneException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ASSESSMENT_PACKAGE_TASK_LIMIT, type AssessmentBankQuery } from '@continuum/shared';
import type { Prisma } from '@prisma/client';
import { ZipFile } from 'yazl';
import { Readable } from 'node:stream';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { assessmentPolicy } from './assessment-policy';
import { StoredAssessmentImportSchema, StoredAssessmentTaskSchema, mapAssessmentSummary, mapAssessmentView } from './assessment-bank.mapper';

@Injectable()
export class AssessmentBankReadService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService, @Inject(ObjectStorageService) private readonly storage: ObjectStorageService) {}

  private where(teacherId: string, query: AssessmentBankQuery): Prisma.AssessmentBankTaskWhereInput {
    return { teacherId, latestVersion: { is: { ...(query.gradeBand ? { gradeBand: query.gradeBand } : {}), ...(query.type ? { type: query.type } : {}), ...(query.topic ? { topicPath: { has: query.topic } } : {}), ...(query.search ? { searchText: { contains: query.search, mode: 'insensitive' } } : {}) } } };
  }
  async list(teacherId: string, query: AssessmentBankQuery) {
    const where = this.where(teacherId, query);
    const [rows, total, topics] = await this.prisma.$transaction([
      this.prisma.assessmentBankTask.findMany({ where, include: { latestVersion: true }, orderBy: { stableId: 'asc' }, skip: (query.page - 1) * assessmentPolicy.pageSize, take: assessmentPolicy.pageSize }),
      this.prisma.assessmentBankTask.count({ where }),
      this.prisma.assessmentTaskVersion.findMany({ where: { currentFor: { is: { teacherId } }, ...(query.gradeBand ? { gradeBand: query.gradeBand } : {}) }, select: { topicPath: true } }),
    ]);
    return { tasks: rows.flatMap((row) => row.latestVersion ? [mapAssessmentSummary(row.id, row.latestVersion.version, StoredAssessmentTaskSchema.parse(row.latestVersion.data))] : []), total, pageSize: assessmentPolicy.pageSize, topics: [...new Set(topics.flatMap((row) => row.topicPath))].sort((a, b) => a.localeCompare(b, 'ru')) };
  }
  async getStored(teacherId: string, taskId: string, version?: number) {
    const row = await this.prisma.assessmentBankTask.findFirst({ where: { id: taskId, teacherId }, include: { latestVersion: true } });
    if (!row?.latestVersion) throw new NotFoundException('Задача не найдена.');
    const record = version ? await this.prisma.assessmentTaskVersion.findUnique({ where: { taskId_version: { taskId, version } } }) : row.latestVersion;
    if (!record) throw new NotFoundException('Версия не найдена.');
    return { data: StoredAssessmentTaskSchema.parse(record.data), version: record.version };
  }
  async view(teacherId: string, taskId: string, version?: number) {
    const record = await this.getStored(teacherId, taskId, version);
    return mapAssessmentView(taskId, record.version, record.data, `/teacher/assessment-bank/tasks/${taskId}/images`);
  }
  async previewRecord(teacherId: string, id: string) {
    const row = await this.prisma.assessmentBankImport.findFirst({ where: { id, teacherId } });
    if (!row) throw new NotFoundException('Проверка пакета не найдена.');
    if (row.expiresAt.getTime() <= Date.now()) throw new GoneException('Срок предпросмотра истёк. Загрузите пакет повторно.');
    return { row, entries: StoredAssessmentImportSchema.parse(row.data) };
  }
  async previewView(teacherId: string, id: string, stableId: string) {
    const { entries } = await this.previewRecord(teacherId, id);
    const entry = entries.find((item) => item.task.id === stableId);
    if (!entry) throw new NotFoundException('Задача пакета не найдена.');
    return mapAssessmentView(stableId, 1, entry, `/teacher/assessment-bank/imports/${id}/tasks/${stableId}/images`);
  }
  async image(teacherId: string, id: string, name: string, importId?: string, version?: number) {
    const data = importId ? (await this.previewRecord(teacherId, importId)).entries.find((entry) => entry.task.id === id) : (await this.getStored(teacherId, id, version)).data;
    const image = data?.images.find((entry) => entry.path === `images/${name}`);
    if (!image) throw new NotFoundException('Рисунок не найден.');
    const object = await this.storage.getObjectStream(image.key);
    if (!(object.stream instanceof Readable)) throw new Error('Хранилище вернуло неподдерживаемый поток.');
    return { ...object, stream: object.stream, contentType: image.contentType };
  }
  async export(teacherId: string, query: AssessmentBankQuery) {
    const rows = await this.prisma.assessmentBankTask.findMany({ where: this.where(teacherId, query), include: { latestVersion: true }, orderBy: { stableId: 'asc' }, take: ASSESSMENT_PACKAGE_TASK_LIMIT + 1 });
    if (!rows.length || rows.length > ASSESSMENT_PACKAGE_TASK_LIMIT) throw new BadRequestException('Для экспорта выберите фильтрами от 1 до 500 заданий.');
    const entries = rows.flatMap((row) => row.latestVersion ? [StoredAssessmentTaskSchema.parse(row.latestVersion.data)] : []);
    const files = 1 + entries.reduce((count, entry) => count + 2 + (entry.solution !== null ? 1 : 0) + entry.images.length, 0);
    if (files > assessmentPolicy.files) throw new BadRequestException('Слишком много файлов. Сузьте фильтры экспорта.');
    const zip = new ZipFile();
    let bytes = 0;
    const add = (body: Buffer, path: string) => { bytes += body.length; if (bytes > assessmentPolicy.unpackedBytes) throw new BadRequestException('Пакет слишком большой. Сузьте фильтры экспорта.'); zip.addBuffer(body, path); };
    add(Buffer.from(JSON.stringify({ format: 'continuum-assessment-package', version: 1, title: 'Экспорт банка заданий', tasks: entries.map((entry) => entry.task.id) }, null, 2)), 'manifest.json');
    // Start draining immediately: yazl may emit while source images are being fetched.
    const chunks: Buffer[] = []; let outputBytes = 0;
    const output = (async () => { for await (const chunk of zip.outputStream) { outputBytes += chunk.length; if (outputBytes > assessmentPolicy.zipBytes) throw new BadRequestException('ZIP превышает 25 МБ. Сузьте фильтры экспорта.'); chunks.push(Buffer.from(chunk)); } return Buffer.concat(chunks); })();
    // Attach a rejection handler now; errors are rethrown through the awaited promise below.
    void output.catch(() => undefined);
    try {
      for (const entry of entries) {
        const prefix = `tasks/${entry.task.id}/`;
        add(Buffer.from(JSON.stringify(entry.task)), `${prefix}task.json`);
        add(Buffer.from(entry.statement), `${prefix}statement.md`);
        if (entry.solution !== null) add(Buffer.from(entry.solution), `${prefix}solution.md`);
        for (const image of entry.images) {
          const object = await this.storage.getObjectStream(image.key);
          const imageChunks: Buffer[] = []; let imageBytes = 0;
          for await (const chunk of object.stream) { imageBytes += chunk.length; if (imageBytes > assessmentPolicy.fileBytes) throw new BadRequestException('Размер рисунка превышает ограничение.'); imageChunks.push(Buffer.from(chunk)); }
          add(Buffer.concat(imageChunks), `${prefix}${image.path}`);
        }
      }
      zip.end(); return await output;
    } catch (error) { if (zip.outputStream instanceof Readable) zip.outputStream.destroy(); throw error; }
  }
}
