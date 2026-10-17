import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ZipFile } from 'yazl';
import { IdentityProvisioningService } from '../../src/auth/identity-provisioning.service';
import { createBetterAuth } from '../../src/auth/better-auth.factory';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ObjectStorageService } from '../../src/infra/storage/object-storage.service';
import { resolveObjectStorageConfig } from '../../src/infra/storage/object-storage.config';
import { parseAssessmentArchive } from '../../src/assessment-bank/assessment-archive';
import { StoredAssessmentImportSchema, StoredAssessmentTaskSchema } from '../../src/assessment-bank/assessment-bank.mapper';

const base = 'http://localhost:3000';
const origin = 'http://localhost:3001';
const root = '/teacher/assessment-bank';
const prisma = new PrismaService();
const identities = new IdentityProvisioningService(prisma);
const storage = new ObjectStorageService(resolveObjectStorageConfig());
const teachers: string[] = [];
let cookie = '', otherCookie = '', studentCookie = '';
let pilot: Buffer;
let originalPreview: string;
let stalePreview: string;
let taskIds: string[] = [];
const api = async (path: string, method = 'GET', body?: Buffer, session = cookie, requestOrigin = origin) => {
  const response = await fetch(`${base}${path}`, { method, headers: { origin: requestOrigin, cookie: session, ...(body ? { 'Content-Type': 'application/zip' } : {}) }, body });
  const type = response.headers.get('content-type') ?? '';
  return { status: response.status, data: type.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer()), cache: response.headers.get('cache-control'), corsOrigin: response.headers.get('access-control-allow-origin'), corsCredentials: response.headers.get('access-control-allow-credentials') };
};
async function login(username: string, password: string) {
  const response = await createBetterAuth(prisma).api.signInUsername({ body: { username, password }, asResponse: true, headers: new Headers({ origin }) });
  expect(response.status).toBe(200);
  return response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
}
async function changedPackage() {
  const parsed = await parseAssessmentArchive(pilot);
  parsed.tasks[0].task.title = 'Давление газа: новая редакция';
  const third = parsed.tasks[2];
  const originalPath = third.images[0].path;
  const newPath = originalPath.replace(/\.(jpg|png)$/, '-v2.$1');
  third.statement = third.statement.replace(originalPath, newPath);
  third.images[0].path = newPath;
  const zip = new ZipFile();
  zip.addBuffer(Buffer.from(JSON.stringify(parsed.manifest)), 'manifest.json');
  for (const entry of parsed.tasks) {
    const prefix = `tasks/${entry.task.id}/`;
    zip.addBuffer(Buffer.from(JSON.stringify(entry.task)), `${prefix}task.json`);
    zip.addBuffer(Buffer.from(entry.statement), `${prefix}statement.md`);
    for (const image of entry.images) zip.addBuffer(image.bytes, `${prefix}${image.path}`);
  }
  zip.end();
  const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks);
}

