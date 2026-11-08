import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { IdentityProvisioningService } from '../../src/auth/identity-provisioning.service';
import { createBetterAuth } from '../../src/auth/better-auth.factory';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ObjectStorageService } from '../../src/infra/storage/object-storage.service';
import { resolveObjectStorageConfig } from '../../src/infra/storage/object-storage.config';
import { interactiveHash, parseInteractiveArchive } from '../../src/library/interactive-archive';
import { interactiveHtml, interactiveManifest, interactiveZip } from '../interactive-archive.fixture';

const db = new PrismaService();
const storage = new ObjectStorageService(resolveObjectStorageConfig());
const origin = 'http://localhost:3001';
const base = 'http://localhost:3000';
const teacherIds: string[] = [], studentIds: string[] = [], keys: string[] = [];
let teacherCookie = '', otherTeacherCookie = '', studentCookie = '', noGrantCookie = '', sectionId = '', lessonId = '';
async function login(login: string, password: string) {
  const response = await createBetterAuth(db).api.signInUsername({ body: { username: login, password }, asResponse: true, headers: new Headers({ origin }) });
  expect(response.status).toBe(200);
  return response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
}
async function request(path: string, method = 'GET', body?: unknown, cookie = teacherCookie, requestOrigin = origin) {
  const response = await fetch(`${base}${path}`, { method, headers: { cookie, origin: requestOrigin, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, data: await response.json(), headers: response.headers };
}
async function upload(bytes: Buffer, cookie = teacherCookie, requestOrigin = origin) {
  const query = new URLSearchParams({ type: 'interactive', filename: 'kin-01.zip', sizeBytes: String(bytes.length) });
  const response = await fetch(`${base}/teacher/library/lessons/${lessonId}/artifacts/upload?${query}`, { method: 'PUT', headers: { cookie, origin: requestOrigin, 'Content-Type': 'application/zip' }, body: bytes });
  const data = await response.json();
  return { status: response.status, data };
}

describe('interactive lesson delivery: HTTP + PostgreSQL + S3', () => {
  beforeAll(async () => {
    await db.$connect();
    const identities = new IdentityProvisioningService(db);
    const password = 'Interactive-test-12345';
    for (let i = 0; i < 2; i++) {
      const loginName = `interactive-teacher-${randomUUID()}`;
      const created = await identities.createTeacher({ login: loginName, password, firstName: 'Тест', lastName: 'Интерактив', middleName: null });
      teacherIds.push(created.user.id);
      const cookie = await login(loginName, password);
      if (i === 0) teacherCookie = cookie; else otherTeacherCookie = cookie;
    }
    for (let i = 0; i < 2; i++) {
      const loginName = `interactive-student-${randomUUID()}`;
      const created = await identities.createStudent({ login: loginName, password, leadTeacherId: teacherIds[0], firstName: 'Тест', lastName: 'Лекция' });
      studentIds.push(created.user.id);
      const cookie = await login(loginName, password);
      if (i === 0) studentCookie = cookie; else noGrantCookie = cookie;
    }
    const section = await request('/teacher/library/sections', 'POST', { title: 'Тест интерактивных лекций', gradeBand: 'grade_10_11' });
    expect(section.status).toBe(201); sectionId = section.data.id;
    const lesson = await request('/teacher/library/lessons', 'POST', { title: 'Кинематика: импорт', sectionId });
    expect(lesson.status).toBe(201); lessonId = lesson.data.id;
  }, 30000);
  afterAll(async () => {
    const assets = await db.asset.findMany({ where: { uploadedById: { in: teacherIds } } });
    for (const key of new Set([...keys, ...assets.map((asset) => asset.objectKey)])) await storage.deleteObject(key);
    await db.lesson.deleteMany({ where: { createdById: { in: teacherIds } } });
    await db.section.deleteMany({ where: { createdById: { in: teacherIds } } });
    await db.asset.deleteMany({ where: { uploadedById: { in: teacherIds } } });
    await db.accessGrant.deleteMany({ where: { studentId: { in: studentIds } } });
    await db.studentProfile.deleteMany({ where: { userId: { in: studentIds } } });
    await db.user.deleteMany({ where: { id: { in: [...studentIds, ...teacherIds] } } });
    await db.$disconnect();
  }, 30000);

  it('imports, previews, publishes, protects versions and rejects malformed/legacy packages', async () => {
    const zip = await interactiveZip();
    const uploaded = await upload(zip);
    expect(uploaded.status, JSON.stringify(uploaded.data)).toBe(200);
    const firstId = uploaded.data.id as string;
    const teacherPath = `/teacher/library/artifacts/${firstId}/interactive`;
    const studentPath = `/student/library/artifacts/${firstId}/interactive`;
    const preview = await request(teacherPath, 'GET', undefined, otherTeacherCookie);
    expect(preview.status).toBe(200);
    expect(preview.headers.get('cache-control')).toBe('no-store');
    expect(preview.data).toEqual({ artifactId: firstId, manifest: interactiveManifest, html: interactiveHtml });
    expect((await request(teacherPath, 'GET', undefined, '')).status).toBe(401);
    expect((await request(teacherPath, 'GET', undefined, studentCookie)).status).toBe(403);
    expect((await request(studentPath, 'GET', undefined, teacherCookie)).status).toBe(403);
    expect((await request(studentPath, 'GET', undefined, studentCookie)).status).toBe(404);
    expect((await request(`/teacher/library/lessons/${lessonId}/publish`, 'PATCH')).status).toBe(403);
    await request(`/teacher/library/sections/${sectionId}/publish`, 'PATCH');
    expect((await request(`/teacher/library/lessons/${lessonId}/publish`, 'PATCH', undefined, teacherCookie, 'https://foreign.test')).status).toBe(403);
    expect((await request(`/teacher/library/lessons/${lessonId}/publish`, 'PATCH')).status).toBe(200);
    expect((await request(studentPath, 'GET', undefined, studentCookie)).status).toBe(404);
    await request('/teacher/library/access-grants', 'PUT', { studentId: studentIds[0], gradeBand: 'grade_10_11', enabled: true });
    const doc = await request(studentPath, 'GET', undefined, studentCookie);
    expect(doc.status).toBe(200); expect(doc.data.html).toBe(interactiveHtml);
    expect(doc.headers.get('cache-control')).toBe('no-store');
    expect((await request(studentPath, 'GET', undefined, noGrantCookie)).status).toBe(404);
    expect((await request(`/student/library/lessons/${lessonId}`, 'GET', undefined, studentCookie)).data.artifacts).toEqual([expect.objectContaining({ id: firstId, type: 'interactive' })]);
    const catalog = await request('/student/library', 'GET', undefined, studentCookie);
    expect(catalog.data.gradeBands.flatMap((band: { sections: { lessons: { id: string; formats: { interactive: boolean } }[] }[] }) => band.sections.flatMap((section) => section.lessons)).find((lesson: { id: string }) => lesson.id === lessonId).formats.interactive).toBe(true);
    expect((await request(`/student/library/artifacts/${firstId}/view`, 'GET', undefined, studentCookie)).status).toBe(404);
    await db.section.update({ where: { id: sectionId }, data: { status: 'draft' } });
    expect((await request(studentPath, 'GET', undefined, studentCookie)).status).toBe(404);
    await db.section.update({ where: { id: sectionId }, data: { status: 'published' } });
    await request('/teacher/library/access-grants', 'PUT', { studentId: studentIds[0], gradeBand: 'grade_10_11', enabled: false });
    expect((await request(studentPath, 'GET', undefined, studentCookie)).status).toBe(404);
    await request('/teacher/library/access-grants', 'PUT', { studentId: studentIds[0], gradeBand: 'grade_10_11', enabled: true });

    const second = await upload(zip);
    expect(second.status).toBe(200); expect(second.data.version).toBe(2);
    const secondPath = `/student/library/artifacts/${second.data.id}/interactive`;
    expect((await request(secondPath, 'GET', undefined, studentCookie)).status).toBe(404);
    expect((await request(studentPath, 'GET', undefined, studentCookie)).status).toBe(200);
    const concurrent = await Promise.all([
      request(`/teacher/library/lessons/${lessonId}/publish`, 'PATCH'),
      request(`/teacher/library/lessons/${lessonId}/publish`, 'PATCH'),
    ]);
    expect(concurrent.map((result) => result.status)).toEqual([200, 200]);
    expect(await db.lessonArtifact.count({ where: { lessonId, type: 'interactive', isActive: true } })).toBe(1);
    expect((await request(studentPath, 'GET', undefined, studentCookie)).status).toBe(404);
    expect((await request(secondPath, 'GET', undefined, studentCookie)).status).toBe(200);
    expect((await request(teacherPath)).status).toBe(200);

    const before = await db.lessonArtifact.count({ where: { lessonId } });
    expect((await upload(Buffer.from('PKbroken'))).status).toBe(400);
    expect((await upload(zip, teacherCookie, 'https://foreign.test')).status).toBe(403);
    expect((await upload(zip, studentCookie)).status).toBe(403);
    expect(await db.lessonArtifact.count({ where: { lessonId } })).toBe(before);

    const secondAsset = (await db.lessonArtifact.findUniqueOrThrow({ where: { id: second.data.id }, include: { asset: true } })).asset;
    try {
      await storage.putObject({ key: secondAsset.objectKey, contentType: 'application/zip', body: Buffer.alloc(zip.length) });
      expect((await request(secondPath, 'GET', undefined, studentCookie)).status).toBe(400);
      expect((await request(`/teacher/library/lessons/${lessonId}/publish`, 'PATCH')).status).toBe(400);
    } finally {
      await storage.putObject({ key: secondAsset.objectKey, contentType: 'application/zip', body: zip });
    }

    // Historical pre-validator ZIPs cannot become published merely because their PK header is valid.
    const legacyZip = Buffer.from('PKlegacy');
    const objectKey = `interactive-test/${randomUUID()}.zip`; keys.push(objectKey);
    await storage.putObject({ key: objectKey, contentType: 'application/zip', body: legacyZip });
    const legacyAsset = await db.asset.create({ data: { objectKey, filename: 'legacy.zip', contentType: 'application/zip', sizeBytes: BigInt(legacyZip.length), contentHash: interactiveHash(legacyZip), uploadedById: teacherIds[0] } });
    const legacy = await db.lessonArtifact.create({ data: { lessonId, assetId: legacyAsset.id, type: 'interactive', version: 3 } });
    expect((await request(`/teacher/library/lessons/${lessonId}/publish`, 'PATCH')).status).toBe(400);
    expect((await request(`/teacher/library/artifacts/${legacy.id}/interactive`)).status).toBe(400);
    expect((await request(secondPath, 'GET', undefined, studentCookie)).status).toBe(200);
    expect((await db.lessonArtifact.findUniqueOrThrow({ where: { id: legacy.id } })).isActive).toBe(false);
  }, 30000);

  it.skipIf(!process.env.INTERACTIVE_LESSON_ZIP)('round-trips the actual locally built lecture ZIP', async () => {
    const bytes = await readFile(process.env.INTERACTIVE_LESSON_ZIP!);
    const parsed = await parseInteractiveArchive(bytes);
    const lesson = await request('/teacher/library/lessons', 'POST', { title: parsed.manifest.title, sectionId });
    expect(lesson.status).toBe(201); lessonId = lesson.data.id;
    const result = await upload(bytes);
    expect(result.status, JSON.stringify(result.data)).toBe(200);
    const artifactId = result.data.id;
    const preview = await request(`/teacher/library/artifacts/${artifactId}/interactive`);
    expect(preview.status).toBe(200);
    expect(preview.data).toEqual({ artifactId, ...parsed });
    expect((await request(`/teacher/library/lessons/${lessonId}/publish`, 'PATCH')).status).toBe(200);
    const student = await request(`/student/library/artifacts/${artifactId}/interactive`, 'GET', undefined, studentCookie);
    expect(student.status).toBe(200);
    expect(student.data).toEqual(preview.data);
  }, 30000);
});
