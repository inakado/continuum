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
const root = '/teacher/assessment-assignments';
const studentRoot = '/student/assessment-works';
const teachers: string[] = [], students: { id: string; cookie: string }[] = [], classes: string[] = [];
let cookie = '', other = '';
let refs: { taskId: string; version: number }[] = [];
async function login(username: string) {
  const response = await createBetterAuth(db).api.signInUsername({ body: { username, password: 'Local-assign-123' }, asResponse: true, headers: new Headers({ origin }) });
  return response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
}
async function student(teacherId: string, classId?: string) {
  const username = `assign-s-${randomUUID()}`;
  const result = await identities.createStudent({ login: username, password: 'Local-assign-123', leadTeacherId: teacherId, firstName: 'Иван', lastName: 'Проверка' });
  if (classId) await db.studentProfile.update({ where: { userId: result.user.id }, data: { classId } });
  const record = { id: result.user.id, cookie: await login(username) };
  students.push(record);
  return record;
}
async function api(path: string, method = 'GET', body?: object | Buffer, session = cookie, requestOrigin = origin) {
  const response = await fetch(`http://localhost:3000${path}`, { method, headers: { cookie: session, origin: requestOrigin, ...(body ? { 'Content-Type': Buffer.isBuffer(body) ? 'application/zip' : 'application/json' } : {}) }, body: body ? Buffer.isBuffer(body) ? body : JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json() };
}
async function work() {
  const id = randomUUID();
  await api('/teacher/assessment-works', 'POST', { id, title: 'Назначение', gradeBand: 'grade_10_11' });
  await api(`/teacher/assessment-works/${id}`, 'PATCH', { title: 'Назначение', gradeBand: 'grade_10_11', instructions: 'Выполните задания.', items: refs, expectedRevision: 1, requestId: randomUUID() });
  return id;
}
beforeAll(async () => {
  await db.$connect();
  for (let i = 0; i < 2; i++) {
    const username = `assign-t-${randomUUID()}`;
    const result = await identities.createTeacher({ login: username, password: 'Local-assign-123', firstName: 'Тест', lastName: 'Назначения', middleName: null });
    teachers.push(result.user.id);
    if (i) other = await login(username); else cookie = await login(username);
  }
  for (const title of ['11А', '11Б']) classes.push((await db.schoolClass.create({ data: { teacherId: teachers[0], title, grade: 11, academicYear: 2026 } })).id);
  await student(teachers[0], classes[0]); await student(teachers[0], classes[1]); await student(teachers[1]);
  const bytes = await readFile(resolve(__dirname, '../../../../output/assessment-package-pilot-v1.zip'));
  const preview = await api('/teacher/assessment-bank/imports/preview', 'POST', bytes);
  const imported = await api(`/teacher/assessment-bank/imports/${preview.data.id}/confirm`, 'POST');
  refs = imported.data.taskIds.map((taskId: string) => ({ taskId, version: 1 }));
}, 30000);
afterAll(async () => {
  const scope = { version: { work: { teacherId: { in: teachers } } } };
  await db.assessmentRecipient.deleteMany({ where: scope });
  await db.assessmentAssignment.deleteMany({ where: scope });
  await db.assessmentAssignmentRequest.deleteMany({ where: { work: { teacherId: { in: teachers } } } });
  await db.assessmentWorkVersion.deleteMany({ where: { work: { teacherId: { in: teachers } } } });
  await db.assessmentWork.deleteMany({ where: { teacherId: { in: teachers } } });
  const imports = await db.assessmentBankImport.findMany({ where: { teacherId: { in: teachers } } });
  const versions = await db.assessmentTaskVersion.findMany({ where: { task: { teacherId: { in: teachers } } } });
  const keys = new Set([...imports.flatMap((row) => StoredAssessmentImportSchema.parse(row.data)), ...versions.map((row) => StoredAssessmentTaskSchema.parse(row.data))].flatMap((entry) => entry.images.map((image) => image.key)));
  await Promise.all([...keys].map((key) => storage.deleteObject(key)));
  await db.assessmentBankImport.deleteMany({ where: { teacherId: { in: teachers } } });
  await db.assessmentBankTask.deleteMany({ where: { teacherId: { in: teachers } } });
  await db.studentProfile.deleteMany({ where: { leadTeacherId: { in: teachers } } });
  await db.schoolClass.deleteMany({ where: { teacherId: { in: teachers } } });
  await db.user.deleteMany({ where: { id: { in: [...teachers, ...students.map((item) => item.id)] } } });
  await db.$disconnect();
}, 30000);

it('assigns an immutable draft to two rosters once, validates ownership and isolates student content', async () => {
  const id = await work();
  const prepared = await api(`${root}/works/${id}/prepare`);
  expect(prepared.status).toBe(200);
  const input = { requestId: randomUUID(), selection: prepared.data.selection, classes: prepared.data.classes.map((item: { id: string; rosterHash: string }) => ({ id: item.id, rosterHash: item.rosterHash })) };
  expect((await api(`${root}/works/${id}`, 'POST', input, students[0].cookie)).status).toBe(403);
  expect((await api(`${root}/works/${id}`, 'POST', input, other)).status).toBe(404);
  expect((await api(`${root}/works/${id}`, 'POST', input, cookie, 'https://foreign.example')).status).toBe(403);
  const assigned = await api(`${root}/works/${id}`, 'POST', input);
  expect(assigned.status).toBe(201);
  expect(assigned.data.addedCount).toBe(2);
  expect((await api(`${root}/works/${id}`, 'POST', input)).data).toEqual(assigned.data);
  expect((await api(`${root}/${assigned.data.versionId}`, 'GET', undefined, other)).status).toBe(404);
  const report = await api(`${root}/${assigned.data.versionId}`);
  expect(report.data.recipients.map((item: { status: string }) => item.status)).toEqual(['not_started', 'not_started']);
  expect(report.data.recipients.every((item: { result: object | null }) => item.result === null)).toBe(true);
  const own = report.data.recipients.find((item: { login: string }) => item.login === prepared.data.classes[0].students[0].login);
  const detail = await api(`${studentRoot}/${own.id}`, 'GET', undefined, students[0].cookie);
  expect(detail.status).toBe(200);
  for (const item of detail.data.items) {
    expect(item).not.toHaveProperty('grading'); expect(item).not.toHaveProperty('source'); expect(item).not.toHaveProperty('solution'); expect(item).not.toHaveProperty('task');
  }
  expect((await api(`${studentRoot}/${own.id}`, 'GET', undefined, students[2].cookie)).status).toBe(404);
  const imageItem = detail.data.items.find((item: { images: object }) => Object.keys(item.images).length > 0);
  const imageUrl = Object.values(imageItem.images)[0];
  expect((await fetch(`http://localhost:3000${imageUrl}`, { headers: { cookie: students[0].cookie, origin } })).status).toBe(200);
  expect((await fetch(`http://localhost:3000${imageUrl}`, { headers: { cookie: students[2].cookie, origin } })).status).toBe(404);
});

it('resumes saved answers, checks revisions and seals results against concurrent saves and repeat finish', async () => {
  const id = await work();
  const prepared = (await api(`${root}/works/${id}/prepare`)).data;
  const assigned = (await api(`${root}/works/${id}`, 'POST', { requestId: randomUUID(), selection: prepared.selection, classes: [{ id: classes[0], rosterHash: prepared.classes.find((item: { id: string }) => item.id === classes[0]).rosterHash }] })).data;
  const recipient = (await api(`${root}/${assigned.versionId}`)).data.recipients[0];
  const path = `${studentRoot}/${recipient.id}`;
  expect((await api(`${path}/start`, 'POST', undefined, students[0].cookie)).data.status).toBe('in_progress');
  const body = { requestId: randomUUID(), expectedRevision: 1, answer: { type: 'short_number', value: '123,5' } };
  const target = refs[0].taskId;
  const saved = await api(`${path}/answers/${target}`, 'PATCH', body, students[0].cookie);
  expect(saved.data).toMatchObject({ revision: 2, answeredCount: 1, result: null });
  expect((await api(`${path}/answers/${target}`, 'PATCH', body, students[0].cookie)).data.revision).toBe(2);
  expect((await api(path, 'GET', undefined, students[0].cookie)).data.answers[target]).toEqual(body.answer);
  expect((await api(`${path}/answers/${target}`, 'PATCH', { ...body, requestId: randomUUID() }, students[0].cookie)).status).toBe(409);
  const requests = await Promise.all([
    api(`${path}/finish`, 'POST', { expectedRevision: 2 }, students[0].cookie),
    api(`${path}/answers/${target}`, 'PATCH', { ...body, requestId: randomUUID(), expectedRevision: 2 }, students[0].cookie),
  ]);
  expect(requests.map((item) => item.status).sort()).toEqual([200, 409]);
  const current = (await api(path, 'GET', undefined, students[0].cookie)).data;
  const finished = await api(`${path}/finish`, 'POST', { expectedRevision: current.revision }, students[0].cookie);
  expect(finished.data.status).toBe('completed');
  expect(finished.data.result).toEqual({ correctCount: 0, incorrectCount: refs.length });
  expect((await api(`${path}/finish`, 'POST', { expectedRevision: current.revision }, students[0].cookie)).data).toEqual(finished.data);
  expect((await api(`${path}/answers/${target}`, 'PATCH', { ...body, expectedRevision: finished.data.revision, requestId: randomUUID() }, students[0].cookie)).status).toBe(409);
  expect((await api(`${root}/${assigned.versionId}`)).data.recipients[0].result.points).toBe(0);
});

it('rejects a stale draft even when frozen, assigns the chosen old version and does not include newcomers on replay', async () => {
  const id = await work();
  const update = { title: 'Один ответ', gradeBand: 'grade_10_11', instructions: '', items: [refs[0]], expectedRevision: 2, requestId: randomUUID() };
  expect((await api(`/teacher/assessment-works/${id}`, 'PATCH', update)).status).toBe(200);
  const frozen = (await api(`/teacher/assessment-works/${id}/versions`, 'POST', { expectedRevision: 3 })).data;
  const classId = (await db.schoolClass.create({ data: { teacherId: teachers[0], title: '10В', grade: 10, academicYear: 2026 } })).id;
  classes.push(classId);
  const learner = await student(teachers[0], classId);
  const inactive = await student(teachers[0], classId);
  await db.user.update({ where: { id: inactive.id }, data: { isActive: false } });
  const stale = (await api(`${root}/works/${id}/prepare`)).data;
  const selected = stale.classes.find((item: { id: string }) => item.id === classId);
  const input = { requestId: randomUUID(), selection: stale.selection, classes: [{ id: classId, rosterHash: selected.rosterHash }] };
  expect((await api(`/teacher/assessment-works/${id}`, 'PATCH', { ...update, title: 'Новая редакция', expectedRevision: 3, requestId: randomUUID() })).status).toBe(200);
  expect((await api(`${root}/works/${id}`, 'POST', input)).status).toBe(409);
  const old = (await api(`${root}/works/${id}/prepare?version=${frozen.number}`)).data;
  const exact = { ...input, requestId: randomUUID(), selection: old.selection };
  const assigned = await api(`${root}/works/${id}`, 'POST', exact);
  expect(assigned.data.addedCount).toBe(1);
  await student(teachers[0], classId);
  expect((await api(`${root}/works/${id}`, 'POST', exact)).data).toEqual(assigned.data);
  const reportPath = `${root}/${assigned.data.versionId}`;
  const report = (await api(reportPath)).data;
  expect(report).toMatchObject({ title: 'Один ответ', studentCount: 1, taskCount: 1 });
  const path = `${studentRoot}/${report.recipients[0].id}`;
  await api(`${path}/start`, 'POST', undefined, learner.cookie);
  const invalid = await api(`${path}/answers/${refs[0].taskId}`, 'PATCH', { requestId: randomUUID(), expectedRevision: 1, answer: { type: 'short_text', value: '4.83' } }, learner.cookie);
  expect(invalid.status).toBe(400);
  const saved = await api(`${path}/answers/${refs[0].taskId}`, 'PATCH', { requestId: randomUUID(), expectedRevision: 1, answer: { type: 'short_number', value: '4,83' } }, learner.cookie);
  expect(saved.data).toMatchObject({ revision: 2, answeredCount: 1, status: 'in_progress', result: null });
  expect((await api(reportPath)).data.recipients[0]).toMatchObject({ status: 'in_progress', answeredCount: 1, result: null });
  expect((await api(studentRoot, 'GET', undefined, learner.cookie)).data).toEqual([expect.objectContaining({ title: 'Один ответ', taskCount: 1, result: null })]);
  expect((await api(`${path}/finish`, 'POST', { expectedRevision: 2 }, learner.cookie)).data.result).toEqual({ correctCount: 1, incorrectCount: 0 });
  expect((await api(reportPath)).data.recipients[0].result).toMatchObject({ points: 1, maxPoints: 1, percentage: 100 });
  expect((await api(root)).data.find((item: { versionId: string }) => item.versionId === assigned.data.versionId)).toMatchObject({ studentCount: 1, completedCount: 1 });
  expect((await api(`/teacher/students/${learner.id}`, 'DELETE')).status).toBe(200);
  expect((await api(reportPath)).data.recipients[0]).toMatchObject({ deleted: true, status: 'completed', result: { points: 1, maxPoints: 1, percentage: 100 } });
  expect((await api(`/teacher/classes/${classId}`, 'DELETE', { deleteStudents: false })).status).toBe(200);
  expect((await api(reportPath)).data.classes[0]).toMatchObject({ classId: null, title: '10В' });
});

it('keeps recipients fixed, detects roster changes and preserves history through transfer and account/class deletion', async () => {
  const id = await work();
  const first = (await api(`${root}/works/${id}/prepare`)).data;
  const classA = first.classes.find((item: { id: string }) => item.id === classes[0]);
  const input = { requestId: randomUUID(), selection: first.selection, classes: [{ id: classA.id, rosterHash: classA.rosterHash }] };
  const newcomer = await student(teachers[0], classes[0]);
  expect((await api(`${root}/works/${id}`, 'POST', input)).status).toBe(409);
  const refreshed = (await api(`${root}/works/${id}/prepare`)).data;
  const assigned = (await api(`${root}/works/${id}`, 'POST', { ...input, requestId: randomUUID(), classes: [{ id: classA.id, rosterHash: refreshed.classes.find((item: { id: string }) => item.id === classes[0]).rosterHash }] })).data;
  expect(assigned.addedCount).toBe(2);
  const late = await student(teachers[0], classes[0]);
  expect((await api(`${root}/${assigned.versionId}`)).data.studentCount).toBe(2);
  await db.studentProfile.update({ where: { userId: newcomer.id }, data: { classId: classes[1] } });
  const next = (await api(`${root}/works/${id}/prepare?version=${assigned.versionNumber}`)).data;
  const selected = next.classes.find((item: { id: string }) => item.id === classes[0]);
  const added = await api(`${root}/works/${id}`, 'POST', { requestId: randomUUID(), selection: next.selection, classes: [{ id: selected.id, rosterHash: selected.rosterHash }] });
  expect(added.data.addedCount).toBe(1);
  const report = (await api(`${root}/${assigned.versionId}`)).data;
  expect(report.recipients.find((item: { login: string }) => item.login === next.classes.find((item: { id: string }) => item.id === classes[1]).students.find((item: { id: string }) => item.id === newcomer.id).login).assignmentId).toBe(report.classes[0].id);
  expect(report.studentCount).toBe(3);
  expect((await api(`/teacher/students/${late.id}`, 'DELETE')).status).toBe(200);
  expect((await api(`${root}/${assigned.versionId}`)).data.recipients.some((item: { deleted: boolean }) => item.deleted)).toBe(true);
  expect((await api(`/teacher/classes/${classes[0]}`, 'DELETE', { deleteStudents: false })).status).toBe(200);
  expect((await api(`${root}/${assigned.versionId}`)).data.classes[0]).toMatchObject({ classId: null, title: '11А' });
});
