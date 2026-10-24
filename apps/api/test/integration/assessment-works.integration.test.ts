import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { IdentityProvisioningService } from '../../src/auth/identity-provisioning.service';
import { createBetterAuth } from '../../src/auth/better-auth.factory';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ObjectStorageService } from '../../src/infra/storage/object-storage.service';
import { resolveObjectStorageConfig } from '../../src/infra/storage/object-storage.config';
import { StoredAssessmentTaskSchema, StoredAssessmentImportSchema } from '../../src/assessment-bank/assessment-bank.mapper';
import type { AssessmentAnswer, AssessmentPackageTask, AssessmentWorkDetail } from '@continuum/shared';

const db = new PrismaService();
const identities = new IdentityProvisioningService(db);
const storage = new ObjectStorageService(resolveObjectStorageConfig());
const root = '/teacher/assessment-works';
const origin = 'http://localhost:3001';
const teachers: string[] = [];
let cookie = '', other = '', studentCookie = '', studentId = '';
let refs: { taskId: string; version: number }[] = [];
const id = randomUUID();
const api = async (path: string, method = 'GET', body?: object | Buffer, session = cookie, requestOrigin = origin) => {
  const response = await fetch(`http://localhost:3000${path}`, { method, headers: { cookie: session, origin: requestOrigin, ...(body ? { 'Content-Type': Buffer.isBuffer(body) ? 'application/zip' : 'application/json' } : {}) }, body: body ? Buffer.isBuffer(body) ? body : JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json() };
};
beforeAll(async () => {
  await db.$connect();
  for (let i = 0; i < 2; i++) {
    const login = `works-${randomUUID()}`;
    const teacher = await identities.createTeacher({ login, password: 'Local-works-123', firstName: 'Тест', lastName: 'Работы', middleName: null });
    teachers.push(teacher.user.id);
    const response = await createBetterAuth(db).api.signInUsername({ body: { username: login, password: 'Local-works-123' }, asResponse: true, headers: new Headers({ origin }) });
    const session = response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
    if (i) other = session; else cookie = session;
  }
  const studentLogin = `works-student-${randomUUID()}`;
  const student = await identities.createStudent({ login: studentLogin, password: 'Local-works-123', leadTeacherId: teachers[0], firstName: 'Тест', lastName: 'Ученик' });
  studentId = student.user.id;
  const studentSession = await createBetterAuth(db).api.signInUsername({ body: { username: studentLogin, password: 'Local-works-123' }, asResponse: true, headers: new Headers({ origin }) });
  studentCookie = studentSession.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
  const pilot = await readFile(resolve(__dirname, '../../../../output/assessment-package-pilot-v1.zip'));
  const preview = await api('/teacher/assessment-bank/imports/preview', 'POST', pilot);
  const imported = await api(`/teacher/assessment-bank/imports/${preview.data.id}/confirm`, 'POST');
  refs = imported.data.taskIds.map((taskId: string) => ({ taskId, version: 1 }));
}, 30000);
afterAll(async () => {
  const copyScope = { version: { work: { teacherId: { in: teachers } } } };
  await db.assessmentRecipient.deleteMany({ where: copyScope });
  await db.assessmentAssignment.deleteMany({ where: copyScope });
  await db.$executeRaw`DELETE FROM assessment_work_versions WHERE work_id IN (SELECT id FROM assessment_works WHERE teacher_id = ANY(${teachers}::uuid[]))`;
  await db.$executeRaw`DELETE FROM assessment_works WHERE teacher_id = ANY(${teachers}::uuid[])`;
  const imports = await db.assessmentBankImport.findMany({ where: { teacherId: { in: teachers } } });
  const versions = await db.assessmentTaskVersion.findMany({ where: { task: { teacherId: { in: teachers } } } });
  const keys = new Set([...imports.flatMap((row) => StoredAssessmentImportSchema.parse(row.data)), ...versions.map((row) => StoredAssessmentTaskSchema.parse(row.data))].flatMap((entry) => entry.images.map((image) => image.key)));
  await Promise.all([...keys].map((key) => storage.deleteObject(key)));
  await db.assessmentBankImport.deleteMany({ where: { teacherId: { in: teachers } } });
  await db.assessmentBankTask.deleteMany({ where: { teacherId: { in: teachers } } });
  if (studentId) await db.studentProfile.deleteMany({ where: { userId: studentId } });
  await db.user.deleteMany({ where: { id: { in: [...teachers, studentId].filter(Boolean) } } });
  await db.$disconnect();
}, 30000);

function correctAnswer(task: AssessmentPackageTask): AssessmentAnswer | null {
  switch (task.type) {
    case 'short_number': return { type: task.type, value: task.grading.answer };
    case 'short_text': return { type: task.type, value: task.grading.acceptedAnswers[0] };
    case 'single_choice': return { type: task.type, optionId: task.grading.correctOptionId };
    case 'multiple_choice': return { type: task.type, optionIds: task.grading.correctOptionIds };
    case 'matching': return { type: task.type, matches: task.grading.matches };
    case 'extended': return null;
  }
}

it('checks trial answers using server grading without persisting work, attempts, results or versions', async () => {
  const workId = randomUUID(), path = `${root}/${workId}`;
  await api(root, 'POST', { id: workId, title: 'Пробная проверка', gradeBand: 'grade_10_11' });
  const detail = (await api(path, 'PATCH', { title: 'Пробная проверка', instructions: '', gradeBand: 'grade_10_11', items: refs, expectedRevision: 1, requestId: randomUUID() })).data as AssessmentWorkDetail;
  const numeric = detail.items.find((item) => item.task.type === 'short_number')!;
  const checkPath = `${path}/check-answer`;
  const input = { taskId: numeric.id, source: { kind: 'draft', expectedRevision: 2 }, answer: correctAnswer(numeric.task) };
  const before = await db.assessmentWork.findUniqueOrThrow({ where: { id: workId } });
  expect((await api(checkPath, 'POST', input, '')).status).toBe(401);
  expect((await api(checkPath, 'POST', input, studentCookie)).status).toBe(403);
  expect((await api(checkPath, 'POST', input, other)).status).toBe(404);
  expect((await api(checkPath, 'POST', input, cookie, 'https://foreign.example')).status).toBe(403);
  for (const invalid of [{ ...input, grading: {} }, { ...input, taskId: randomUUID() }, { ...input, answer: { type: 'short_text', value: 'wrong type' } }]) expect((await api(checkPath, 'POST', invalid)).status).toBe(400);
  for (const item of detail.items) {
    const result = await api(checkPath, 'POST', { ...input, taskId: item.id, answer: correctAnswer(item.task) });
    expect(result.status).toBe(200);
    expect(result.data).toEqual({ correct: true, points: item.task.maxPoints, maxPoints: item.task.maxPoints });
    expect((await api(checkPath, 'POST', { ...input, taskId: item.id, answer: null })).data).toEqual({ correct: false, points: 0, maxPoints: item.task.maxPoints });
  }
  expect((await api(checkPath, 'POST', { ...input, answer: { type: 'short_number', value: 'not-a-number' } })).data.correct).toBe(false);
  const choices = detail.items.find((item) => item.task.type === 'multiple_choice' || item.task.type === 'single_choice')!;
  expect((await api(checkPath, 'POST', { ...input, taskId: choices.id, answer: { type: choices.task.type, ...(choices.task.type === 'single_choice' ? { optionId: 'foreign' } : { optionIds: ['foreign'] }) } })).status).toBe(400);
  const repeated = await Promise.all(Array.from({ length: 3 }, () => api(checkPath, 'POST', input)));
  expect(repeated.every((result) => result.status === 200 && result.data.correct)).toBe(true);
  expect(await db.assessmentWork.findUniqueOrThrow({ where: { id: workId } })).toEqual(before);
  expect(await db.assessmentWorkVersion.count({ where: { workId } })).toBe(0);
  expect(await db.assessmentAssignment.count({ where: { version: { workId } } })).toBe(0);
  expect(await db.assessmentRecipient.count({ where: { version: { workId } } })).toBe(0);
  await api(`${path}/versions`, 'POST', { expectedRevision: 2 });
  await api(path, 'PATCH', { title: 'Другая редакция', instructions: '', gradeBand: 'grade_10_11', items: refs.filter((ref) => ref.taskId !== numeric.id), expectedRevision: 2, requestId: randomUUID() });
  expect((await api(checkPath, 'POST', input)).status).toBe(409);
  expect((await api(checkPath, 'POST', { ...input, source: { kind: 'draft', expectedRevision: 3 } })).status).toBe(400);
  const afterEdit = await db.assessmentWork.findUniqueOrThrow({ where: { id: workId } });
  expect((await api(checkPath, 'POST', { ...input, source: { kind: 'version', number: 1 } })).data).toEqual({ correct: true, points: numeric.task.maxPoints, maxPoints: numeric.task.maxPoints });
  expect((await api(checkPath, 'POST', { ...input, source: { kind: 'version', number: 99 } })).status).toBe(404);
  expect(await db.assessmentWork.findUniqueOrThrow({ where: { id: workId } })).toEqual(afterEdit);
  expect(await db.assessmentWorkVersion.count({ where: { workId } })).toBe(1);
  expect(await db.assessmentRecipient.count({ where: { version: { workId } } })).toBe(0);
});

it('creates a resumable draft, isolates owners and rejects empty immutable versions', async () => {
  expect((await api(root, 'GET', undefined, '')).status).toBe(401);
  expect((await api(root, 'GET', undefined, studentCookie)).status).toBe(403);
  const body = { id, title: 'Проверочная работа', gradeBand: 'grade_10_11' };
  const created = await api(root, 'POST', body);
  expect(created.status).toBe(201);
  expect(created.data).toMatchObject({ id, revision: 1, taskCount: 0, items: [] });
  expect((await api(root, 'POST', body)).data.id).toBe(id);
  expect((await api(`${root}/${id}`, 'GET', undefined, other)).status).toBe(404);
  expect((await api(`${root}/${id}`, 'GET', undefined, studentCookie)).status).toBe(403);
  expect((await api(`${root}/${id}/versions`, 'POST', { expectedRevision: 1 })).status).toBe(400);
});

it('deletes from the bank without losing existing work versions or images and rejects new selection', async () => {
  const taskId = refs[2].taskId;
  const view = await api(`/teacher/assessment-bank/tasks/${taskId}`);
  const deletePath = `/teacher/assessment-bank/tasks/${taskId}`;
  const body = { expectedVersion: view.data.version, expectedLifecycleRevision: view.data.lifecycleRevision };
  expect((await api(deletePath, 'DELETE', body, '')).status).toBe(401);
  expect((await api(deletePath, 'DELETE', body, studentCookie)).status).toBe(403);
  expect((await api(deletePath, 'DELETE', body, other)).status).toBe(404);
  expect((await api(deletePath, 'DELETE', body, cookie, 'https://foreign.example')).status).toBe(403);
  expect((await api(deletePath, 'DELETE', {})).status).toBe(400);
  expect((await api(deletePath, 'DELETE', { ...body, unexpected: true })).status).toBe(400);
  expect((await api(deletePath, 'DELETE', { ...body, expectedVersion: view.data.version + 1 })).status).toBe(409);
  const workId = randomUUID();
  await api(root, 'POST', { id: workId, title: 'Сохранность удаления', gradeBand: 'grade_10_11' });
  const update = { title: 'Сохранность удаления', instructions: '', gradeBand: 'grade_10_11', items: [refs[2]], expectedRevision: 1, requestId: randomUUID() };
  expect((await api(`${root}/${workId}`, 'PATCH', update)).status).toBe(200);
  const frozen = await api(`${root}/${workId}/versions`, 'POST', { expectedRevision: 2 });
  const pilot = await readFile(resolve(__dirname, '../../../../output/assessment-package-pilot-v1.zip'));
  const stale = await api('/teacher/assessment-bank/imports/preview', 'POST', pilot);
  expect((await api(deletePath, 'DELETE', body)).status).toBe(200);
  expect((await api(deletePath, 'DELETE', body)).status).toBe(200);
  expect((await api('/teacher/assessment-bank')).data.tasks.some((task: { id: string }) => task.id === taskId)).toBe(false);
  expect((await api(deletePath)).status).toBe(404);
  expect((await api(`${deletePath}?version=${view.data.version}`)).status).toBe(200);
  expect((await api(`${root}/${workId}`)).data.items[0].id).toBe(taskId);
  expect((await api(`${root}/${workId}/versions/1`)).data).toEqual(frozen.data);
  expect(Object.values(view.data.images).length).toBeGreaterThan(0);
  for (const image of Object.values(view.data.images)) {
    const response = await fetch(`http://localhost:3000${image}`, { headers: { cookie, origin } });
    expect(response.status).toBe(200);
  }
  const exported = await fetch('http://localhost:3000/teacher/assessment-bank/export', { headers: { cookie, origin } });
  expect(exported.status).toBe(200);
  const exportPreview = await api('/teacher/assessment-bank/imports/preview', 'POST', Buffer.from(await exported.arrayBuffer()));
  expect(exportPreview.data.items.some((task: { stableId: string }) => task.stableId === view.data.task.id)).toBe(false);
  expect((await api(`${root}/${workId}`, 'PATCH', { ...update, expectedRevision: 2, requestId: randomUUID(), title: 'Переименовано' })).status).toBe(200);
  const newId = randomUUID();
  await api(root, 'POST', { id: newId, title: 'Новый выбор', gradeBand: 'grade_10_11' });
  expect((await api(`${root}/${newId}`, 'PATCH', { ...update, requestId: randomUUID() })).status).toBe(400);
  expect((await api(`/teacher/assessment-bank/imports/${stale.data.id}/confirm`, 'POST')).status).toBe(409);
  const restored = await api('/teacher/assessment-bank/imports/preview', 'POST', pilot);
  expect(restored.data.items.find((task: { stableId: string }) => task.stableId === view.data.task.id).status).toBe('new');
  const imported = await api(`/teacher/assessment-bank/imports/${restored.data.id}/confirm`, 'POST');
  expect(imported.data).toMatchObject({ added: 1, updated: 0, unchanged: 5 });
  expect((await api(deletePath)).data.version).toBe(view.data.version);
  expect(await db.assessmentTaskVersion.count({ where: { taskId } })).toBe(1);
}, 30000);

it('saves ordered pinned tasks once, rejects races, duplicate tasks and foreign writes', async () => {
  const body = { title: 'МКТ и электродинамика', instructions: 'Выполните задания.', gradeBand: 'grade_10_11', items: [refs[2], refs[0]], expectedRevision: 1, requestId: randomUUID() };
  const result = await api(`${root}/${id}`, 'PATCH', body);
  expect(result.status).toBe(200);
  expect(result.data.items.map((item: { id: string }) => item.id)).toEqual([refs[2].taskId, refs[0].taskId]);
  expect(result.data).toMatchObject({ revision: 2, taskCount: 2, maxPoints: 2 });
  expect((await api(`${root}/${id}`, 'PATCH', body)).data.revision).toBe(2);
  expect((await api(`${root}/${id}`, 'PATCH', { ...body, requestId: randomUUID() })).status).toBe(409);
  expect((await api(`${root}/${id}`, 'PATCH', { ...body, items: [refs[0], refs[0]], expectedRevision: 2 })).status).toBe(400);
  expect((await api(`${root}/${id}`, 'PATCH', { ...body, expectedRevision: 2 }, other)).status).toBe(404);
  expect((await api(`${root}/${id}`, 'PATCH', { ...body, expectedRevision: 2 }, studentCookie)).status).toBe(403);
  expect((await api(`${root}/${id}`, 'PATCH', { ...body, expectedRevision: 2 }, cookie, 'https://foreign.example')).status).toBe(403);
  const foreignWork = randomUUID();
  await api(root, 'POST', { id: foreignWork, title: 'Чужая', gradeBand: 'grade_10_11' }, other);
  expect((await api(`${root}/${foreignWork}`, 'PATCH', { ...body, expectedRevision: 1, requestId: randomUUID() }, other)).status).toBe(400);
  const competing = [1, 2].map(() => api(`${root}/${id}`, 'PATCH', { ...body, expectedRevision: 2, requestId: randomUUID() }));
  expect((await Promise.all(competing)).map((r) => r.status).sort()).toEqual([200, 409]);
});

it('freezes immutable versions idempotently and keeps image/content after bank changes', async () => {
  const frozen = await api(`${root}/${id}/versions`, 'POST', { expectedRevision: 3 });
  expect(frozen.status).toBe(201);
  expect(frozen.data).toMatchObject({ number: 1, revision: 3, maxPoints: 2 });
  expect((await api(`${root}/${id}/versions`, 'POST', { expectedRevision: 3 })).data.id).toBe(frozen.data.id);
  expect((await api(`${root}/${id}/versions`, 'POST', { expectedRevision: 3 }, studentCookie)).status).toBe(403);
  const source = await db.assessmentTaskVersion.findFirstOrThrow({ where: { taskId: refs[0].taskId, version: 1 } });
  const data = StoredAssessmentTaskSchema.parse(source.data);
  const newer = await db.assessmentTaskVersion.create({ data: { taskId: source.taskId, version: 2, contentHash: 'new-version', data: { ...data, task: { ...data.task, title: 'Новое условие' } }, title: 'Новое условие', gradeBand: source.gradeBand, type: source.type, topicPath: source.topicPath, searchText: 'Новое условие' } });
  await db.assessmentBankTask.update({ where: { id: source.taskId }, data: { latestVersionId: newer.id } });
  expect((await api(`${root}/${id}`)).data.items[1].task.title).toBe(data.task.title);
  expect((await api(`${root}/${id}/versions/1`)).data).toEqual(frozen.data);
  const imageUrls = frozen.data.items.flatMap((item: { images: Record<string, string> }) => Object.values(item.images)) as string[];
  expect(imageUrls.length).toBeGreaterThan(0);
  for (const url of imageUrls) {
    const image = await fetch(`http://localhost:3000${url}`, { headers: { cookie, origin } });
    expect(image.status).toBe(200);
    expect((await image.arrayBuffer()).byteLength).toBeGreaterThan(0);
    expect((await fetch(`http://localhost:3000${url}`, { headers: { cookie: studentCookie, origin } })).status).toBe(403);
  }
  const revised = await api(`${root}/${id}`, 'PATCH', { title: 'Новая редакция', instructions: '', gradeBand: 'grade_10_11', items: [refs[0]], expectedRevision: 3, requestId: randomUUID() });
  expect(revised.status).toBe(200);
  expect((await api(`${root}/${id}/versions`, 'POST', { expectedRevision: 4 })).data.number).toBe(2);
  expect((await api(`${root}/${id}/versions/1`)).data).toEqual(frozen.data);
  expect((await api(`${root}/${id}/versions/1`, 'GET', undefined, other)).status).toBe(404);
});

it('copies pinned saved content into an independent draft, never copies assignments and safely replays', async () => {
  const sourceId = randomUUID(), destination = randomUUID();
  const title = 'Я'.repeat(200);
  await api(root, 'POST', { id: sourceId, title, gradeBand: 'grade_9' });
  const update = { title, instructions: 'Решите по порядку.\nОтвет обоснуйте.', gradeBand: 'grade_9', items: [refs[2], refs[0]], expectedRevision: 1, requestId: randomUUID() };
  const source = (await api(`${root}/${sourceId}`, 'PATCH', update)).data;
  const frozen = (await api(`${root}/${sourceId}/versions`, 'POST', { expectedRevision: 2 })).data;
  const assignment = await db.assessmentAssignment.create({ data: { versionId: frozen.id, classTitle: 'Проверка копии', academicYear: 2026 } });
  const recipient = await db.assessmentRecipient.create({ data: { versionId: frozen.id, assignmentId: assignment.id, studentId, studentName: 'Тест Ученик', studentLogin: 'test-copy', startedAt: new Date(), completedAt: new Date(), points: 1, correctCount: 1, incorrectCount: 1 } });
  const original = await db.assessmentWork.findUniqueOrThrow({ where: { id: sourceId } });
  const path = `${root}/${sourceId}/copy`, input = { id: destination, expectedRevision: 2 };
  expect((await api(path, 'POST', input, '')).status).toBe(401);
  expect((await api(path, 'POST', input, studentCookie)).status).toBe(403);
  expect((await api(path, 'POST', input, other)).status).toBe(404);
  expect((await api(path, 'POST', input, cookie, 'https://foreign.example')).status).toBe(403);
  for (const body of [{ ...input, items: [] }, { id: destination }, { ...input, expectedRevision: 0 }, { ...input, id: 'wrong' }]) expect((await api(path, 'POST', body)).status).toBe(400);
  expect((await api(`${root}/${randomUUID()}/copy`, 'POST', input)).status).toBe(404);
  expect((await api(path, 'POST', { ...input, expectedRevision: 1 })).status).toBe(409);
  expect(await db.assessmentWork.count({ where: { id: destination } })).toBe(0);
  expect((await api(path, 'POST', { ...input, id: sourceId })).status).toBe(409);
  const responses = await Promise.all([api(path, 'POST', input), api(path, 'POST', input)]);
  expect(responses.map((response) => response.status)).toEqual([201, 201]);
  const copied = responses[0].data;
  expect(responses[1].data).toEqual(copied);
  expect(copied).toMatchObject({ id: destination, title: `${title.slice(0, 192)} — копия`, gradeBand: 'grade_9', instructions: source.instructions, revision: 1, taskCount: source.taskCount, maxPoints: source.maxPoints, copySkippedTaskCount: 0, items: source.items });
  expect(copied.title).toHaveLength(200);
  expect(copied.items[1].version).toBe(1); // The bank already has v2; copying must retain v1.
  for (const image of Object.values(copied.items[0].images)) expect((await fetch(`http://localhost:3000${image}`, { headers: { cookie, origin } })).status).toBe(200);
  expect(await db.assessmentWork.findUnique({ where: { id: sourceId } })).toEqual(original);
  expect(await db.assessmentRecipient.findUnique({ where: { id: recipient.id } })).toEqual(recipient);
  expect(await db.assessmentWorkVersion.count({ where: { workId: destination } })).toBe(0);
  expect(await db.assessmentAssignment.count({ where: { version: { workId: destination } } })).toBe(0);
  expect(await db.assessmentRecipient.count({ where: { version: { workId: destination } } })).toBe(0);
  await api(`${root}/${destination}`, 'PATCH', { ...update, title: 'Изменённая копия', items: [refs[0]], requestId: randomUUID() });
  expect((await api(`${root}/${sourceId}`)).data).toEqual(source);
  await api(`${root}/${sourceId}`, 'PATCH', { ...update, title: 'Изменённый оригинал', expectedRevision: 2, requestId: randomUUID() });
  const replay = await api(path, 'POST', input);
  expect(replay.data).toMatchObject({ id: destination, title: 'Изменённая копия', revision: 2, taskCount: 1 });
  expect((await api(path, 'POST', { ...input, expectedRevision: 3 })).status).toBe(409);
  expect((await api(`${root}/${id}/copy`, 'POST', { ...input, expectedRevision: 4 })).status).toBe(409);
});

it('omits deleted tasks, reports the skipped count, permits an empty copy and does not recalculate on replay', async () => {
  const sourceId = randomUUID();
  await api(root, 'POST', { id: sourceId, title: 'Состав копии', gradeBand: 'grade_10_11' });
  const source = (await api(`${root}/${sourceId}`, 'PATCH', { title: 'Состав копии', instructions: '', gradeBand: 'grade_10_11', items: [refs[2], refs[0]], expectedRevision: 1, requestId: randomUUID() })).data;
  const task = (await api(`/teacher/assessment-bank/tasks/${refs[2].taskId}`)).data;
  expect((await api(`/teacher/assessment-bank/tasks/${refs[2].taskId}`, 'DELETE', { expectedVersion: task.version, expectedLifecycleRevision: task.lifecycleRevision })).status).toBe(200);
  const input = { id: randomUUID(), expectedRevision: 2 };
  const partial = await api(`${root}/${sourceId}/copy`, 'POST', input);
  expect(partial.status).toBe(201);
  expect(partial.data).toMatchObject({ taskCount: 1, maxPoints: source.items[1].task.maxPoints, items: [source.items[1]], copySkippedTaskCount: 1 });
  expect((await api(`${root}/${sourceId}`)).data).toEqual(source);
  const otherTask = (await api(`/teacher/assessment-bank/tasks/${refs[0].taskId}`)).data;
  await api(`/teacher/assessment-bank/tasks/${refs[0].taskId}`, 'DELETE', { expectedVersion: otherTask.version, expectedLifecycleRevision: otherTask.lifecycleRevision });
  expect((await api(`${root}/${sourceId}/copy`, 'POST', input)).data).toEqual(partial.data);
  const empty = await api(`${root}/${sourceId}/copy`, 'POST', { ...input, id: randomUUID() });
  expect(empty.status).toBe(201);
  expect(empty.data).toMatchObject({ revision: 1, taskCount: 0, maxPoints: 0, items: [], copySkippedTaskCount: 2 });
  const blank = randomUUID();
  await api(root, 'POST', { id: blank, title: 'Пустая', gradeBand: 'grade_7' });
  expect((await api(`${root}/${blank}/copy`, 'POST', { id: randomUUID(), expectedRevision: 1 })).data).toMatchObject({ title: 'Пустая — копия', gradeBand: 'grade_7', items: [], copySkippedTaskCount: 0 });
  const emojiId = randomUUID(), title = 'Я'.repeat(191) + '🚀' + 'Я'.repeat(7);
  expect((await api(root, 'POST', { id: emojiId, title, gradeBand: 'grade_7' })).status).toBe(201);
  const unicodeCopy = await api(`${root}/${emojiId}/copy`, 'POST', { id: randomUUID(), expectedRevision: 1 });
  expect(unicodeCopy.status).toBe(201);
  expect(unicodeCopy.data.title).toBe('Я'.repeat(191) + ' — копия');
});

it('archives and restores without changing content revisions and rejects delayed opposite transitions', async () => {
  const workId = randomUUID(), path = `${root}/${workId}`;
  await api(root, 'POST', { id: workId, title: 'Архивирование', gradeBand: 'grade_7' });
  const source = (await api(path)).data;
  const archive = { isArchived: true, expectedLifecycleRevision: 1 };
  expect((await api(`${path}/archive`, 'PATCH', archive, '')).status).toBe(401);
  expect((await api(`${path}/archive`, 'PATCH', archive, studentCookie)).status).toBe(403);
  expect((await api(`${path}/archive`, 'PATCH', archive, other)).status).toBe(404);
  expect((await api(`${path}/archive`, 'PATCH', archive, cookie, 'https://foreign.example')).status).toBe(403);
  for (const input of [{ ...archive, extra: 1 }, { isArchived: true }, { ...archive, expectedLifecycleRevision: 0 }]) expect((await api(`${path}/archive`, 'PATCH', input)).status).toBe(400);
  const results = await Promise.all([api(`${path}/archive`, 'PATCH', archive), api(`${path}/archive`, 'PATCH', archive)]);
  expect(results.map((result) => result.status)).toEqual([200, 200]);
  const archived = (await api(path)).data;
  expect(archived).toEqual({ ...source, isArchived: true, lifecycleRevision: 2, updatedAt: expect.any(String) });
  expect((await api(root)).data.find((work: { id: string }) => work.id === workId)).toMatchObject({ isArchived: true, canDelete: true });
  const copy = await api(`${path}/copy`, 'POST', { id: randomUUID(), expectedRevision: 1 });
  expect(copy.data).toMatchObject({ isArchived: false, lifecycleRevision: 1, revision: 1 });
  expect((await api(`${path}/archive`, 'PATCH', { isArchived: false, expectedLifecycleRevision: 1 })).status).toBe(409);
  const restore = { isArchived: false, expectedLifecycleRevision: 2 };
  expect((await api(`${path}/archive`, 'PATCH', restore)).status).toBe(200);
  expect((await api(`${path}/archive`, 'PATCH', restore)).status).toBe(200);
  expect((await api(`${path}/archive`, 'PATCH', archive)).status).toBe(409);
  expect((await api(path)).data).toEqual({ ...source, lifecycleRevision: 3, updatedAt: expect.any(String) });
});

it('deletes unused frozen drafts without deleting bank content or copies and never resurrects tombstones', async () => {
  const workId = randomUUID(), path = `${root}/${workId}`, ref = refs[1];
  const create = { id: workId, title: 'Удаляемая заготовка', gradeBand: 'grade_10_11' };
  await api(root, 'POST', create);
  const update = { title: create.title, gradeBand: create.gradeBand, instructions: '', items: [ref], expectedRevision: 1, requestId: randomUUID() };
  await api(path, 'PATCH', update);
  const frozen = await api(`${path}/versions`, 'POST', { expectedRevision: 2 });
  const copyInput = { id: randomUUID(), expectedRevision: 2 };
  const copy = (await api(`${path}/copy`, 'POST', copyInput)).data;
  const input = { expectedRevision: 2, expectedLifecycleRevision: 1 };
  expect((await api(path, 'DELETE', input, '')).status).toBe(401);
  expect((await api(path, 'DELETE', input, studentCookie)).status).toBe(403);
  expect((await api(path, 'DELETE', input, other)).status).toBe(404);
  expect((await api(path, 'DELETE', input, cookie, 'https://foreign.example')).status).toBe(403);
  expect((await api(path, 'DELETE', { ...input, cascade: true })).status).toBe(400);
  expect((await api(path, 'DELETE', { ...input, expectedRevision: 1 })).status).toBe(409);
  expect((await api(path, 'DELETE', { ...input, expectedLifecycleRevision: 2 })).status).toBe(409);
  expect((await api(root)).data.find((work: { id: string }) => work.id === workId).canDelete).toBe(true);
  expect((await api(path, 'DELETE', input)).status).toBe(200);
  expect((await api(path, 'DELETE', input)).status).toBe(200);
  expect((await api(root)).data.some((work: { id: string }) => work.id === workId)).toBe(false);
  expect((await api(path)).status).toBe(404);
  expect((await api(`${path}/versions/1`)).status).toBe(404);
  expect((await api(path, 'PATCH', { ...update, expectedRevision: 2, requestId: randomUUID() })).status).toBe(404);
  expect((await api(`${path}/versions`, 'POST', { expectedRevision: 2 })).status).toBe(404);
  expect((await api(`${path}/archive`, 'PATCH', { isArchived: false, expectedLifecycleRevision: 2 })).status).toBe(404);
  expect((await api(`${path}/copy`, 'POST', copyInput)).status).toBe(404);
  expect((await api('/teacher/assessment-assignments/works/' + workId + '/prepare')).status).toBe(404);
  expect((await api(root, 'POST', create)).status).toBe(404);
  expect((await db.assessmentWork.findUniqueOrThrow({ where: { id: workId } })).deletedAt).not.toBeNull();
  expect((await db.assessmentWorkVersion.findUniqueOrThrow({ where: { id: frozen.data.id } })).workId).toBe(workId);
  expect((await api(`${root}/${copy.id}`)).data).toEqual(copy);
  expect((await api(`/teacher/assessment-bank/tasks/${ref.taskId}?version=${ref.version}`)).status).toBe(200);
  const next = (await api(`${root}/${copy.id}/copy`, 'POST', { id: randomUUID(), expectedRevision: 1 })).data;
  expect((await api(`${root}/${next.id}`, 'DELETE', { expectedRevision: 1, expectedLifecycleRevision: 1 })).status).toBe(200);
  expect((await api(`${root}/${copy.id}/copy`, 'POST', { id: next.id, expectedRevision: 1 })).status).toBe(410);
  expect((await api(root, 'POST', { ...create, id: next.id })).status).toBe(404);
});
