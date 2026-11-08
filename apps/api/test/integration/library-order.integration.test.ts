import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TeacherLibrarySchema } from '@continuum/shared';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { IdentityProvisioningService } from '../../src/auth/identity-provisioning.service';
import { createBetterAuth } from '../../src/auth/better-auth.factory';

// Launched by scripts/test-library-order.mjs against its own migrated database.
let app: INestApplication, db: PrismaService;
const teachers: string[] = [], students: string[] = [], sections: string[] = [], lessons: string[] = [];
let first = '', second = '', student = '', foreign = '';
const origin = 'http://localhost:3001';
const root = '/teacher/library';
function http(path: string, method: 'get' | 'put' | 'post' | 'delete' = 'get', body?: object, cookie = first, site = origin) {
  const call = request(app.getHttpServer())[method](path).set('Cookie', cookie).set('Origin', site);
  return body === undefined ? call : call.send(body);
}
async function sectionIds() {
  const catalog = TeacherLibrarySchema.parse((await http(root)).body);
  return catalog.gradeBands.find((band) => band.code === 'grade_9')!.sections.map((row) => row.id);
}
async function lessonIds() {
  return (await db.lesson.findMany({ where: { sectionId: sections[0] }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] })).map((row) => row.id);
}
async function login(username: string, password: string) {
  const response = await createBetterAuth(db).api.signInUsername({ body: { username, password }, asResponse: true, headers: new Headers({ origin }) });
  expect(response.status).toBe(200);
  return response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
}

