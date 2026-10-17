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
