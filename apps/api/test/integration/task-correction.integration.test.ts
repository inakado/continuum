import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { ZipFile } from 'yazl';
import { AssessmentPackageTaskSchema, StudentWorkDetailSchema, type AssessmentPackageTask } from '@continuum/shared';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ObjectStorageService } from '../../src/infra/storage/object-storage.service';
import { AssessmentBankWriteService } from '../../src/assessment-bank/assessment-bank-write.service';
import { AssessmentBankReadService } from '../../src/assessment-bank/assessment-bank-read.service';
import { parseAssessmentArchive } from '../../src/assessment-bank/assessment-archive';
import { AssessmentWorksReadService } from '../../src/assessment-works/assessment-works-read.service';
import { AssessmentWorksWriteService } from '../../src/assessment-works/assessment-works-write.service';
import { StudentAttemptReadService } from '../../src/assessment-assignments/student-attempt-read.service';
import { StudentAttemptWriteService } from '../../src/assessment-assignments/student-attempt-write.service';
import { StatisticsReadService } from '../../src/assessment-assignments/statistics-read.service';
import { SolutionReadService } from '../../src/assessment-assignments/solution-read.service';
import { applyAssessmentPresentations, assessmentPresentationCompatible } from '../../src/common/assessment-presentation';
import { ReviewerReadService } from '../../src/reviewer/reviewer-read.service';
import type { ReviewerAuthService, ReviewerPrincipal } from '../../src/reviewer/reviewer-auth.service';

const db = new PrismaService();
const users: string[] = [], workIds: string[] = [];
const objects = new Map<string, Buffer>();
const storage = { putObject: async ({ key, body }: { key: string; body: Buffer }) => { objects.set(key, body); }, deleteObject: async (key: string) => { objects.delete(key); },
  getObjectStream: async (key: string) => ({ stream: Readable.from([objects.get(key)!]) }) } as unknown as ObjectStorageService;
