import { Readable } from 'node:stream';
import { expect, it, vi } from 'vitest';
import { AssessmentBankReadService } from '../src/assessment-bank/assessment-bank-read.service';
import type { PrismaService } from '../src/prisma/prisma.service';
import type { ObjectStorageService } from '../src/infra/storage/object-storage.service';
import { parseAssessmentArchive } from '../src/assessment-bank/assessment-archive';
import { assessmentPolicy } from '../src/assessment-bank/assessment-policy';

it('does not export more archive entries than the importer can accept', async () => {
  const rows = ['first', 'second'].map((id) => ({ latestVersion: { data: {
    task: { id, title: 'Проба', gradeBand: 'grade_10_11', topicPath: ['МКТ'], maxPoints: 1, source: { provider: 'Авторское' }, type: 'short_number', grading: { answer: '1', absoluteTolerance: 0 } },
    statement: 'Условие', solution: null, hash: 'hash',
    images: Array.from({ length: 1500 }, (_, index) => ({ path: `images/${index}.png`, key: `${id}/${index}`, hash: 'hash', contentType: 'image/png' })),
  } } }));
  const prisma = { assessmentBankTask: { findMany: vi.fn().mockResolvedValue(rows) } } as unknown as PrismaService;
  const storage = { getObjectStream: vi.fn().mockImplementation(async () => ({ stream: Readable.from([Buffer.from('image')]) })) } as unknown as ObjectStorageService;
  const service = new AssessmentBankReadService(prisma, storage);
  await expect(service.export('teacher', { search: '', topic: '', page: 1 })).rejects.toThrow('Слишком много файлов');
});

it('keeps large valid task JSON within the importer text-size limit', async () => {
  const task = {
    id: 'sample', title: 'Проба', gradeBand: 'grade_10_11', topicPath: ['МКТ'], maxPoints: 1, source: { provider: 'Авторское' }, type: 'matching',
    rows: Array.from({ length: 30 }, (_, index) => ({ id: `r${index}`, content: 'x'.repeat(4320) })),
    options: Array.from({ length: 30 }, (_, index) => ({ id: `o${index}`, content: 'x'.repeat(4320) })),
    grading: { matches: Object.fromEntries(Array.from({ length: 30 }, (_, index) => [`r${index}`, `o${index}`])) },
  };
  expect(Buffer.byteLength(JSON.stringify(task))).toBeLessThanOrEqual(assessmentPolicy.textBytes);
  expect(Buffer.byteLength(JSON.stringify(task, null, 2))).toBeGreaterThan(assessmentPolicy.textBytes);
  const prisma = { assessmentBankTask: { findMany: vi.fn().mockResolvedValue([{ latestVersion: { data: { task, statement: 'Условие', solution: null, hash: 'hash', images: [] } } }]) } } as unknown as PrismaService;
  const service = new AssessmentBankReadService(prisma, {} as ObjectStorageService);
  const archive = await service.export('teacher', { search: '', topic: '', page: 1 });
  const restored = await parseAssessmentArchive(archive);
  expect(restored.tasks[0].task).toEqual(task);
});
