import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { IdentityProvisioningService } from '../../src/auth/identity-provisioning.service';
import { createBetterAuth } from '../../src/auth/better-auth.factory';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ObjectStorageService } from '../../src/infra/storage/object-storage.service';
import { resolveObjectStorageConfig } from '../../src/infra/storage/object-storage.config';
import { LibraryAssetCleanupService } from '../../src/library/library-asset-cleanup.service';
import { LibraryWriteService } from '../../src/library/library-write.service';

const db = new PrismaService();
const storage = new ObjectStorageService(resolveObjectStorageConfig());
const origin = 'http://localhost:3001';
const root = '/teacher/library';
const teachers: string[] = [], students: string[] = [], keys: string[] = [];
let cookie = '', other = '', student = '', section = '', lesson = '';
async function request(path: string, method = 'GET', body?: object, session = cookie, site = origin) {
  const response = await fetch(`http://localhost:3000${path}`, { method, headers: { cookie: session, origin: site, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json() };
}
async function login(username: string, password: string) {
  const response = await createBetterAuth(db).api.signInUsername({ body: { username, password }, asResponse: true, headers: new Headers({ origin }) });
  expect(response.status).toBe(200);
  return response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
}
async function upload(type: 'pdf' | 'tasks_pdf', id = lesson) {
  const bytes = Buffer.from('%PDF-1.4\nfixture deletion test');
  const response = await fetch(`http://localhost:3000${root}/lessons/${id}/artifacts/upload?${new URLSearchParams({ type, filename: 'fixture.pdf', sizeBytes: String(bytes.length) })}`, { method: 'PUT', headers: { cookie, origin, 'Content-Type': 'application/pdf' }, body: bytes });
  const data = await response.json(); expect(response.status).toBe(200);
  const artifact = await db.lessonArtifact.findUniqueOrThrow({ where: { id: data.id }, include: { asset: true } });
  keys.push(artifact.asset.objectKey);
  return data.id as string;
}
describe('library deletion: HTTP + PostgreSQL + S3', () => {
  beforeAll(async () => {
    await db.$connect();
    const identities = new IdentityProvisioningService(db);
    for (let i = 0; i < 2; i++) {
      const username = `delete-test-${randomUUID()}`, password = 'Local-delete-test-123';
      const teacher = await identities.createTeacher({ login: username, password, firstName: 'Тест', lastName: 'Удаление', middleName: null });
      teachers.push(teacher.user.id);
      const session = await login(username, password); if (i === 0) cookie = session; else other = session;
    }
    const created = await request('/teacher/classes/students', 'POST', { requestId: randomUUID(), newClass: { title: `Удаление-${randomUUID().slice(0, 8)}`, grade: 11, academicYear: 2026 }, students: [{ lastName: 'Тест', firstName: 'Удаление', middleName: '' }] });
    expect(created.status, JSON.stringify(created.data)).toBe(201);
    const credentials = created.data.credentials[0];
    const user = await db.user.findUniqueOrThrow({ where: { login: credentials.login } }); students.push(user.id);
    student = await login(credentials.login, credentials.password);
    section = (await request(`${root}/sections`, 'POST', { title: 'Временный раздел', gradeBand: 'grade_10_11' })).data.id;
    lesson = (await request(`${root}/lessons`, 'POST', { sectionId: section, title: 'Временное занятие' })).data.id;
  }, 30000);
  afterAll(async () => {
    const assets = await db.asset.findMany({ where: { uploadedById: { in: teachers } } });
    for (const key of new Set([...keys, ...assets.map((asset) => asset.objectKey)])) await storage.deleteObject(key);
    await db.lesson.deleteMany({ where: { createdById: { in: teachers } } });
    await db.section.deleteMany({ where: { createdById: { in: teachers } } });
    await db.asset.deleteMany({ where: { uploadedById: { in: teachers } } });
    await db.libraryAssetDeletion.deleteMany({ where: { objectKey: { in: keys } } });
    await db.accessGrant.deleteMany({ where: { grantedById: { in: teachers } } });
    await db.studentProfile.deleteMany({ where: { userId: { in: students } } });
    await db.studentProvisioningBatch.deleteMany({ where: { teacherId: { in: teachers } } });
    await db.schoolClass.deleteMany({ where: { teacherId: { in: teachers } } });
    await db.user.deleteMany({ where: { id: { in: [...teachers, ...students] } } });
    await db.$disconnect();
  }, 30000);
  it('проверяет роль, владельца, origin и строгий контракт', async () => {
    const path = `${root}/lessons/${lesson}`, body = { expectedIds: [] };
    expect((await request(path, 'DELETE', body, '')).status).toBe(401);
    expect((await request(path, 'DELETE', body, student)).status).toBe(403);
    expect((await request(path, 'DELETE', body, other)).status).toBe(404);
    expect((await request(path, 'DELETE', body, cookie, 'https://foreign.example')).status).toBe(403);
    expect((await request(path, 'DELETE', {})).status).toBe(400);
    expect((await request(path, 'DELETE', { expectedIds: [randomUUID(), 'broken'] })).status).toBe(400);
    expect((await request(`${path}/artifacts/interactive`, 'DELETE', body)).status).toBe(400);
    expect(await db.lesson.count({ where: { id: lesson } })).toBe(1);
  });
  it('удаляет все версии конспекта, не возвращает старую при публикации и сохраняет задачи', async () => {
    const first = await upload('pdf'), second = await upload('pdf'), tasks = await upload('tasks_pdf');
    await request(`${root}/sections/${section}/publish`, 'PATCH');
    await request(`${root}/lessons/${lesson}/publish`, 'PATCH');
    expect((await request(`/student/library/artifacts/${second}/view`, 'GET', undefined, student)).status).toBe(200);
    const path = `${root}/lessons/${lesson}/artifacts/pdf`;
    expect((await request(path, 'DELETE', { expectedIds: [first] })).status).toBe(409);
    expect((await request(path, 'DELETE', { expectedIds: [first, first] })).status).toBe(400);
    expect((await request(path, 'DELETE', { expectedIds: [first, second] })).status).toBe(200);
    expect(await db.lessonArtifact.count({ where: { lessonId: lesson, type: 'pdf' } })).toBe(0);
    await request(`${root}/lessons/${lesson}/publish`, 'PATCH');
    expect((await request(`/student/library/artifacts/${second}/view`, 'GET', undefined, student)).status).toBe(404);
    expect((await request(`/student/library/artifacts/${tasks}/view`, 'GET', undefined, student)).status).toBe(200);
    await new LibraryAssetCleanupService(db, storage).flush();
    expect((await storage.getObjectMeta(keys[0])).exists).toBe(false);
    expect((await storage.getObjectMeta(keys[1])).exists).toBe(false);
    expect((await storage.getObjectMeta(keys[2])).exists).toBe(true);
  }, 30000);
  it('не удаляет изменённое занятие и сохраняет общий asset с другой живой ссылкой', async () => {
    const before = await db.lessonArtifact.findMany({ where: { lessonId: lesson } });
    const added = await upload('pdf');
    expect((await request(`${root}/lessons/${lesson}`, 'DELETE', { expectedIds: before.map((row) => row.id) })).status).toBe(409);
    const shared = await db.lessonArtifact.findUniqueOrThrow({ where: { id: added } });
    const another = (await request(`${root}/lessons`, 'POST', { sectionId: section, title: 'Второе занятие' })).data.id;
    await db.lessonArtifact.create({ data: { lessonId: another, assetId: shared.assetId, type: 'pdf', version: 1 } });
    const ids = [...before.map((row) => row.id), added];
    expect((await request(`${root}/lessons/${lesson}`, 'DELETE', { expectedIds: ids })).status).toBe(200);
    expect(await db.asset.count({ where: { id: shared.assetId } })).toBe(1);
    expect((await request(`${root}/lessons/${lesson}`)).status).toBe(404);
    expect((await request(`${root}/sections/${section}`, 'DELETE', { expectedIds: [] })).status).toBe(409);
    expect((await request(`${root}/sections/${section}`, 'DELETE', { expectedIds: [another] })).status).toBe(200);
    expect(await db.asset.count({ where: { id: shared.assetId } })).toBe(0);
    await new LibraryAssetCleanupService(db, storage).flush();
    expect((await storage.getObjectMeta(keys.at(-1)!)).exists).toBe(false);
    expect(await db.lesson.count({ where: { sectionId: section } })).toBe(0);
    expect(await db.section.count({ where: { id: section } })).toBe(0);
  }, 30000);
  it('удаляет пустой раздел и безопасно отклоняет повтор', async () => {
    const id = (await request(`${root}/sections`, 'POST', { title: 'Пустой', gradeBand: 'grade_7' })).data.id;
    expect((await request(`${root}/sections/${id}`, 'DELETE', { expectedIds: [] })).status).toBe(200);
    expect((await request(`${root}/sections/${id}`, 'DELETE', { expectedIds: [] })).status).toBe(404);
  });
  it('не оставляет файл, если занятие удалено во время загрузки', async () => {
    const sectionId = (await request(`${root}/sections`, 'POST', { title: 'Гонка загрузки', gradeBand: 'grade_7' })).data.id;
    const lessonId = (await request(`${root}/lessons`, 'POST', { sectionId, title: 'Временное' })).data.id;
    const uploaded = Promise.withResolvers<void>(), release = Promise.withResolvers<void>();
    let objectKey = '';
    const delayed = {
      putObject: async (input: Parameters<ObjectStorageService['putObject']>[0]) => {
        objectKey = input.key; keys.push(objectKey);
        await storage.putObject(input); uploaded.resolve(); await release.promise;
      },
      deleteObject: storage.deleteObject.bind(storage),
    } as ObjectStorageService;
    const writes = new LibraryWriteService(db, delayed);
    const bytes = Buffer.from('%PDF-1.4\nracing upload');
    const pending = writes.uploadArtifact(teachers[0], lessonId, { type: 'pdf', filename: 'race.pdf', contentType: 'application/pdf', sizeBytes: bytes.length }, String(bytes.length), Readable.from([bytes]));
    await uploaded.promise;
    try { expect((await request(`${root}/lessons/${lessonId}`, 'DELETE', { expectedIds: [] })).status).toBe(200); }
    finally { release.resolve(); }
    await expect(pending).rejects.toMatchObject({ status: 404 });
    expect((await storage.getObjectMeta(objectKey)).exists).toBe(false);
    expect(await db.asset.count({ where: { objectKey } })).toBe(0);
  }, 30000);
});