const writes = new AssessmentBankWriteService(db, storage), bank = new AssessmentBankReadService(db, storage);
const reads = new AssessmentWorksReadService(db), works = new AssessmentWorksWriteService(db, reads);
const students = new StudentAttemptReadService(db, storage), attempts = new StudentAttemptWriteService(db, students);
const statistics = new StatisticsReadService(db, new SolutionReadService(db, storage));
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5xkAAAAASUVORK5CYII=', 'base64');
const statement = (text: string) => `${text}\n\n![График](images/graph.png)`;
function task(): AssessmentPackageTask {
  return AssessmentPackageTaskSchema.parse({ id: `correction-${randomUUID()}`, title: 'Координата тела', gradeBand: 'grade_10_11', topicPath: ['Механика', 'Кинематика'], maxPoints: 1,
    source: { provider: 'Тест' }, type: 'short_number', unit: 'м/с²', grading: { answer: '-12', absoluteTolerance: 0 } });
}
async function preview(entries: { task: AssessmentPackageTask; text: string }[], owner = users[0]) {
  const zip = new ZipFile();
  zip.addBuffer(Buffer.from(JSON.stringify({ format: 'continuum-assessment-package', version: 1, title: 'Исправление', tasks: entries.map((entry) => entry.task.id) })), 'manifest.json');
  for (const entry of entries) {
    const path = `tasks/${entry.task.id}/`;
    zip.addBuffer(Buffer.from(JSON.stringify(entry.task)), `${path}task.json`);
    zip.addBuffer(Buffer.from(statement(entry.text)), `${path}statement.md`);
    zip.addBuffer(png, `${path}images/graph.png`);
  }
  zip.end(); const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream) chunks.push(Buffer.from(chunk));
  const result = await writes.preview(owner, Readable.from([Buffer.concat(chunks)]));
  expect(result.issues).toEqual([]);
  return result.id!;
}
async function fixture() {
  const first = task(), extended = AssessmentPackageTaskSchema.parse({ id: `extended-${randomUUID()}`, title: 'Решите задачу', gradeBand: first.gradeBand, topicPath: first.topicPath, source: first.source, type: 'extended', maxPoints: 2 });
  const id = await preview([{ task: first, text: 'Исходное условие' }, { task: extended, text: 'Решите задачу' }]);
  const imported = await writes.confirm(users[0], id);
  const work = await works.create(users[0], { id: randomUUID(), title: 'Проверка исправления', gradeBand: 'grade_10_11', items: imported.items });
  workIds.push(work.id);
  const version = await works.freeze(users[0], work.id, 1);
  const assignment = await db.assessmentAssignment.create({ data: { versionId: version.id, classTitle: 'QA', academicYear: 2026 } });
  const recipients = await Promise.all(users.slice(2).map((studentId, index) => db.assessmentRecipient.create({ data: { assignmentId: assignment.id, versionId: version.id, studentId, studentName: `QA ${index}`, studentLogin: `qa-${index}` } })));
  return { first, extended, imported, work, version, recipients };
}
beforeAll(async () => {
  await db.$connect();
  for (let index = 0; index < 4; index++) {
    const id = randomUUID(); users.push(id);
    await db.user.create({ data: { id, role: index < 2 ? 'teacher' : 'student', login: `correction-${id}`, email: `correction-${id}@example.test`, name: 'QA correction' } });
  }
}, 30000);
afterAll(async () => {
  await db.assessmentRecipient.deleteMany({ where: { version: { workId: { in: workIds } } } });
  await db.assessmentAssignment.deleteMany({ where: { version: { workId: { in: workIds } } } });
  await db.assessmentWorkVersion.deleteMany({ where: { workId: { in: workIds } } });
  await db.assessmentWork.deleteMany({ where: { id: { in: workIds } } });
  await db.assessmentBankImport.deleteMany({ where: { teacherId: { in: users.slice(0, 2) } } });
  await db.assessmentBankTask.deleteMany({ where: { teacherId: { in: users.slice(0, 2) } } });
  await db.user.deleteMany({ where: { id: { in: users } } }); await db.$disconnect();
}, 30000);
it('corrects bank, draft, frozen, statistics and student views; keeps answers/results/snapshots exactly', async () => {
  const f = await fixture(), taskId = f.imported.taskIds[0];
  for (let index = 0; index < 2; index++) {
    await attempts.start(users[index + 2], f.recipients[index].id);
    const saved = await attempts.save(users[index + 2], f.recipients[index].id, taskId, { requestId: randomUUID(), expectedRevision: 1, answer: { type: 'short_number', value: '-12' } });
    if (index === 1) await attempts.finish(users[index + 2], f.recipients[index].id, saved.revision);
  }
  const before = await db.assessmentRecipient.findMany({ where: { versionId: f.version.id }, orderBy: { id: 'asc' } });
  const snapshot = await db.assessmentWorkVersion.findUniqueOrThrow({ where: { id: f.version.id } });
  const old = await students.detail(users[2], f.recipients[0].id);
  const single = await parseAssessmentArchive(await bank.exportTask(users[0], taskId));
  expect(single.tasks.map((entry) => entry.task.id)).toEqual([f.first.id]);
  const importId = await preview([{ task: f.first, text: 'Исправленное условие $x = 18 + 32t - 6t^2$.' }]);
  const input = { taskId, expectedVersion: 1 };
  const [corrected, repeated] = await Promise.all([writes.confirm(users[0], importId, input), writes.confirm(users[0], importId, input)]);
  expect(corrected).toEqual(repeated); expect(corrected.correction).toEqual({ taskId, sourceVersion: 1 });
  expect(await db.assessmentTaskVersion.count({ where: { taskId } })).toBe(2);
  const detail = StudentWorkDetailSchema.parse(await students.detail(users[2], f.recipients[0].id));
  expect(detail.items[0].statement).toContain('Исправленное условие'); expect(detail.answers[taskId]).toEqual({ type: 'short_number', value: '-12' });
  expect(detail.presentationRevision).not.toBe(old.presentationRevision);
  expect((await students.availability(users[2], f.recipients[0].id)).presentationRevision).toBe(detail.presentationRevision);
  expect(detail.items[0].images['images/graph.png']).not.toBe(old.items[0].images['images/graph.png']);
  expect((await students.image(users[2], f.recipients[0].id, taskId, 'graph.png')).stream).toBeInstanceOf(Readable);
  expect((await bank.view(users[0], taskId)).statement).toContain('Исправленное условие');
  for (const view of [await reads.detail(users[0], f.work.id), await reads.version(users[0], f.work.id, 1)]) {
    expect(view.items[0].version).toBe(1); expect(view.items[0].statement).toContain('Исправленное условие'); expect(view.items[0].images['images/graph.png']).toContain('?version=2');
  }
  expect((await statistics.detail(users[0], f.version.id, taskId, f.recipients[1].id)).item.statement).toContain('Исправленное условие');
  expect((await students.detail(users[3], f.recipients[1].id)).result?.points).toBe(1);
  expect(await db.assessmentRecipient.findMany({ where: { versionId: f.version.id }, orderBy: { id: 'asc' } })).toEqual(before);
  expect(await db.assessmentWorkVersion.findUnique({ where: { id: f.version.id } })).toEqual(snapshot);
  await writes.discard(users[0], importId);
  expect((await students.image(users[2], f.recipients[0].id, taskId, 'graph.png')).stream).toBeInstanceOf(Readable);
}, 30000);
it('blocks incompatible/foreign/deleted/stale/multi-task corrections atomically and preserves ordinary import semantics', async () => {
  const f = await fixture(), taskId = f.imported.taskIds[0];
  if (f.first.type !== 'short_number') throw new Error('fixture');
  for (const changed of [{ ...f.first, grading: { answer: '12', absoluteTolerance: 0 } }, { ...f.first, maxPoints: 2 }, { ...f.first, unit: 'м' }]) {
    const importId = await preview([{ task: changed, text: 'Другое условие' }]);
    await expect(writes.confirm(users[0], importId, { taskId, expectedVersion: 1 })).rejects.toThrow(/Можно исправить только/);
  }
  const many = await preview([{ task: f.first, text: '1' }, { task: f.extended, text: '2' }]);
  await expect(writes.confirm(users[0], many, { taskId, expectedVersion: 1 })).rejects.toThrow(/только задача/);
  const correct = await preview([{ task: f.first, text: 'Исправление' }]);
  await expect(writes.confirm(users[1], correct, { taskId, expectedVersion: 1 })).rejects.toThrow();
  await expect(writes.confirm(users[0], correct, { taskId, expectedVersion: 9 })).rejects.toThrow(/изменилось/);
  await db.assessmentBankTask.update({ where: { id: taskId }, data: { deletedAt: new Date() } });
  await expect(writes.confirm(users[0], correct, { taskId, expectedVersion: 1 })).rejects.toThrow(/недоступно/);
  await db.assessmentBankTask.update({ where: { id: taskId }, data: { deletedAt: null } });
  expect(await db.assessmentTaskVersion.count({ where: { taskId } })).toBe(1);
  // A normal import stays pinned. It cannot be promoted into a correction by replaying its receipt.
  const ordinary = await preview([{ task: f.first, text: 'Обычное обновление' }]);
  await writes.confirm(users[0], ordinary);
  expect((await reads.version(users[0], f.work.id, 1)).items[0].statement).toContain('Исходное условие');
  await expect(writes.confirm(users[0], ordinary, { taskId, expectedVersion: 1 })).rejects.toThrow(/другим действием/);
  await expect(writes.confirm(users[0], correct, { taskId, expectedVersion: 1 })).rejects.toThrow(/изменилось/);
}, 30000);
it('preserves matching identities/order and selects the latest correction compatible with each pinned key', async () => {
  const number = task();
  if (number.type !== 'short_number') throw new Error('fixture');
  const { unit: _unit, grading: _grading, ...base } = number;
  const matching = AssessmentPackageTaskSchema.parse({ ...base, type: 'matching', rows: [{ id: 'a', content: 'A' }, { id: 'b', content: 'B' }], options: [{ id: 'one', content: '1' }, { id: 'two', content: '2' }], grading: { matches: { a: 'one', b: 'two' } } });
  if (matching.type !== 'matching') throw new Error('fixture');
  expect(assessmentPresentationCompatible(matching, { ...matching, rows: matching.rows.map((row) => ({ ...row, content: 'Исправленный текст' })) })).toBe(true);
  expect(assessmentPresentationCompatible(matching, { ...matching, options: [...matching.options].reverse() })).toBe(false);
  const id = await preview([{ task: number, text: 'Исходное' }]), first = await writes.confirm(users[0], id), taskId = first.taskIds[0];
  const correction1 = await preview([{ task: number, text: 'Первое исправление' }]); await writes.confirm(users[0], correction1, { taskId, expectedVersion: 1 });
  const other = AssessmentPackageTaskSchema.parse({ ...number, maxPoints: 2 });
  await writes.confirm(users[0], await preview([{ task: other, text: 'Новая шкала' }]));
  await writes.confirm(users[0], await preview([{ task: other, text: 'Исправление новой шкалы' }]), { taskId, expectedVersion: 3 });
  const source = await db.assessmentTaskVersion.findUniqueOrThrow({ where: { taskId_version: { taskId, version: 1 } } });
  const stored = (await import('../../src/assessment-bank/assessment-bank.mapper')).StoredAssessmentTaskSchema.parse(source.data);
  const [display] = await applyAssessmentPresentations(db, [{ taskId, version: 1, data: stored }]);
  expect(display.presentationVersion).toBe(2); expect(display.data.statement).toContain('Первое исправление'); expect(display.data.task.maxPoints).toBe(1);
}, 30000);

