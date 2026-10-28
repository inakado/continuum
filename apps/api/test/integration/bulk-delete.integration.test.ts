import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { IdentityProvisioningService } from '../../src/auth/identity-provisioning.service';
import { createBetterAuth } from '../../src/auth/better-auth.factory';
const db = new PrismaService(), identities = new IdentityProvisioningService(db);
const origin = 'http://localhost:3001', password = 'Bulk-test-local-123';
let teacherId = '', classId = '', cookie = '', studentCookie = '';
const students: string[] = [], tasks: string[] = [];
async function login(username: string) {
  const response = await createBetterAuth(db).api.signInUsername({ body: { username, password }, asResponse: true, headers: new Headers({ origin }) });
  expect(response.status).toBe(200);
  return response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
}
async function api(path: string, body?: object, session = cookie, method = body ? 'POST' : 'GET', requestOrigin = origin) {
  const response = await fetch(`http://localhost:3000${path}`, { method, headers: { origin: requestOrigin, cookie: session, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json() };
}
beforeAll(async () => {
  await db.$connect();
  const loginName = `bulk-${randomUUID()}`;
  const teacher = await identities.createTeacher({ login: loginName, password, firstName: 'Тест', lastName: 'Массовое удаление', middleName: null });
  teacherId = teacher.user.id; cookie = await login(loginName);
  const schoolClass = await db.schoolClass.create({ data: { teacherId, title: loginName, grade: 8, academicYear: 2026 } }); classId = schoolClass.id;
  for (let n = 0; n < 2; n++) {
    const student = await identities.createStudent({ login: `bulk-student-${randomUUID()}`, password, leadTeacherId: teacherId, firstName: 'Тест', lastName: String(n), middleName: null, classId });
    students.push(student.user.id);
    await db.accessGrant.create({ data: { studentId: student.user.id, grantedById: teacherId, gradeBand: 'grade_8' } });
    if (n === 0) studentCookie = await login(student.user.login);
    else await db.user.update({ where: { id: student.user.id }, data: { isActive: false } });
    const task = await db.assessmentBankTask.create({ data: { teacherId, stableId: `bulk-${n}` } }); tasks.push(task.id);
    const data = { task: { id: `bulk-${n}`, title: `Тест ${n}`, gradeBand: 'grade_8', type: 'short_number', topicPath: ['Тест'], maxPoints: 1, source: { provider: 'Авторское' }, grading: { answer: '1', absoluteTolerance: 0 } }, statement: 'Тест', solution: null, hash: `bulk-${n}`, images: [] };
    const version = await db.assessmentTaskVersion.create({ data: { taskId: task.id, version: 1, contentHash: `bulk-${n}`, data, title: `Тест ${n}`, gradeBand: 'grade_8', type: 'short_number', topicPath: ['Тест'], searchText: 'Тест' } });
    await db.assessmentBankTask.update({ where: { id: task.id }, data: { latestVersionId: version.id } });
  }
}, 30000);
afterAll(async () => {
  await db.assessmentBankTask.deleteMany({ where: { id: { in: tasks } } });
  await db.user.deleteMany({ where: { id: { in: students } } });
  if (classId) await db.schoolClass.deleteMany({ where: { id: classId } });
  if (teacherId) await db.user.deleteMany({ where: { id: teacherId } });
  await db.$disconnect();
});
it('atomically deletes and restores a bank batch, validates ownership/duplicates and rejects stale undo', async () => {
  const root = '/teacher/assessment-bank/tasks';
  const items = tasks.map(id => ({ id, expectedVersion: 1, expectedLifecycleRevision: 1 }));
  expect((await api(`${root}/bulk-delete`, { items: [items[0], items[0]] })).status).toBe(400);
  expect((await api(`${root}/bulk-delete`, { items }, '', 'POST')).status).toBe(401);
  expect((await api(`${root}/bulk-delete`, { items }, cookie, 'POST', 'https://foreign.example')).status).toBe(403);
  expect((await api(`${root}/bulk-delete`, { items: [items[0], { ...items[1], id: randomUUID() }] })).status).toBe(404);
  expect(await db.assessmentBankTask.count({ where: { id: { in: tasks }, deletedAt: null } })).toBe(2);
  const result = await api(`${root}/bulk-delete`, { items }); expect(result.status).toBe(201);
  expect(result.data.items).toHaveLength(2);
  expect((await api(`${root}/bulk-delete`, { items })).data).toEqual(result.data);
  expect((await api('/teacher/assessment-bank')).data.total).toBe(0);
  const undo = { items: result.data.items.map((item: { id: string; version: number; deletionRevision: number }) => ({ id: item.id, expectedVersion: item.version, expectedDeletionRevision: item.deletionRevision })) };
  expect((await api(`${root}/bulk-restore`, { items: [undo.items[0], { ...undo.items[1], expectedDeletionRevision: 9 }] })).status).toBe(409);
  expect(await db.assessmentBankTask.count({ where: { id: { in: tasks }, deletedAt: { not: null } } })).toBe(2);
  expect((await api(`${root}/bulk-restore`, undo)).status).toBe(201);
  expect((await api(`${root}/bulk-restore`, undo)).status).toBe(201);
  expect((await api(`${root}/bulk-delete`, { items: items.map(item => ({ ...item, expectedLifecycleRevision: 3 })) })).status).toBe(201);
  expect((await api(`${root}/bulk-restore`, undo)).status).toBe(409);
});
it('preserves identities, passwords, grants and class; revokes sessions; restores prior activity and is atomic/idempotent', async () => {
  const root = '/teacher/students', items = students.map(id => ({ id, expectedRevision: 1 }));
  const accounts = await db.account.findMany({ where: { userId: { in: students } }, select: { userId: true, password: true }, orderBy: { userId: 'asc' } });
  expect((await api(`${root}/bulk-delete`, { items: [items[0], { ...items[1], expectedRevision: 9 }] })).status).toBe(409);
  expect(await db.studentProfile.count({ where: { userId: { in: students }, deletedAt: null } })).toBe(2);
  const result = await api(`${root}/bulk-delete`, { items }); expect(result.status).toBe(201);
  expect((await api(`${root}/bulk-delete`, { items })).data).toEqual(result.data);
  expect((await api('/me', undefined, studentCookie)).status).toBe(401);
  const roster = (await api(root)).data.students;
  expect(roster.some((item: { id: string }) => students.includes(item.id))).toBe(false);
  expect((await api('/teacher/classes')).data.classes.find((item: { id: string }) => item.id === classId).studentCount).toBe(0);
  expect((await api(`${root}/${students[0]}/active`, { isActive: true }, cookie, 'PATCH')).status).toBe(403);
  expect(await db.user.count({ where: { id: { in: students } } })).toBe(2);
  expect(await db.accessGrant.count({ where: { studentId: { in: students } } })).toBe(2);
  expect(await db.account.findMany({ where: { userId: { in: students } }, select: { userId: true, password: true }, orderBy: { userId: 'asc' } })).toEqual(accounts);
  expect((await api(`${root}/bulk-restore`, { items: [result.data.items[0], { ...result.data.items[1], deletionRevision: 9 }] })).status).toBe(409);
  expect(await db.studentProfile.count({ where: { userId: { in: students }, deletedAt: { not: null } } })).toBe(2);
  expect((await api(`${root}/bulk-restore`, result.data)).status).toBe(201);
  expect((await api(`${root}/bulk-restore`, result.data)).status).toBe(201);
  expect((await db.user.findUniqueOrThrow({ where: { id: students[0] } })).isActive).toBe(true);
  expect((await db.user.findUniqueOrThrow({ where: { id: students[1] } })).isActive).toBe(false);
  expect(await db.studentProfile.count({ where: { userId: { in: students }, classId, deletedAt: null } })).toBe(2);
  expect((await api('/teacher/classes')).data.classes.find((item: { id: string }) => item.id === classId).studentCount).toBe(2);
  expect((await api(`${root}/bulk-delete`, { items: items.map(item => ({ ...item, expectedRevision: 3 })) })).status).toBe(201);
  expect((await api(`${root}/bulk-restore`, result.data)).status).toBe(409);
});
