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
import { AssessmentDuplicateHintsSchema } from '@continuum/shared';
import { Prisma } from '@prisma/client';
import { assessmentDuplicateQuery } from '../../src/assessment-bank/assessment-duplicate-read.service';

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
const api = async (path: string, method = 'GET', body?: Buffer | object, session = cookie, requestOrigin = origin) => {
  const response = await fetch(`${base}${path}`, { method, headers: { origin: requestOrigin, cookie: session, ...(body ? { 'Content-Type': Buffer.isBuffer(body) ? 'application/zip' : 'application/json' } : {}) }, body: body && (Buffer.isBuffer(body) ? body : JSON.stringify(body)) });
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

async function duplicatePackage(items: { id: string; statement: string; provider?: string; externalId?: string }[]) {
  const zip = new ZipFile();
  zip.addBuffer(Buffer.from(JSON.stringify({ format: 'continuum-assessment-package', version: 1, title: 'Проверка совпадений', tasks: items.map((item) => item.id) })), 'manifest.json');
  for (const item of items) {
    const task = { id: item.id, title: item.id, gradeBand: 'grade_10_11', topicPath: ['Дубли'], maxPoints: 1, type: 'short_number', source: { provider: item.provider ?? 'Авторское', ...(item.externalId ? { externalId: item.externalId } : {}) }, grading: { answer: '1', absoluteTolerance: 0 } };
    zip.addBuffer(Buffer.from(JSON.stringify(task)), `tasks/${item.id}/task.json`);
    zip.addBuffer(Buffer.from(item.statement), `tasks/${item.id}/statement.md`);
  }
  zip.end(); const chunks: Buffer[] = [];
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

  it('undoes an exact deletion, preserves versions/images and isolates permissions', async () => {
    const path = `${root}/tasks/${taskIds[2]}`;
    const before = (await api(path)).data;
    const input = { expectedVersion: before.version, expectedLifecycleRevision: before.lifecycleRevision };
    const removed = await api(path, 'DELETE', input);
    expect(removed.status).toBe(200);
    expect(removed.data).toEqual({ id: taskIds[2], version: before.version, deletionRevision: before.lifecycleRevision + 1 });
    expect((await api(path, 'DELETE', input)).data).toEqual(removed.data);
    expect((await api(path)).status).toBe(404);
    const undo = { expectedVersion: before.version, expectedDeletionRevision: removed.data.deletionRevision };
    expect((await api(`${path}/restore`, 'POST', undo, '')).status).toBe(401);
    expect((await api(`${path}/restore`, 'POST', undo, studentCookie)).status).toBe(403);
    expect((await api(`${path}/restore`, 'POST', undo, otherCookie)).status).toBe(404);
    expect((await api(`${path}/restore`, 'POST', undo, cookie, 'https://foreign.example')).status).toBe(403);
    expect((await api(`${root}/tasks/${randomUUID()}/restore`, 'POST', undo)).status).toBe(404);
    expect((await api(`${path}/restore`, 'POST', {})).status).toBe(400);
    expect((await api(`${path}/restore`, 'POST', { ...undo, extra: true })).status).toBe(400);
    expect((await api(`${path}/restore`, 'POST', { ...undo, expectedVersion: before.version + 1 })).status).toBe(409);
    const race = await Promise.all([api(`${path}/restore`, 'POST', undo), api(`${path}/restore`, 'POST', undo)]);
    expect(race.map((response) => response.status)).toEqual([201, 201]);
    expect(race[0].data).toEqual({ id: taskIds[2] });
    const after = (await api(path)).data;
    expect(after).toEqual({ ...before, lifecycleRevision: before.lifecycleRevision + 2 });
    for (const image of Object.values(after.images)) expect((await api(image as string)).status).toBe(200);
    expect(await prisma.assessmentTaskVersion.count({ where: { task: { teacherId: teachers[0] } } })).toBe(8);
    expect((await api(path, 'DELETE', input)).status).toBe(409);
    const second = await api(path, 'DELETE', { ...input, expectedLifecycleRevision: after.lifecycleRevision });
    expect(second.status).toBe(200);
    expect((await api(`${path}/restore`, 'POST', undo)).status).toBe(409);
    expect((await api(path)).status).toBe(404);
    expect((await api(`${path}/restore`, 'POST', { ...undo, expectedDeletionRevision: second.data.deletionRevision })).status).toBe(201);
  }, 30000);

  it('does not overwrite a later import and accepts an already restored identical import', async () => {
    const path = `${root}/tasks/${taskIds[0]}`;
    const before = (await api(path)).data;
    const removed = await api(path, 'DELETE', { expectedVersion: before.version, expectedLifecycleRevision: before.lifecycleRevision });
    const undo = { expectedVersion: before.version, expectedDeletionRevision: removed.data.deletionRevision };
    const preview = await api(`${root}/imports/preview`, 'POST', pilot);
    expect((await api(`${root}/imports/${preview.data.id}/confirm`, 'POST')).status).toBe(201);
    expect((await api(`${path}/restore`, 'POST', undo)).status).toBe(409);
    const changed = (await api(path)).data;
    expect(changed.version).toBe(before.version + 1);
    const next = await api(path, 'DELETE', { expectedVersion: changed.version, expectedLifecycleRevision: changed.lifecycleRevision });
    const same = await api(`${root}/imports/preview`, 'POST', pilot);
    expect((await api(`${root}/imports/${same.data.id}/confirm`, 'POST')).status).toBe(201);
    expect((await api(`${path}/restore`, 'POST', { expectedVersion: changed.version, expectedDeletionRevision: next.data.deletionRevision })).status).toBe(201);
    const restored = (await api(path)).data;
    expect(restored.version).toBe(changed.version);
    expect(restored.task).toEqual(changed.task);
    expect(restored.lifecycleRevision).toBe(changed.lifecycleRevision + 2);
  }, 30000);

  it('round-trips explicit classification through preview, import, list, view and export', async () => {
    const example = resolve(__dirname, '../../../../examples/assessment-package/ege-v1');
    const manifest = JSON.parse(await readFile(resolve(example, 'manifest.json'), 'utf8')) as { tasks: string[] };
    const zip = new ZipFile();
    zip.addBuffer(Buffer.from(JSON.stringify(manifest)), 'manifest.json');
    for (const id of manifest.tasks) for (const file of ['task.json', 'statement.md']) zip.addBuffer(await readFile(resolve(example, 'tasks', id, file)), `tasks/${id}/${file}`);
    zip.end();
    const chunks: Buffer[] = [];
    for await (const chunk of zip.outputStream) chunks.push(Buffer.from(chunk));
    const preview = await api(`${root}/imports/preview`, 'POST', Buffer.concat(chunks));
    expect(preview.status).toBe(201);
    expect(preview.data.issues).toEqual([]);
    expect(preview.data.items.every((item: { source: { exam: string; kind: string } }) => item.source.exam === 'ege' && item.source.kind === 'platform')).toBe(true);
    expect((await api(`${root}/imports/${preview.data.id}/confirm`, 'POST')).status).toBe(201);
    const list = await api(`${root}?search=14139`);
    expect(list.data.tasks[0].source).toMatchObject({ exam: 'ege', kind: 'platform', examYear: 2026, examTaskNumber: 15 });
    const view = await api(`${root}/tasks/${list.data.tasks[0].id}`);
    expect(view.data.task.source).toEqual(list.data.tasks[0].source);
    const exported = await api(`${root}/export`);
    const parsed = await parseAssessmentArchive(exported.data);
    expect(parsed.tasks.find((entry) => entry.task.id === 'shkolkovo-14139')!.task.source).toEqual(view.data.task.source);
    const again = await api(`${root}/imports/preview`, 'POST', exported.data);
    expect(again.data.items.every((item: { status: string }) => item.status === 'unchanged')).toBe(true);
  }, 30000);

  it('filters exam and provider before pagination/export and scopes source options to current accessible versions', async () => {
    const provider = 'Фильтры & + источник';
    const source = { provider, exam: 'none' };
    const make = (id: string, metadata: object, gradeBand = 'grade_10_11') => ({ id, title: id, gradeBand, topicPath: ['Фильтры'], source: metadata, type: 'short_number', maxPoints: 1, grading: { answer: '1', absoluteTolerance: 0 } });
    const tasks = [
      ...Array.from({ length: 51 }, (_, index) => make(`filter-${index}`, source)),
      make('filter-legacy-ege', { provider, examYear: 2026, examTaskNumber: 7 }),
      make('filter-explicit-ege', { provider, exam: 'ege', examYear: 2026, examTaskNumber: 7 }),
      make('filter-unknown', { provider }), make('filter-year-only', { provider, examYear: 2026 }),
      make('filter-other-grade', { provider: 'Только 8 класс', exam: 'none' }, 'grade_8'),
      make('filter-deleted', { provider: 'Удалённый источник', exam: 'none' }),
    ];
    const pack = async (items: typeof tasks) => {
      const zip = new ZipFile();
      zip.addBuffer(Buffer.from(JSON.stringify({ format: 'continuum-assessment-package', version: 1, title: 'Фильтры', tasks: items.map((task) => task.id) })), 'manifest.json');
      for (const task of items) {
        zip.addBuffer(Buffer.from(JSON.stringify(task)), `tasks/${task.id}/task.json`);
        zip.addBuffer(Buffer.from('Условие для проверки фильтров.'), `tasks/${task.id}/statement.md`);
      }
      zip.end(); const chunks: Buffer[] = [];
      for await (const chunk of zip.outputStream) chunks.push(Buffer.from(chunk));
      return Buffer.concat(chunks);
    };
    const preview = await api(`${root}/imports/preview`, 'POST', await pack(tasks));
    expect(preview.data.issues).toEqual([]);
    expect((await api(`${root}/imports/${preview.data.id}/confirm`, 'POST')).status).toBe(201);
    const query = new URLSearchParams({ gradeBand: 'grade_10_11', source: provider, exam: 'none' });
    const first = await api(`${root}?${query}`);
    expect(first.data.total).toBe(51); expect(first.data.tasks).toHaveLength(50);
    expect(first.data.tasks.every((task: { source: { provider: string; exam: string } }) => task.source.provider === provider && task.source.exam === 'none')).toBe(true);
    expect((await api(`${root}?${query}&page=2`)).data.tasks).toHaveLength(1);
    const ege = await api(`${root}?${new URLSearchParams({ source: provider, exam: 'ege' })}`);
    expect(ege.data.tasks.map((task: { stableId: string }) => task.stableId).sort()).toEqual(['filter-explicit-ege', 'filter-legacy-ege']);
    expect((await api(`${root}?${new URLSearchParams({ source: provider })}`)).data.total).toBe(55);
    expect((await api(`${root}?${query}&topic=Фильтры&type=short_text`)).data.total).toBe(0);
    const exported = await api(`${root}/export?${query}`);
    expect((await parseAssessmentArchive(exported.data)).tasks).toHaveLength(51);
    const deleted = (await api(`${root}?source=${encodeURIComponent('Удалённый источник')}`)).data.tasks[0];
    const view = (await api(`${root}/tasks/${deleted.id}`)).data;
    expect((await api(`${root}/tasks/${deleted.id}`, 'DELETE', { expectedVersion: view.version, expectedLifecycleRevision: view.lifecycleRevision })).status).toBe(200);
    const foreign = await api(`${root}/imports/preview`, 'POST', await pack([make('foreign-source', { provider: 'Чужой источник' })]), otherCookie);
    expect((await api(`${root}/imports/${foreign.data.id}/confirm`, 'POST', undefined, otherCookie)).status).toBe(201);
    const options = (await api(`${root}?gradeBand=grade_10_11&exam=none&source=absent`)).data;
    expect(options.total).toBe(0); expect(options.sources).toContain(provider);
    for (const absent of ['Только 8 класс', 'Удалённый источник', 'Чужой источник']) expect(options.sources).not.toContain(absent);
    expect((await api(`${root}?exam=oge`)).status).toBe(400);
    expect((await api(`${root}?source=`)).status).toBe(400);
    expect((await api(`${root}?${query}`, 'GET', undefined, studentCookie)).status).toBe(403);
  }, 30000);

  it('finds advisory source/text matches without blocking confirmation and isolates previews', async () => {
    const original = [{ id: 'hint-bank', statement: 'Частица массы m. Найдите силу 42 Н.', provider: 'Школково', externalId: 'hint-42' }];
    const stored = await api(`${root}/imports/preview`, 'POST', await duplicatePackage(original));
    const confirmed = await api(`${root}/imports/${stored.data.id}/confirm`, 'POST');
    const bankId = confirmed.data.taskIds[0];
    const preview = await api(`${root}/imports/preview`, 'POST', await duplicatePackage([
      { id: 'hint-source', statement: 'Совсем другое условие 17.', provider: '  ШКОЛКОВО ', externalId: 'HINT-42' },
      { id: 'hint-text', statement: 'Частица  массы m.\nНайдите силу 42 Н.' },
      { id: 'hint-inside', statement: 'Совсем другое условие 17.' },
      { id: 'hint-unique', statement: 'Новое условие: сила 43 Н.' },
    ]));
    const response = await api(`${root}/imports/${preview.data.id}/duplicates`);
    expect(response.status).toBe(200); expect(response.cache).toBe('no-store');
    const hints = AssessmentDuplicateHintsSchema.parse(response.data);
    expect(hints.status).toBe('complete');
    expect(hints.tasks.find((task) => task.stableId === 'hint-source')!.matches).toEqual(expect.arrayContaining([
      expect.objectContaining({ target: expect.objectContaining({ location: 'bank', taskId: bankId, version: 1 }), reasons: ['source'] }),
      expect.objectContaining({ target: expect.objectContaining({ location: 'package', stableId: 'hint-inside' }), reasons: ['statement'] }),
    ]));
    expect(hints.tasks.find((task) => task.stableId === 'hint-text')!.matches[0].reasons).toEqual(['statement']);
    expect(hints.tasks.some((task) => task.stableId === 'hint-unique')).toBe(false);
    expect((await api(`${root}/imports/${preview.data.id}/duplicates`, 'GET', undefined, otherCookie)).status).toBe(404);
    expect((await api(`${root}/imports/${preview.data.id}/duplicates`, 'GET', undefined, studentCookie)).status).toBe(403);
    expect((await api(`${root}/imports/${preview.data.id}/confirm`, 'POST')).data.added).toBe(4);
    const same = await api(`${root}/imports/preview`, 'POST', await duplicatePackage(original));
    const self = AssessmentDuplicateHintsSchema.parse((await api(`${root}/imports/${same.data.id}/duplicates`)).data);
    expect(self.tasks.flatMap((item) => item.matches).some((match) => match.target.stableId === 'hint-bank')).toBe(false);
    const view = (await api(`${root}/tasks/${bankId}`)).data;
    await api(`${root}/tasks/${bankId}`, 'DELETE', { expectedVersion: view.version, expectedLifecycleRevision: view.lifecycleRevision });
    const after = AssessmentDuplicateHintsSchema.parse((await api(`${root}/imports/${same.data.id}/duplicates`)).data);
    expect(after.tasks.flatMap((item) => item.matches).some((match) => match.target.location === 'bank' && match.target.taskId === bankId)).toBe(false);
  }, 30000);

  it('caps common-condition hints and checks 500 package records in one bounded request', async () => {
    const seed = (await parseAssessmentArchive(await duplicatePackage([{ id: 'hint-template', statement: 'Шаблон теста скорости.' }]))).tasks[0];
    const records = Array.from({ length: 2000 }, (_, index) => ({ id: randomUUID(), taskId: randomUUID(), stableId: `hint-db-${index}` }));
    await prisma.assessmentBankTask.createMany({ data: records.map((record) => ({ id: record.taskId, stableId: record.stableId, teacherId: teachers[0] })) });
    await prisma.assessmentTaskVersion.createMany({ data: records.map((record, index) => ({ id: record.id, taskId: record.taskId, version: 1, contentHash: seed.hash, title: record.stableId, gradeBand: 'grade_10_11', type: 'short_number', topicPath: ['Дубли'], searchText: record.stableId,
      data: { task: { ...seed.task, id: record.stableId, source: { provider: 'Benchmark', externalId: String(index) } }, statement: `Условие банка ${index} — 8888.`, solution: null, hash: seed.hash, images: [] } as Prisma.InputJsonValue,
    })) });
    await prisma.$executeRaw`UPDATE assessment_bank_tasks b SET latest_version_id = v.id FROM assessment_task_versions v WHERE v.task_id = b.id AND b.teacher_id = ${teachers[0]}::uuid AND b.stable_id LIKE 'hint-db-%'`;
    const plan = await prisma.$queryRaw<{ 'QUERY PLAN': string }[]>`EXPLAIN (COSTS OFF) SELECT id FROM assessment_task_versions WHERE (lower(btrim(normalize(data#>>'{task,source,provider}', NFC))) = 'benchmark' AND lower(btrim(normalize(data#>>'{task,source,externalId}', NFC))) = '1999') OR md5(btrim(regexp_replace(normalize(data->>'statement', NFC), '[[:space:]]+', ' ', 'g'))) = md5('Условие банка 1999 — 8888.')`;
    const explanation = plan.map((row) => row['QUERY PLAN']).join('\n');
    expect(explanation).toContain('assessment_task_versions_source_hint_idx');
    expect(explanation).toContain('assessment_task_versions_statement_hint_idx');
    const preview = await api(`${root}/imports/preview`, 'POST', await duplicatePackage(Array.from({ length: 500 }, (_, index) => ({ id: `hint-batch-${index}`, statement: index < 8 ? 'Общее условие 9999.' : `Уникальное условие ${index} — 9999.` }))));
    const imported = StoredAssessmentImportSchema.parse((await prisma.assessmentBankImport.findUniqueOrThrow({ where: { id: preview.data.id } })).data);
    const actualPlan = await prisma.$queryRaw<{ 'QUERY PLAN': string }[]>(Prisma.sql`EXPLAIN (COSTS OFF) ${assessmentDuplicateQuery(teachers[0], imported.map(({ task, statement }) => ({ stable_id: task.id, title: task.title, source: task.source, statement })))}`);
    const actualExplanation = actualPlan.map((row) => row['QUERY PLAN']).join('\n');
    expect(actualExplanation).toContain('assessment_task_versions_source_hint_idx');
    expect(actualExplanation).toContain('assessment_task_versions_statement_hint_idx');
    const start = performance.now();
    const hints = AssessmentDuplicateHintsSchema.parse((await api(`${root}/imports/${preview.data.id}/duplicates`)).data);
    const elapsed = performance.now() - start;
    expect(hints.status).toBe('complete');
    expect(hints.tasks).toHaveLength(8);
    expect(hints.tasks.every((task) => task.matches.length === 5 && task.hasMore)).toBe(true);
    expect(elapsed).toBeLessThan(5000);
    console.info(`duplicate hints: 500 inputs / 2000 bank tasks, ${elapsed.toFixed(0)} ms; both indexes in EXPLAIN`);
  }, 30000);

  it('serializes undo against a new deletion and a changing import', async () => {
    const path = `${root}/tasks/${taskIds[0]}`;
    const before = (await api(path)).data;
    const removed = (await api(path, 'DELETE', { expectedVersion: before.version, expectedLifecycleRevision: before.lifecycleRevision })).data;
    const undo = { expectedVersion: before.version, expectedDeletionRevision: removed.deletionRevision };
    const race = await Promise.all([api(`${path}/restore`, 'POST', undo), api(path, 'DELETE', { expectedVersion: before.version, expectedLifecycleRevision: removed.deletionRevision + 1 })]);
    expect(race[0].status).toBe(201);
    expect([200, 409]).toContain(race[1].status);
    if (race[1].status === 200) {
      expect((await api(`${path}/restore`, 'POST', undo)).status).toBe(409);
      expect((await api(`${path}/restore`, 'POST', { ...undo, expectedDeletionRevision: race[1].data.deletionRevision })).status).toBe(201);
    }
    const active = (await api(path)).data;
    const next = (await api(path, 'DELETE', { expectedVersion: active.version, expectedLifecycleRevision: active.lifecycleRevision })).data;
    const preview = await api(`${root}/imports/preview`, 'POST', await changedPackage());
    const importRace = await Promise.all([api(`${path}/restore`, 'POST', { expectedVersion: active.version, expectedDeletionRevision: next.deletionRevision }), api(`${root}/imports/${preview.data.id}/confirm`, 'POST')]);
    expect(importRace.filter((result) => result.status === 201)).toHaveLength(1);
    expect(importRace.filter((result) => result.status === 409)).toHaveLength(1);
    const final = (await api(path)).data;
    expect(final.version).toBe(active.version + Number(importRace[1].status === 201));
    expect((await api(path)).status).toBe(200);
  }, 30000);
});