describe('assessment bank: real HTTP, PostgreSQL and private S3', () => {
  beforeAll(async () => {
    await prisma.$connect();
    pilot = await readFile(resolve(__dirname, '../../../../output/assessment-package-pilot-v1.zip'));
    for (let i = 0; i < 2; i++) {
      const username = `bank-test-${randomUUID()}`;
      const teacher = await identities.createTeacher({ login: username, password: 'Local-bank-test-123', firstName: 'Тест', lastName: 'Банк', middleName: null });
      teachers.push(teacher.user.id);
      const session = await login(username, 'Local-bank-test-123');
      if (i === 0) cookie = session; else otherCookie = session;
    }
    const created = await fetch(`${base}/teacher/classes/students`, { method: 'POST', headers: { cookie, origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: randomUUID(), newClass: { title: 'Банк-тест', grade: 11, academicYear: 2026 }, students: [{ lastName: 'Проверка', firstName: 'Ученик', middleName: '' }] }) });
    const student = (await created.json()).credentials[0];
    studentCookie = await login(student.login, student.password);
  }, 30000);
  afterAll(async () => {
    const imports = await prisma.assessmentBankImport.findMany({ where: { teacherId: { in: teachers } } });
    const versions = await prisma.assessmentTaskVersion.findMany({ where: { task: { teacherId: { in: teachers } } } });
    const keys = new Set([...imports.flatMap((row) => StoredAssessmentImportSchema.parse(row.data)), ...versions.map((row) => StoredAssessmentTaskSchema.parse(row.data))].flatMap((entry) => entry.images.map((image) => image.key)));
    await Promise.all([...keys].map((key) => storage.deleteObject(key)));
    await prisma.assessmentBankImport.deleteMany({ where: { teacherId: { in: teachers } } });
    await prisma.assessmentBankTask.deleteMany({ where: { teacherId: { in: teachers } } });
    const students = await prisma.studentProfile.findMany({ where: { leadTeacherId: { in: teachers } }, select: { userId: true } });
    await prisma.accessGrant.deleteMany({ where: { grantedById: { in: teachers } } });
    await prisma.studentProfile.deleteMany({ where: { leadTeacherId: { in: teachers } } });
    await prisma.studentProvisioningBatch.deleteMany({ where: { teacherId: { in: teachers } } });
    await prisma.schoolClass.deleteMany({ where: { teacherId: { in: teachers } } });
    await prisma.user.deleteMany({ where: { id: { in: [...teachers, ...students.map((row) => row.userId)] } } });
    await prisma.$disconnect();
  }, 30000);

  it('checks permissions and invalid packages without changing the bank', async () => {
    expect((await api(root, 'GET', undefined, '')).status).toBe(401);
    expect((await api(root, 'GET', undefined, studentCookie)).status).toBe(403);
    expect((await api(`${root}/imports/preview`, 'POST', pilot, cookie, 'https://foreign.example')).status).toBe(403);
    const invalid = await api(`${root}/imports/preview`, 'POST', Buffer.from('broken zip'));
    expect(invalid.data.id).toBeNull(); expect(invalid.data.issues.length).toBeGreaterThan(0);
    const preview = await api(`${root}/imports/preview`, 'POST', pilot);
    expect(preview.status).toBe(201); expect(preview.cache).toBe('no-store');
    originalPreview = preview.data.id;
    expect(preview.data.items).toHaveLength(6);
    expect(preview.data.items.every((item: { status: string }) => item.status === 'new')).toBe(true);
    expect((await api(root)).data.total).toBe(0);
    const viewPath = `${root}/imports/${originalPreview}/tasks/shkolkovo-24187`;
    const view = await api(viewPath);
    expect(view.data.task.source).toMatchObject({ provider: 'Школково', externalId: '24187', taskNumber: 7, sectionCode: '15.08', examTaskNumber: 15 });
    const imagePath = Object.values(view.data.images)[0] as string;
    expect((await api(imagePath)).status).toBe(200);
    expect((await api(viewPath, 'GET', undefined, otherCookie)).status).toBe(404);
    expect((await api(imagePath, 'GET', undefined, otherCookie)).status).toBe(404);
    expect((await api(`${root}/imports/${originalPreview}/confirm`, 'POST', undefined, otherCookie)).status).toBe(404);
  }, 30000);

  it('confirms once under a race, preserves metadata and exports a round-trippable package', async () => {
    const responses = await Promise.all([api(`${root}/imports/${originalPreview}/confirm`, 'POST'), api(`${root}/imports/${originalPreview}/confirm`, 'POST')]);
    expect(responses.map((value) => value.status)).toEqual([201, 201]);
    expect(responses[0].data).toEqual(responses[1].data);
    expect(responses[0].data).toMatchObject({ added: 6, updated: 0, unchanged: 0 });
    taskIds = responses[0].data.taskIds;
    const list = await api(`${root}?search=11121`);
    expect(list.data.total).toBe(1);
    expect(list.data.tasks[0].source).toMatchObject({ externalId: '11121', taskNumber: 86, examTaskNumber: 7 });
    expect((await api(`${root}?gradeBand=grade_7`)).data.total).toBe(0);
    expect((await api(`${root}?type=matching`)).data.total).toBe(2);
    expect((await api(root, 'GET', undefined, otherCookie)).data.total).toBe(0);
    const exported = await api(`${root}/export`);
    expect(exported.status).toBe(200);
    const original = await parseAssessmentArchive(pilot);
    const restored = await parseAssessmentArchive(exported.data);
    expect(new Map(restored.tasks.map((entry) => [entry.task.id, entry.hash]))).toEqual(new Map(original.tasks.map((entry) => [entry.task.id, entry.hash])));
    const again = await api(`${root}/imports/preview`, 'POST', exported.data);
    expect(again.data.items.every((item: { status: string }) => item.status === 'unchanged')).toBe(true);
    stalePreview = again.data.id;
  }, 30000);

  it('serves all pilot images byte-for-byte with credentialed CORS for the web origin', async () => {
    const original = await parseAssessmentArchive(pilot);
    let checked = 0;
    for (const id of taskIds) {
      const view = await api(`${root}/tasks/${id}`);
      const entry = original.tasks.find((task) => task.task.id === view.data.task.id)!;
      for (const [path, url] of Object.entries(view.data.images)) {
        const response = await api(url as string);
        expect(response.status).toBe(200);
        expect(response.corsOrigin).toBe(origin);
        expect(response.corsCredentials).toBe('true');
        expect(response.cache).toBe('no-store');
        expect(response.data).toEqual(entry.images.find((image) => image.path === path)!.bytes);
        checked++;
      }
    }
    expect(checked).toBe(4);
  });

  it('creates immutable versions, rejects stale confirmation and keeps old-version images', async () => {
    const preview = await api(`${root}/imports/preview`, 'POST', await changedPackage());
    expect(preview.data.items.filter((item: { status: string }) => item.status === 'changed')).toHaveLength(2);
    const imported = await api(`${root}/imports/${preview.data.id}/confirm`, 'POST');
    expect(imported.data).toMatchObject({ added: 0, updated: 2, unchanged: 4 });
    expect((await api(`${root}/imports/${stalePreview}/confirm`, 'POST')).status).toBe(409);
    const first = await api(`${root}/tasks/${taskIds[0]}`);
    expect(first.data.version).toBe(2); expect(first.data.task.title).toContain('новая редакция');
    expect((await api(`${root}/tasks/${taskIds[0]}?version=1`)).data.task.title).toBe('Давление газа');
    const before = await api(`${root}/tasks/${taskIds[2]}?version=1`);
    const after = await api(`${root}/tasks/${taskIds[2]}`);
    const oldImage = Object.values(before.data.images)[0] as string;
    const newImage = Object.values(after.data.images)[0] as string;
    expect(oldImage).toContain('?version=1'); expect(newImage).toContain('?version=2');
    expect((await api(oldImage)).status).toBe(200); expect((await api(newImage)).status).toBe(200);
    expect((await api(oldImage.replace('?version=1', ''))).status).toBe(404);
    expect((await api(`${root}/tasks/${taskIds[0]}`, 'GET', undefined, otherCookie)).status).toBe(404);
    expect((await api(newImage, 'GET', undefined, studentCookie)).status).toBe(403);
    await api(`${root}/imports/${preview.data.id}`, 'DELETE');
    expect((await api(newImage)).status).toBe(200);
    expect(await prisma.assessmentTaskVersion.count({ where: { task: { teacherId: teachers[0] } } })).toBe(8);
  }, 30000);

  it('expires a preview without applying it and cleans cancelled image copies', async () => {
    const preview = await api(`${root}/imports/preview`, 'POST', pilot);
    await prisma.assessmentBankImport.update({ where: { id: preview.data.id }, data: { expiresAt: new Date(0) } });
    expect((await api(`${root}/imports/${preview.data.id}/confirm`, 'POST')).status).toBe(410);
    expect((await api(`${root}/imports/${preview.data.id}/tasks/shkolkovo-11121`)).status).toBe(410);
    expect((await api(`${root}/imports/${preview.data.id}`, 'DELETE')).status).toBe(200);
    expect((await api(root)).data.total).toBe(6);
  }, 30000);
});