it('corrects an extended condition for the reviewer while leaving existing solution photos and revisions intact', async () => {
  const f = await fixture(), taskId = f.imported.taskIds[1], recipient = f.recipients[0];
  await attempts.start(users[2], recipient.id);
  const answer = await db.assessmentSolutionAnswer.create({ data: { recipientId: recipient.id, taskId, revision: 1 } });
  const photo = await db.assessmentSolutionPhoto.create({ data: { id: randomUUID(), answerId: answer.id, objectKey: `qa-correction/${answer.id}/photo.png`, contentHash: 'photo-hash', contentType: 'image/png', sizeBytes: png.length, confirmedAt: new Date() } });
  objects.set(photo.objectKey, png);
  const auth = { recipients: () => ({ studentId: users[2] }), assignment: async () => ({ id: recipient.assignmentId }) } as unknown as ReviewerAuthService;
  const reviewer = new ReviewerReadService(db, auth, storage);
  const principal: ReviewerPrincipal = { userId: users[0], login: 'qa', keyId: randomUUID(), scopes: ['read'], classIds: [], studentIds: [users[2]], expiresAt: new Date(Date.now() + 60000) };
  const before = await reviewer.detail(principal, answer.id);
  const importId = await preview([{ task: f.extended, text: 'Исправленное развёрнутое условие' }]);
  await writes.confirm(users[0], importId, { taskId, expectedVersion: 1 });
  const after = await reviewer.detail(principal, answer.id);
  expect(after.statement).toContain('Исправленное развёрнутое условие');
  expect(after.sourceRevision).toBe(before.sourceRevision); expect(after.photos).toEqual(before.photos);
  expect((await reviewer.image(principal, answer.id, 'graph.png')).stream).toBeInstanceOf(Readable);
  expect(await db.assessmentSolutionAnswer.findUnique({ where: { id: answer.id } })).toEqual(answer);
  expect(await db.assessmentSolutionPhoto.findUnique({ where: { id: photo.id } })).toEqual(photo);
}, 30000);
