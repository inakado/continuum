import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { ZipFile } from 'yazl';
import { AssessmentWorkCreateSchema } from '@continuum/shared';
import { PrismaService } from '../../src/prisma/prisma.service';
import { IdentityProvisioningService } from '../../src/auth/identity-provisioning.service';
import { ObjectStorageService } from '../../src/infra/storage/object-storage.service';
import { AssessmentBankWriteService } from '../../src/assessment-bank/assessment-bank-write.service';
import { AssessmentWorksReadService } from '../../src/assessment-works/assessment-works-read.service';
import { AssessmentWorksWriteService } from '../../src/assessment-works/assessment-works-write.service';

const prisma = new PrismaService();
const teachers: string[] = [];
const files = new Map<string, Buffer>();
const storage = { putObject: async ({ key, body }: { key: string; body: Buffer }) => { files.set(key, body); }, deleteObject: async (key: string) => { files.delete(key); } } as unknown as ObjectStorageService;
const bank = new AssessmentBankWriteService(prisma, storage);
const works = new AssessmentWorksWriteService(prisma, new AssessmentWorksReadService(prisma));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5xkAAAAASUVORK5CYII=', 'base64');
async function archive(prefix: string, changed = false, mixed = false) {
  const zip = new ZipFile();
  const ids = ['third', 'first', 'second'].map((name) => `${prefix}-${name}`);
  zip.addBuffer(Buffer.from(JSON.stringify({ format: 'continuum-assessment-package', version: 1, title: 'Работа из пакета', tasks: ids })), 'manifest.json');
  ids.forEach((id, index) => {
    const task = { id, title: id, gradeBand: mixed && index === 1 ? 'grade_8' : 'grade_10_11', topicPath: ['Механика', 'Кинематика'], maxPoints: index + 1,
      source: { provider: 'Авторское', kind: 'original', exam: 'none' }, type: index === 2 ? 'extended' : 'short_number', ...(index === 2 ? {} : { grading: { answer: '1', absoluteTolerance: 0 } }) };
    zip.addBuffer(Buffer.from(JSON.stringify(task)), `tasks/${id}/task.json`);
    zip.addBuffer(Buffer.from(`Проверка ${changed && index === 0 ? 'новой версии' : 'исходной версии'}.\n\n![График](images/graph.png)`), `tasks/${id}/statement.md`);
    zip.addBuffer(png, `tasks/${id}/images/graph.png`);
  });
  zip.end(); const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}
