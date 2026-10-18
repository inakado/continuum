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
const origin = 'http://localhost:3001';
const teachers: string[] = [], students: string[] = [];
let teacher = '', otherTeacher = '', student = '', otherStudent = '', classId = '';
let extendedId = '', autoId = '', image: Buffer;
async function login(username: string) {
  const response = await createBetterAuth(db).api.signInUsername({ body: { username, password: 'Local-photo-123' }, asResponse: true, headers: new Headers({ origin }) });
  return response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
}
async function api(path: string, method = 'GET', body?: object | Buffer, cookie = teacher, contentType = 'application/json', requestOrigin = origin) {
  const response = await fetch(`http://localhost:3000${path}`, { method, headers: { cookie, origin: requestOrigin, 'Content-Type': contentType }, body: body ? Buffer.isBuffer(body) ? body : JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json() };
}
beforeAll(async () => {
  await db.$connect();
  for (let i = 0; i < 2; i++) {
    const username = `photo-t-${randomUUID()}`;
    const result = await identities.createTeacher({ login: username, password: 'Local-photo-123', firstName: 'Тест', lastName: 'Фото', middleName: null });
    teachers.push(result.user.id);
    if (i) otherTeacher = await login(username); else teacher = await login(username);
  }
  classId = (await db.schoolClass.create({ data: { teacherId: teachers[0], title: '11 Фото', grade: 11, academicYear: 2026 } })).id;
  for (let i = 0; i < 2; i++) {
    const username = `photo-s-${randomUUID()}`;
    const result = await identities.createStudent({ login: username, password: 'Local-photo-123', leadTeacherId: teachers[i], firstName: 'Тест', lastName: 'Фото' });
    students.push(result.user.id);
    if (i) otherStudent = await login(username);
    else { student = await login(username); await db.studentProfile.update({ where: { userId: result.user.id }, data: { classId } }); }
  }
  for (const name of ['extended', 'pilot']) {
    const bytes = await readFile(resolve(__dirname, `../../../../output/assessment-package-${name}-v1.zip`));
    const preview = await api('/teacher/assessment-bank/imports/preview', 'POST', bytes, teacher, 'application/zip');
    expect(preview.data.issues).toEqual([]);
    const imported = await api(`/teacher/assessment-bank/imports/${preview.data.id}/confirm`, 'POST');
    expect(imported.status).toBe(201);
    if (name === 'extended') extendedId = imported.data.taskIds[0]; else autoId = imported.data.taskIds[0];
  }
  image = await readFile(resolve(__dirname, '../../../../examples/assessment-package/extended-v1/tasks/shkolkovo-14449/images/process.png'));
}, 30000);
afterAll(async () => {
  const scope = { version: { work: { teacherId: { in: teachers } } } };
  const photos = await db.assessmentSolutionPhoto.findMany({ where: { answer: { recipient: scope } } });
  await Promise.all(photos.map((photo) => storage.deleteObject(photo.objectKey)));
  await db.assessmentRecipient.deleteMany({ where: scope });
  await db.assessmentAssignment.deleteMany({ where: scope });
  await db.assessmentAssignmentRequest.deleteMany({ where: { work: { teacherId: { in: teachers } } } });
  await db.assessmentWorkVersion.deleteMany({ where: { work: { teacherId: { in: teachers } } } });
  await db.assessmentWork.deleteMany({ where: { teacherId: { in: teachers } } });
  const imports = await db.assessmentBankImport.findMany({ where: { teacherId: { in: teachers } } });
  const versions = await db.assessmentTaskVersion.findMany({ where: { task: { teacherId: { in: teachers } } } });
  const keys = new Set([...imports.flatMap((row) => StoredAssessmentImportSchema.parse(row.data)), ...versions.map((row) => StoredAssessmentTaskSchema.parse(row.data))].flatMap((entry) => entry.images.map((entry) => entry.key)));
  await Promise.all([...keys].map((key) => storage.deleteObject(key)));
  await db.assessmentBankImport.deleteMany({ where: { teacherId: { in: teachers } } });
  await db.assessmentBankTask.deleteMany({ where: { teacherId: { in: teachers } } });
  await db.studentProfile.deleteMany({ where: { leadTeacherId: { in: teachers } } });
  await db.schoolClass.deleteMany({ where: { teacherId: { in: teachers } } });
  await db.user.deleteMany({ where: { id: { in: [...teachers, ...students] } } });
  await db.$disconnect();
}, 30000);
async function assigned(mixed: boolean) {
  const id = randomUUID();
  await api('/teacher/assessment-works', 'POST', { id, title: 'Фото решений', gradeBand: 'grade_10_11' });
  await api(`/teacher/assessment-works/${id}`, 'PATCH', { title: 'Фото решений', gradeBand: 'grade_10_11', instructions: '', items: (mixed ? [autoId, extendedId] : [extendedId]).map((taskId) => ({ taskId, version: 1 })), expectedRevision: 1, requestId: randomUUID() });
  const prepared = (await api(`/teacher/assessment-assignments/works/${id}/prepare`)).data;
  const assigned = await api(`/teacher/assessment-assignments/works/${id}`, 'POST', { requestId: randomUUID(), selection: prepared.selection, classes: prepared.classes.filter((item: { id: string }) => item.id === classId).map((item: { id: string; rosterHash: string }) => ({ id: item.id, rosterHash: item.rosterHash })) });
  const report = (await api(`/teacher/assessment-assignments/${assigned.data.versionId}`)).data;
  const recipient = report.recipients[0].id;
  await api(`/student/assessment-works/${recipient}/start`, 'POST', undefined, student);
  return { id: recipient, versionId: assigned.data.versionId, root: `/assessment-solutions/${recipient}`, path: `/assessment-solutions/${recipient}/items/${extendedId}/photos` };
}
it('imports an extended task, receives several photos, isolates access and keeps photo uploads independent of finished test answers', async () => {
  const work = await assigned(true);
  const photoId = randomUUID();
  const upload = `${work.path}/${photoId}?revision=0`;
  expect((await api(upload, 'PUT', image, teacher, 'image/png')).status).toBe(403);
  expect((await api(upload, 'PUT', image, otherStudent, 'image/png')).status).toBe(404);
  expect((await api(upload, 'PUT', image, student, 'image/png', 'https://foreign.example')).status).toBe(403);
  const first = await api(upload, 'PUT', image, student, 'image/png');
  expect(first.status).toBe(200);
  expect(first.data[0]).toMatchObject({ taskId: extendedId, revision: 1, maxPoints: 2, photos: [{ id: photoId }] });
  expect((await api(upload, 'PUT', image, student, 'image/png')).data[0].revision).toBe(1);
  expect((await api(work.root, 'GET', undefined, otherTeacher)).status).toBe(404);
  expect((await api(work.root, 'GET', undefined, otherStudent)).status).toBe(404);
  expect((await api(work.root)).data).toEqual(first.data);
  const exported = await fetch('http://localhost:3000/teacher/assessment-bank/export?type=extended', { headers: { cookie: teacher, origin } });
  expect(exported.status).toBe(200);
  const roundtrip = await api('/teacher/assessment-bank/imports/preview', 'POST', Buffer.from(await exported.arrayBuffer()), teacher, 'application/zip');
  expect(roundtrip.data.issues).toEqual([]);
  expect(roundtrip.data.items).toEqual([expect.objectContaining({ stableId: 'shkolkovo-14449', status: 'unchanged' })]);
  const photoUrl = `http://localhost:3000${first.data[0].photos[0].url}`;
  const picture = await fetch(photoUrl, { headers: { cookie: teacher, origin } });
  expect(picture.status).toBe(200);
  expect(Buffer.from(await picture.arrayBuffer())).toEqual(image);
  expect((await fetch(photoUrl, { headers: { cookie: otherStudent, origin } })).status).toBe(404);
  expect((await fetch(photoUrl, { headers: { origin } })).status).toBe(401);
  const finish = await api(`/student/assessment-works/${work.id}/finish`, 'POST', { expectedRevision: 1 }, student);
  expect(finish.data.result).toEqual({ correctCount: 0, incorrectCount: 1 });
  const report = await api(`/teacher/assessment-assignments/${work.versionId}`);
  expect(report.data.recipients[0]).toMatchObject({ photoTaskCount: 1, result: { maxPoints: 1 } });
  const secondId = randomUUID();
  expect((await api(`${work.path}/${secondId}?revision=1`, 'PUT', image, student, 'image/png')).data[0].photos).toHaveLength(2);
  expect((await api(`/student/assessment-works/${work.id}`, 'GET', undefined, student)).data).toMatchObject({ status: 'completed', automaticTaskCount: 1, extendedTaskCount: 1 });
  const replacement = randomUUID();
  const replaced = await api(`${work.path}/${replacement}?revision=2&replaceId=${photoId}`, 'PUT', image, student, 'image/png');
  expect(replaced.data[0]).toMatchObject({ revision: 3 });
  expect(replaced.data[0].photos.map((photo: { id: string }) => photo.id)).toEqual([secondId, replacement]);
  expect((await fetch(photoUrl, { headers: { cookie: student, origin } })).status).toBe(404);
  expect((await api(`${work.path}/${secondId}?revision=1`, 'DELETE', undefined, student)).status).toBe(409);
  expect((await api(`${work.path}/${secondId}?revision=3`, 'DELETE', undefined, student)).data[0].revision).toBe(4);
  expect((await api(`${work.path}/${secondId}?revision=3`, 'DELETE', undefined, student)).data[0].revision).toBe(4);
}, 30000);
it('supports photo-only works, rejects invalid content and seals individual photo revisions atomically', async () => {
  const work = await assigned(false);
  expect((await api(`/student/assessment-works/${work.id}/finish`, 'POST', { expectedRevision: 1 }, student)).status).toBe(400);
  expect((await api(`${work.path}/${randomUUID()}?revision=0`, 'PUT', Buffer.from('<svg/>'), student, 'image/png')).status).toBe(400);
  const concurrent = await Promise.all([0, 1].map(() => api(`${work.path}/${randomUUID()}?revision=0`, 'PUT', image, student, 'image/png')));
  expect(concurrent.map((row) => row.status).sort()).toEqual([200, 409]);
  expect((await api(work.root, 'GET', undefined, student)).data[0].photos).toHaveLength(1);
  const answer = await db.assessmentSolutionAnswer.findUniqueOrThrow({ where: { recipientId_taskId: { recipientId: work.id, taskId: extendedId } } });
  await db.assessmentSolutionAnswer.update({ where: { id: answer.id }, data: { lockedAt: new Date() } });
  expect((await api(`${work.path}/${randomUUID()}?revision=1`, 'PUT', image, student, 'image/png')).status).toBe(409);
  const stored = (await api(work.root, 'GET', undefined, student)).data[0];
  expect(stored.locked).toBe(true);
  expect((await api(`${work.path}/${stored.photos[0].id}?revision=1`, 'DELETE', undefined, student)).status).toBe(409);
}, 30000);

it('limits received pages and allows atomic replacement at the limit without losing the old set on invalid upload', async () => {
  const work = await assigned(false);
  const ids = Array.from({ length: 10 }, () => randomUUID());
  for (const [revision, id] of ids.entries()) expect((await api(`${work.path}/${id}?revision=${revision}`, 'PUT', image, student, 'image/png')).status).toBe(200);
  expect((await api(`${work.path}/${randomUUID()}?revision=10`, 'PUT', image, student, 'image/png')).status).toBe(400);
  expect((await api(`${work.path}/${randomUUID()}?revision=10&replaceId=${ids[0]}`, 'PUT', Buffer.from('broken image'), student, 'image/png')).status).toBe(400);
  expect((await api(work.root, 'GET', undefined, student)).data[0].photos.map((photo: { id: string }) => photo.id)).toEqual(ids);
  const replaced = await api(`${work.path}/${randomUUID()}?revision=10&replaceId=${ids[0]}`, 'PUT', image, student, 'image/png');
  expect(replaced.data[0]).toMatchObject({ revision: 11 });
  expect(replaced.data[0].photos).toHaveLength(10);
  expect(replaced.data[0].photos.some((photo: { id: string }) => photo.id === ids[0])).toBe(false);
}, 30000);
