import 'reflect-metadata';
import { randomBytes, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { IdentityProvisioningService } from '../../src/auth/identity-provisioning.service';
import { createBetterAuth } from '../../src/auth/better-auth.factory';

const db = new PrismaService(), identities = new IdentityProvisioningService(db);
const origin = 'http://localhost:3001', password = 'Auth-security-test-123!';
const users: string[] = [];
let teacherId = '', studentId = '', teacherLogin = '', teacherEmail = '', teacher = '', student = '', admin = '';
const clientIp = () => `2001:db8:${randomBytes(2).toString('hex')}:${randomBytes(2).toString('hex')}::1`;
function api(path: string, method = 'GET', body?: object, cookie = '', requestOrigin = origin, ip = clientIp()) {
  return fetch(`http://localhost:3000${path}`, { method, headers: { origin: requestOrigin, cookie, 'content-type': 'application/json', 'x-real-ip': ip }, body: body === undefined ? undefined : JSON.stringify(body) });
}
async function session(login: string) {
  const response = await createBetterAuth(db).api.signInUsername({ body: { username: login, password }, headers: new Headers({ origin }), asResponse: true });
  return response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
}
beforeAll(async () => {
  await db.$connect();
  for (const role of ['teacher', 'student', 'admin'] as const) {
    const login = `auth-${role}-${randomUUID()}`;
    const created = role === 'student'
      ? await identities.createStudent({ login, password, leadTeacherId: teacherId, firstName: 'Тест', lastName: 'Авторизация' })
      : await identities.createTeacher({ login, password, firstName: 'Тест', lastName: 'Авторизация', middleName: null });
    users.push(created.user.id);
    if (role === 'teacher') { teacherId = created.user.id; teacherLogin = login; teacher = await session(login); teacherEmail = (await db.user.findUniqueOrThrow({ where: { id: teacherId } })).email; }
    else if (role === 'student') { studentId = created.user.id; student = await session(login); }
    else { await db.user.update({ where: { id: created.user.id }, data: { role: 'admin' } }); admin = await session(login); }
  }
}, 30000);
afterAll(async () => {
  await db.apikey.deleteMany({ where: { referenceId: { in: users } } });
  await db.studentProfile.deleteMany({ where: { userId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
});

it('authenticates over HTTP and keeps teacher, student, admin and anonymous boundaries', async () => {
  const login = await api('/auth/sign-in/username', 'POST', { username: teacherLogin, password });
  expect(login.status).toBe(200);
  const cookie = login.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
  expect(await (await api('/me', 'GET', undefined, cookie)).json()).toMatchObject({ user: { id: teacherId, role: 'teacher' } });
  expect((await api('/teacher/students', 'GET', undefined, student)).status).toBe(403);
  expect((await api('/student/assessment-works', 'GET', undefined, teacher)).status).toBe(403);
  expect(await (await api('/me', 'GET', undefined, admin)).json()).toMatchObject({ user: { role: 'admin' } });
  expect((await api('/teacher/students', 'GET', undefined, admin)).status).toBe(403);
  expect((await api('/me')).status).toBe(401);
  expect((await api('/me', 'GET', undefined, `${cookie}tampered`)).status).toBe(401);
});

it('keeps public signup, email login, self role changes and API-key management closed', async () => {
  const attempts = [
    ['/auth/sign-up/email', { email: teacherEmail, password, name: 'Escalation', role: 'admin' }],
    ['/auth/sign-in/email', { email: teacherEmail, password }],
    ['/auth/update-user', { role: 'admin', isActive: true, username: teacherLogin }],
    ['/auth/api-key/create', { name: 'Forbidden key', userId: teacherId }],
  ] as const;
  for (const [path, body] of attempts) expect((await api(path, 'POST', body, student)).status).toBe(404);
  expect((await api('/auth/api-key/list', 'GET', undefined, teacher)).status).toBe(404);
  expect((await db.user.findUniqueOrThrow({ where: { id: studentId } })).role).toBe('student');
});

it('rejects foreign origins and preserves the session until a legitimate logout', async () => {
  const cookie = await session(teacherLogin);
  expect((await api('/auth/sign-in/username', 'POST', { username: teacherLogin, password }, '', 'https://outside.invalid')).status).toBe(403);
  expect((await api('/auth/sign-out', 'POST', {}, cookie, 'https://outside.invalid')).status).toBe(403);
  expect((await api('/me', 'GET', undefined, cookie)).status).toBe(200);
  expect((await api('/auth/sign-out', 'POST', {}, cookie)).status).toBe(200);
  expect((await api('/me', 'GET', undefined, cookie)).status).toBe(401);
});

it('does not turn a valid API key into a teacher session through either header', async () => {
  const auth = createBetterAuth(db);
  const key = await auth.api.createApiKey({ body: { userId: teacherId, name: 'Session isolation', prefix: 'ctm_', expiresIn: 86400 } });
  expect((await auth.api.verifyApiKey({ body: { key: key.key } })).valid).toBe(true);
  for (const headers of [{ 'x-api-key': key.key }, { authorization: `Bearer ${key.key}` }]) {
    expect((await fetch('http://localhost:3000/me', { headers })).status).toBe(401);
    expect((await fetch('http://localhost:3000/teacher/students', { headers })).status).toBe(401);
  }
});

it('enforces the real five-attempt login limit without disabling password checks', async () => {
  const ip = clientIp(), username = `missing-${randomUUID()}`;
  for (let n = 0; n < 5; n++) expect((await api('/auth/sign-in/username', 'POST', { username, password }, '', origin, ip)).status).toBe(401);
  const blocked = await api('/auth/sign-in/username', 'POST', { username, password }, '', origin, ip);
  expect(blocked.status).toBe(429);
  expect(Number(blocked.headers.get('x-retry-after'))).toBeGreaterThan(0);
  expect(blocked.headers.get('content-type')).toContain('application/json');
});