async function importTasks(prefix: string, owner = teachers[0], changed = false, mixed = false) {
  const preview = await bank.preview(owner, Readable.from([await archive(prefix, changed, mixed)]));
  expect(preview.issues).toEqual([]);
  const result = await bank.confirm(owner, preview.id!);
  return { preview, result };
}
beforeAll(async () => {
  await prisma.$connect();
  for (let index = 0; index < 2; index++) {
    const teacher = await new IdentityProvisioningService(prisma).createTeacher({ login: `import-work-${randomUUID()}`, password: 'Import-work-12345', firstName: 'Тест', lastName: 'Импорт', middleName: null });
    teachers.push(teacher.user.id);
  }
}, 30000);
afterAll(async () => {
  await prisma.assessmentBankImport.deleteMany({ where: { teacherId: { in: teachers } } });
  await prisma.assessmentWork.deleteMany({ where: { teacherId: { in: teachers } } });
  await prisma.assessmentBankTask.deleteMany({ where: { teacherId: { in: teachers } } });
  await prisma.user.deleteMany({ where: { id: { in: teachers } } });
  await prisma.$disconnect();
});
it('creates from the entire unchanged package in manifest order with pinned versions and bank assets', async () => {
  await importTasks('ordered');
  const { preview, result } = await importTasks('ordered');
  expect(result).toMatchObject({ added: 0, updated: 0, unchanged: 3, gradeBands: ['grade_10_11'] });
  expect(result.items?.map((ref) => ref.taskId)).toEqual(result.taskIds);
  expect(await bank.confirm(teachers[0], preview.id!)).toEqual(result);
  await importTasks('ordered', teachers[0], true);
  const work = await works.create(teachers[0], AssessmentWorkCreateSchema.parse({ id: randomUUID(), title: preview.title, gradeBand: 'grade_10_11', items: result.items }));
  expect(work.revision).toBe(1); expect(work.taskCount).toBe(3); expect(work.maxPoints).toBe(6);
  expect(work.items.map((item) => item.task.id)).toEqual(['ordered-third', 'ordered-first', 'ordered-second']);
  expect(work.items.map((item) => item.version)).toEqual([1, 1, 1]);
  expect(work.items[2].task.type).toBe('extended');
  const versions = await prisma.assessmentTaskVersion.findMany({ where: { task: { teacherId: teachers[0], stableId: { startsWith: 'ordered-' } }, version: 1 }, select: { data: true } });
  const keys = versions.flatMap((row) => (row.data as { images: { key: string }[] }).images.map((image) => image.key));
  await bank.discard(teachers[0], preview.id!);
  expect(keys.every((key) => files.has(key))).toBe(true);
  expect(await prisma.assessmentBankTask.count({ where: { teacherId: teachers[0], deletedAt: null, id: { in: result.taskIds } } })).toBe(3);
  expect(await prisma.assessmentWorkVersion.count({ where: { workId: work.id } })).toBe(0);
}, 30000);
it('serializes double creation and never overwrites a later edit on retry', async () => {
  const { result } = await importTasks('retry');
  const input = AssessmentWorkCreateSchema.parse({ id: randomUUID(), title: 'Первая редакция', gradeBand: 'grade_10_11', items: result.items });
  const [first, second] = await Promise.all([works.create(teachers[0], input), works.create(teachers[0], input)]);
  expect(first.id).toBe(second.id);
  expect(await prisma.assessmentWork.count({ where: { id: input.id } })).toBe(1);
  const edited = await works.update(teachers[0], first.id, { requestId: randomUUID(), expectedRevision: first.revision, title: 'Другое название', gradeBand: 'grade_10_11', instructions: '', items: [...result.items!].reverse() });
  await prisma.assessmentBankTask.update({ where: { id: result.taskIds[0] }, data: { deletedAt: new Date() } });
  const retried = await works.create(teachers[0], input);
  expect(retried.title).toBe('Другое название'); expect(retried.revision).toBe(edited.revision);
  expect(retried.items.map((item) => item.id)).toEqual(edited.items.map((item) => item.id));
});
it('rejects deleted, foreign and unavailable versions atomically; preserves plain create', async () => {
  const { result } = await importTasks('invalid');
  const foreign = await importTasks('foreign', teachers[1]);
  await prisma.assessmentBankTask.update({ where: { id: result.taskIds[0] }, data: { deletedAt: new Date() } });
  for (const items of [[result.items![0]], [foreign.result.items![0]], [{ ...result.items![1], version: 999 }]]) {
    const input = { id: randomUUID(), title: 'Не создавать частично', gradeBand: 'grade_10_11' as const, items };
    await expect(works.create(teachers[0], input)).rejects.toThrow();
    expect(await prisma.assessmentWork.findUnique({ where: { id: input.id } })).toBeNull();
  }
  const plain = await works.create(teachers[0], { id: randomUUID(), title: 'Пустой черновик', gradeBand: 'grade_8' });
  expect(plain.items).toEqual([]); expect(plain.maxPoints).toBe(0);
  await expect(works.create(teachers[1], { id: plain.id, title: 'Чужая', gradeBand: 'grade_8' })).rejects.toThrow();
  const mixed = await importTasks('mixed', teachers[0], false, true);
  expect(mixed.result.gradeBands).toEqual(['grade_10_11', 'grade_8']);
});
