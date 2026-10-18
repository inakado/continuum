import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { IdentityProvisioningService } from '../../src/auth/identity-provisioning.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { createBetterAuth } from '../../src/auth/better-auth.factory';

// Runs against the local API and PostgreSQL, never production.
const base = 'http://localhost:3000';
const origin = 'http://localhost:3001';
const prisma = new PrismaService();
const identities = new IdentityProvisioningService(prisma);
const teacherIds: string[] = [];
const runLabel = randomUUID().slice(0, 8);
const title = (value: string) => `${value} · ${runLabel}`;
let cookie = '';
let otherCookie = '';
const names = [{ lastName: 'Иванов', firstName: 'Иван', middleName: 'Иванович' }, { lastName: 'Иванов', firstName: 'Иван', middleName: 'Иванович' }];
const api = async (path: string, method = 'GET', body?: object, session = cookie) => {
  const response = await fetch(`${base}${path}`, { method, headers: { origin, cookie: session, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: await response.json(), cache: response.headers.get('cache-control') };
};
async function login(username: string, password: string) {
  // Isolated auth handler avoids consuming the running dev user's IP login quota.
  const auth = createBetterAuth(prisma);
  const response = await auth.api.signInUsername({ body: { username, password }, asResponse: true, headers: new Headers({ origin }) });
  expect(response.status).toBe(200);
  return response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
}

describe('school classes: real PostgreSQL, HTTP and Better Auth', () => {
  beforeAll(async () => {
    await prisma.$connect();
    for (let i = 0; i < 2; i++) {
      const loginName = `classes-test-${randomUUID()}`;
      const created = await identities.createTeacher({ login: loginName, password: 'Local-test-pass-123', firstName: 'Тест', lastName: 'Классы', middleName: null });
      teacherIds.push(created.user.id);
      const session = await login(loginName, 'Local-test-pass-123');
      if (i === 0) cookie = session; else otherCookie = session;
    }
  });
  afterAll(async () => {
    const students = await prisma.studentProfile.findMany({ where: { leadTeacherId: { in: teacherIds } }, select: { userId: true } });
    await prisma.studentPasswordReset.deleteMany({ where: { teacherId: { in: teacherIds } } });
    await prisma.accessGrant.deleteMany({ where: { grantedById: { in: teacherIds } } });
    await prisma.studentProfile.deleteMany({ where: { leadTeacherId: { in: teacherIds } } });
    await prisma.studentProvisioningBatch.deleteMany({ where: { teacherId: { in: teacherIds } } });
    await prisma.schoolClass.deleteMany({ where: { teacherId: { in: teacherIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [...teacherIds, ...students.map((item) => item.userId)] } } });
    await prisma.$disconnect();
  });

  it('creates namesakes, logs in with generated credentials, and safely replays a lost response', async () => {
    const body = { requestId: randomUUID(), newClass: { title: title('8А'), grade: 8, academicYear: 2026 }, students: names };
    const created = await api('/teacher/classes/students', 'POST', body);
    expect(created.status).toBe(201); expect(created.cache).toBe('no-store');
    expect(created.data.credentials).toHaveLength(2);
    const [first, second] = created.data.credentials;
    expect(first.login).toMatch(/^ivanov\d*$/);
    expect(second.login).toMatch(/^ivanov\d*$/);
    expect(first.login).not.toBe(second.login); expect(first.password).not.toBe(second.password);
    const studentCookie = await login(first.login, first.password);
    expect((await api('/teacher/classes', 'GET', undefined, studentCookie)).status).toBe(403);
    expect((await api('/teacher/classes', 'GET', undefined, '')).status).toBe(401);
    const replay = await api('/teacher/classes/students', 'POST', body);
    expect(replay.data).toMatchObject({ classId: created.data.classId, replayed: true, credentials: null });
    expect(replay.data.studentIds.sort()).toEqual(created.data.studentIds.sort());
    expect((await api('/teacher/classes/students', 'POST', { ...body, students: [names[0]] })).status).toBe(409);
    const stored = await prisma.account.findUniqueOrThrow({ where: { providerId_accountId: { providerId: 'credential', accountId: first.id } } });
    expect(stored.password?.startsWith('$argon2')).toBe(true);
    expect(await identities.verifyPassword(first.id, first.password)).toBe(true);

    const target = await api('/teacher/classes', 'POST', { title: title('8Б'), grade: 8, academicYear: 2026 });
    await prisma.accessGrant.create({ data: { studentId: first.id, gradeBand: 'grade_7', grantedById: teacherIds[0] } });
    expect((await api(`/teacher/students/${first.id}/class`, 'PATCH', { classId: target.data.id })).status).toBe(200);
    expect(await prisma.accessGrant.count({ where: { studentId: first.id } })).toBe(2);
    expect((await api('/teacher/classes/students', 'POST', body)).data.studentIds.sort()).toEqual(created.data.studentIds.sort());

    const resetId = randomUUID();
    const reset = await api(`/teacher/students/${first.id}/password-reset`, 'POST', { requestId: resetId });
    expect(reset.status).toBe(201); expect(reset.cache).toBe('no-store');
    expect((await api('/me', 'GET', undefined, studentCookie)).status).toBe(401);
    expect(await identities.verifyPassword(first.id, first.password)).toBe(false);
    expect(await identities.verifyPassword(first.id, reset.data.credential.password)).toBe(true);
    await login(first.login, reset.data.credential.password);
    expect((await api(`/teacher/students/${first.id}/password-reset`, 'POST', { requestId: resetId })).data).toEqual({ credential: null, replayed: true });
    expect((await api('/teacher/classes', 'GET', undefined, otherCookie)).data.classes).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.data.classId })]));
    expect((await api('/teacher/students', 'GET', undefined, otherCookie)).data.students).toEqual(expect.arrayContaining([expect.objectContaining({ id: first.id })]));
    expect((await api(`/teacher/students/${first.id}/class`, 'PATCH', { classId: created.data.classId }, otherCookie)).status).toBe(200);
    expect((await api(`/teacher/students/${first.id}/password-reset`, 'POST', { requestId: randomUUID() }, otherCookie)).status).toBe(201);
    expect((await api('/teacher/classes/students', 'POST', { requestId: randomUUID(), classId: created.data.classId, students: names }, otherCookie)).status).toBe(201);
    expect((await api(`/teacher/classes/${created.data.classId}`, 'PATCH', { title: title('Общий 8А') }, otherCookie)).status).toBe(200);
    expect((await api(`/teacher/students/${first.id}/active`, 'PATCH', { isActive: false }, otherCookie)).status).toBe(200);
    expect((await api(`/teacher/students/${first.id}/active`, 'PATCH', { isActive: true }, otherCookie)).status).toBe(200);
    expect(JSON.stringify((await api('/teacher/students')).data)).not.toContain(reset.data.credential.password);
    await api(`/teacher/classes/${target.data.id}`, 'PATCH', { isArchived: true });
    expect((await api('/teacher/classes/students', 'POST', { requestId: randomUUID(), classId: target.data.id, students: names })).status).toBe(409);
    expect((await api(`/teacher/classes/${target.data.id}`, 'PATCH', { isArchived: false, title: title('8В') })).status).toBe(200);
  }, 30000);

  it('creates only one batch under concurrent requests and rejects invalid payloads before writing', async () => {
    const body = { requestId: randomUUID(), newClass: { title: title('9А'), grade: 9, academicYear: 2026 }, students: names };
    const results = await Promise.all([api('/teacher/classes/students', 'POST', body), api('/teacher/classes/students', 'POST', body)]);
    expect(results.map((item) => item.status)).toEqual([201, 201]);
    expect(results.filter((item) => item.data.credentials !== null)).toHaveLength(1);
    expect(await prisma.studentProfile.count({ where: { provisioningBatchId: body.requestId } })).toBe(2);
    expect((await api('/teacher/classes/students', 'POST', { ...body, requestId: randomUUID(), students: [{ firstName: '', lastName: 'Петров' }] })).status).toBe(400);
    expect((await api('/teacher/classes/students', 'POST', { ...body, requestId: randomUUID(), classId: randomUUID() })).status).toBe(400);
    expect((await api('/teacher/classes/students', 'POST', { ...body, requestId: randomUUID() })).status).toBe(409);
    expect(await prisma.schoolClass.count({ where: { teacherId: teacherIds[0], title: title('9А') } })).toBe(1);
    expect((await api('/teacher/classes', 'POST', body.newClass, otherCookie)).status).toBe(409);
  }, 30000);

  it('opens the grade library by default and can remove a pupil or delete a class', async () => {
    const body = { requestId: randomUUID(), newClass: { title: title('11А'), grade: 11, academicYear: 2026 }, students: names };
    const created = await api('/teacher/classes/students', 'POST', body);
    const [first, second] = created.data.credentials;
    expect(await prisma.accessGrant.count({ where: { studentId: { in: [first.id, second.id] }, gradeBand: 'grade_10_11' } })).toBe(2);
    expect((await api(`/teacher/students/${first.id}/class`, 'PATCH', { classId: null })).status).toBe(200);
    expect(await prisma.user.count({ where: { id: first.id } })).toBe(1);
    expect(await prisma.accessGrant.count({ where: { studentId: first.id } })).toBe(1);
    expect((await api(`/teacher/classes/${created.data.classId}`, 'DELETE', { deleteStudents: false }, otherCookie)).status).toBe(200);
    expect((await prisma.studentProfile.findUniqueOrThrow({ where: { userId: second.id } })).classId).toBeNull();
    expect((await api('/teacher/classes/students', 'POST', body)).status).toBe(410);
    const classAgain = await api('/teacher/classes/students', 'POST', { ...body, requestId: randomUUID() });
    const removedStudent = classAgain.data.credentials[0];
    const studentSession = await login(removedStudent.login, removedStudent.password);
    await api(`/teacher/students/${removedStudent.id}/password-reset`, 'POST', { requestId: randomUUID() });
    expect((await api(`/teacher/students/${removedStudent.id}`, 'DELETE', undefined, otherCookie)).status).toBe(200);
    expect((await api('/me', 'GET', undefined, studentSession)).status).toBe(401);
    expect(await prisma.user.count({ where: { id: removedStudent.id } })).toBe(0);
    expect(await prisma.account.count({ where: { userId: removedStudent.id } })).toBe(0);
    const deleted = await api(`/teacher/classes/${classAgain.data.classId}`, 'DELETE', { deleteStudents: true }, otherCookie);
    expect(deleted.status).toBe(200); expect(deleted.data.deletedStudentsCount).toBe(1);
  }, 30000);

  it('allocates surname logins safely for concurrent different batches', async () => {
    const results = await Promise.all(['10А', '10Б'].map((value) => api('/teacher/classes/students', 'POST', {
      requestId: randomUUID(), newClass: { title: title(value), grade: 10, academicYear: 2026 }, students: names,
    })));
    expect(results.map((item) => item.status)).toEqual([201, 201]);
    const logins = results.flatMap((item) => item.data.credentials.map((entry: { login: string }) => entry.login));
    expect(new Set(logins).size).toBe(4);
  }, 30000);
});