describe.skipIf(!process.env.LIBRARY_ORDER_TEST_DB)('library ordering: real HTTP authorization and PostgreSQL serialization', () => {
  beforeAll(async () => {
    expect(new URL(process.env.DATABASE_URL!).pathname).toBe('/' + process.env.LIBRARY_ORDER_TEST_DB);
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ bodyParser: false });
    await app.init(); db = module.get(PrismaService);
    expect(await db.section.count(), 'Use a dedicated empty test database').toBe(0);
    const identities = new IdentityProvisioningService(db), password = 'Order-only-test-12345';
    for (let i = 0; i < 2; i++) {
      const username = `order-teacher-${randomUUID()}`;
      const result = await identities.createTeacher({ login: username, password, firstName: 'Тест', lastName: 'Порядок', middleName: null });
      teachers.push(result.user.id);
      const cookie = await login(username, password);
      if (i === 0) first = cookie; else second = cookie;
    }
    const username = `order-student-${randomUUID()}`;
    const pupil = await identities.createStudent({ login: username, password, leadTeacherId: teachers[0], firstName: 'Тест', lastName: 'Порядок' });
    students.push(pupil.user.id); student = await login(username, password);
    await db.accessGrant.create({ data: { studentId: pupil.user.id, gradeBand: 'grade_9', grantedById: teachers[0] } });
    for (const title of ['Механика', 'Оптика', 'Теплота']) {
      const response = await http(root + '/sections', 'post', { gradeBand: 'grade_9', title });
      expect(response.status).toBe(201); sections.push(response.body.id);
    }
    const outside = await http(root + '/sections', 'post', { gradeBand: 'grade_8', title: 'Другая параллель' });
    foreign = outside.body.id; sections.push(foreign);
    for (const title of ['Первое', 'Черновик', 'Третье']) {
      const response = await http(root + '/lessons', 'post', { sectionId: sections[0], title });
      expect(response.status).toBe(201); lessons.push(response.body.id);
    }
    const other = await http(root + '/lessons', 'post', { sectionId: sections[1], title: 'Чужой раздел' });
    lessons.push(other.body.id);
    await db.section.updateMany({ where: { id: { in: sections.slice(0, 3) } }, data: { status: 'published' } });
    await db.lesson.updateMany({ where: { id: { in: [lessons[0], lessons[2]] } }, data: { status: 'published' } });
  }, 30000);
  afterAll(async () => {
    if (db) {
      await db.lesson.deleteMany({ where: { sectionId: { in: sections } } });
      await db.section.deleteMany({ where: { id: { in: sections } } });
      await db.accessGrant.deleteMany({ where: { studentId: { in: students } } });
      await db.studentProfile.deleteMany({ where: { userId: { in: students } } });
      await db.user.deleteMany({ where: { id: { in: [...students, ...teachers] } } });
    }
    await app?.close();
  });

  it('persists a shared order, supports a retried response and preserves student visibility', async () => {
    const expectedIds = await sectionIds(), orderedIds = [...expectedIds].reverse();
    const body = { gradeBand: 'grade_9', expectedIds, orderedIds };
    expect((await http(root + '/sections/order', 'put', body, second)).status).toBe(200);
    expect((await http(root + '/sections/order', 'put', body)).status).toBe(200);
    expect(await sectionIds()).toEqual(orderedIds);
    const expected = await lessonIds(), ordered = [...expected].reverse();
    expect((await http(`${root}/sections/${sections[0]}/lessons/order`, 'put', { expectedIds: expected, orderedIds: ordered }, second)).status).toBe(200);
    const catalog = TeacherLibrarySchema.parse((await http('/student/library', 'get', undefined, student)).body);
    const visible = catalog.gradeBands.find((band) => band.code === 'grade_9')!.sections;
    expect(visible.map((row) => row.id)).toEqual(orderedIds);
    expect(visible.find((row) => row.id === sections[0])!.lessons.map((row) => row.id)).toEqual([lessons[2], lessons[0]]);
    expect(await db.lesson.count({ where: { id: lessons[1], status: 'draft' } })).toBe(1);
  });

  it('rejects anonymous, student, foreign-origin, duplicates, omissions and foreign scope IDs without writes', async () => {
    const expectedIds = await sectionIds(), orderedIds = [...expectedIds].reverse();
    const body = { gradeBand: 'grade_9', expectedIds, orderedIds };
    expect((await http(root + '/sections/order', 'put', body, '')).status).toBe(401);
    expect((await http(root + '/sections/order', 'put', body, student)).status).toBe(403);
    expect((await http(root + '/sections/order', 'put', body, first, 'https://foreign.test')).status).toBe(403);
    for (const ids of [[expectedIds[0], expectedIds[0], expectedIds[2]], orderedIds.slice(1), [foreign, ...orderedIds.slice(1)]]) {
      expect((await http(root + '/sections/order', 'put', { ...body, orderedIds: ids })).status).toBe(400);
    }
    const outside = [foreign, ...expectedIds.slice(1)];
    expect((await http(root + '/sections/order', 'put', { ...body, expectedIds: outside, orderedIds: [...outside].reverse() })).status).toBe(409);
    const child = await lessonIds(), invalid = [lessons[3], ...child.slice(1)];
    expect((await http(`${root}/sections/${sections[0]}/lessons/order`, 'put', { expectedIds: invalid, orderedIds: [...invalid].reverse() })).status).toBe(409);
    expect((await http(`${root}/sections/${randomUUID()}/lessons/order`, 'put', { expectedIds: child, orderedIds: child })).status).toBe(404);
    expect(await sectionIds()).toEqual(expectedIds);
    expect(await lessonIds()).toEqual(child);
  });

  it('serializes conflicting teachers so only one different permutation wins', async () => {
    const expectedIds = await sectionIds();
    const a = [expectedIds[1], expectedIds[0], expectedIds[2]], b = [expectedIds[0], expectedIds[2], expectedIds[1]];
    const results = await Promise.all([http(root + '/sections/order', 'put', { gradeBand: 'grade_9', expectedIds, orderedIds: a }), http(root + '/sections/order', 'put', { gradeBand: 'grade_9', expectedIds, orderedIds: b }, second)]);
    expect(results.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await sectionIds()).toEqual(results[0].status === 200 ? a : b);
  });

  it('serializes section creation with ordering and appends the new section without losing it', async () => {
    const expectedIds = await sectionIds(), orderedIds = [...expectedIds].reverse();
    const [added, changed] = await Promise.all([http(root + '/sections', 'post', { gradeBand: 'grade_9', title: 'Новый раздел' }), http(root + '/sections/order', 'put', { gradeBand: 'grade_9', expectedIds, orderedIds }, second)]);
    expect(added.status).toBe(201); sections.push(added.body.id);
    expect([200, 409]).toContain(changed.status);
    expect(await sectionIds()).toEqual([...(changed.status === 200 ? orderedIds : expectedIds), added.body.id]);
  });

  it('serializes lesson creation with ordering and keeps the appended lesson', async () => {
    const expectedIds = await lessonIds(), orderedIds = [...expectedIds].reverse();
    const [added, changed] = await Promise.all([http(root + '/lessons', 'post', { sectionId: sections[0], title: 'Новое занятие' }), http(`${root}/sections/${sections[0]}/lessons/order`, 'put', { expectedIds, orderedIds }, second)]);
    expect(added.status).toBe(201); lessons.push(added.body.id);
    expect([200, 409]).toContain(changed.status);
    expect(await lessonIds()).toEqual([...(changed.status === 200 ? orderedIds : expectedIds), added.body.id]);
  });

  it('serializes lesson deletion and ordering without partial reorders or missing-row errors', async () => {
    const expectedIds = await lessonIds(), orderedIds = [...expectedIds].reverse(), removed = expectedIds[1];
    const [deleted, changed] = await Promise.all([http(`${root}/lessons/${removed}`, 'delete', { expectedIds: [] }), http(`${root}/sections/${sections[0]}/lessons/order`, 'put', { expectedIds, orderedIds }, second)]);
    expect(deleted.status).toBe(200); expect([200, 409]).toContain(changed.status);
    expect(await lessonIds()).toEqual((changed.status === 200 ? orderedIds : expectedIds).filter((id) => id !== removed));
  });

  it('serializes section deletion with ordering', async () => {
    const expectedIds = await sectionIds(), orderedIds = [...expectedIds].reverse(), removed = sections.at(-1)!;
    const [deleted, changed] = await Promise.all([http(`${root}/sections/${removed}`, 'delete', { expectedIds: [] }), http(root + '/sections/order', 'put', { gradeBand: 'grade_9', expectedIds, orderedIds }, second)]);
    expect(deleted.status).toBe(200); expect([200, 409]).toContain(changed.status);
    expect(await sectionIds()).toEqual((changed.status === 200 ? orderedIds : expectedIds).filter((id) => id !== removed));
  });
});
