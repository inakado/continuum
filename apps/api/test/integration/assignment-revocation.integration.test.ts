import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { IdentityProvisioningService } from '../../src/auth/identity-provisioning.service';
import { createBetterAuth } from '../../src/auth/better-auth.factory';
import { ObjectStorageService } from '../../src/infra/storage/object-storage.service';
import { resolveObjectStorageConfig } from '../../src/infra/storage/object-storage.config';

const db = new PrismaService(), identities = new IdentityProvisioningService(db), storage = new ObjectStorageService(resolveObjectStorageConfig());
const root = '/teacher/assessment-assignments', studentRoot = '/student/assessment-works', origin = 'http://localhost:3001', password = 'Local-revoke-123';
const users: string[] = [], workIds: string[] = [], classIds: string[] = [], keys = new Set<string>();
const taskId = randomUUID(), extendedId = randomUUID();
let teacherId = '', teacher = '', other = '', agent = '';
const pupils: { id: string; cookie: string }[] = [];
let snapshot: object, image: Buffer;
const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
async function login(username: string) {
  const response = await createBetterAuth(db).api.signInUsername({ body: { username, password }, asResponse: true, headers: new Headers({ origin }) });
  return response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
}
async function api(path: string, method = 'GET', body?: object | Buffer, cookie = teacher, requestOrigin = origin, token = '', type = 'application/json') {
  const response = await fetch(`http://localhost:3000${path}`, { method, headers: { origin: requestOrigin, cookie, 'content-type': type, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body) });
  return { status: response.status, data: response.headers.get('content-type')?.includes('json') ? await response.json() : Buffer.from(await response.arrayBuffer()) };
}
async function pupil(classId: string) {
  const username = `revoke-s-${randomUUID()}`;
  const result = await identities.createStudent({ login: username, password, leadTeacherId: teacherId, firstName: 'Тест', lastName: 'Отзыв' });
  users.push(result.user.id);
  await db.studentProfile.update({ where: { userId: result.user.id }, data: { classId } });
  const row = { id: result.user.id, cookie: await login(username) }; pupils.push(row); return row;
}
async function assigned() {
  const work = await db.assessmentWork.create({ data: { id: randomUUID(), teacherId, title: 'Термодинамика — отзыв', gradeBand: 'grade_10_11', items: [] } });
  workIds.push(work.id);
  const version = await db.assessmentWorkVersion.create({ data: { workId: work.id, number: 1, revision: 1, data: JSON.parse(JSON.stringify(snapshot)) } });
  const prepared = (await api(`${root}/works/${work.id}/prepare?version=1`)).data;
  const input = { requestId: randomUUID(), selection: prepared.selection, classes: prepared.classes.filter((item: { id: string }) => classIds.includes(item.id)).map((item: { id: string; rosterHash: string }) => ({ id: item.id, rosterHash: item.rosterHash })) };
  const response = await api(`${root}/works/${work.id}`, 'POST', input);
  expect(response.status, JSON.stringify(response.data)).toBe(201);
  const assignments = await db.assessmentAssignment.findMany({ where: { versionId: version.id }, orderBy: { classTitle: 'asc' } });
  const recipients = await db.assessmentRecipient.findMany({ where: { versionId: version.id } });
  return { work, version, input, assignments, recipients };
}
beforeAll(async () => {
  await db.$connect();
  for (let i = 0; i < 2; i++) {
    const username = `revoke-t-${randomUUID()}`;
    const user = await identities.createTeacher({ login: username, password, firstName: 'Тест', lastName: 'Отзыв', middleName: null }); users.push(user.user.id);
    if (!i) { teacherId = user.user.id; teacher = await login(username); } else other = await login(username);
  }
  for (const letter of ['А', 'Б']) classIds.push((await db.schoolClass.create({ data: { teacherId, title: `11${letter} · отзыв ${randomUUID().slice(0, 8)}`, grade: 11, academicYear: 2026 } })).id);
  await pupil(classIds[0]); await pupil(classIds[0]); await pupil(classIds[1]);
  const numeric = JSON.parse(await readFile(resolve(__dirname, '../../../../examples/assessment-package/pilot-v1/tasks/shkolkovo-12246/task.json'), 'utf8'));
  const extended = JSON.parse(await readFile(resolve(__dirname, '../../../../examples/assessment-package/extended-v1/tasks/shkolkovo-14449/task.json'), 'utf8'));
  snapshot = { title: 'Термодинамика — отзыв', instructions: '', gradeBand: 'grade_10_11', items: [[taskId, numeric], [extendedId, extended]].map(([id, task]) => ({ taskId: id, version: 1, data: { task, statement: 'Найдите ответ.', solution: null, hash: 'a'.repeat(64), images: [] } })) };
  image = await readFile(resolve(__dirname, '../../../../examples/assessment-package/extended-v1/tasks/shkolkovo-14449/images/process.png'));
  const issued = await api('/teacher/reviewer-access/keys', 'POST', { name: 'QA отзыва', password, classIds, studentIds: [] });
  expect(issued.status).toBe(201); agent = issued.data.key;
}, 30000);
afterAll(async () => {
  const scope = { version: { workId: { in: workIds } } };
  const photos = await db.assessmentSolutionPhoto.findMany({ where: { answer: { recipient: scope } } });
  const reports = await db.assessmentReviewReport.findMany({ where: { solution: { recipient: scope } } });
  for (const file of [...photos, ...reports]) keys.add(file.objectKey);
  for (const key of keys) await storage.deleteObject(key);
  await db.assessmentFileDeletion.deleteMany({ where: { objectKey: { in: [...keys] } } });
  await db.reviewerWriteReceipt.deleteMany({ where: { userId: teacherId } });
  await db.assessmentReview.deleteMany({ where: { solution: { recipient: scope } } });
  await db.assessmentRecipient.deleteMany({ where: scope });
  await db.assessmentAssignment.deleteMany({ where: scope });
  await db.assessmentAssignmentRevocation.deleteMany({ where: { teacherId } });
  await db.assessmentAssignmentRequest.deleteMany({ where: { workId: { in: workIds } } });
  await db.assessmentWorkVersion.deleteMany({ where: { workId: { in: workIds } } });
  await db.assessmentWork.deleteMany({ where: { id: { in: workIds } } });
  await db.studentProfile.deleteMany({ where: { userId: { in: users } } });
  await db.schoolClass.deleteMany({ where: { id: { in: classIds } } });
  await db.apikey.deleteMany({ where: { referenceId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
}, 30000);

it('requires teacher ownership, trusted Origin, strict body and the exact current recipients', async () => {
  const fixture = await assigned(), id = fixture.assignments[0].id, path = `${root}/classes/${id}`;
  expect((await api(`${path}/revocation`, 'GET', undefined, '')).status).toBe(401);
  expect((await api(`${path}/revocation`, 'GET', undefined, other)).status).toBe(404);
  expect((await api(`${path}/revocation`, 'GET', undefined, pupils[0].cookie)).status).toBe(403);
  const preview = (await api(`${path}/revocation`)).data;
  const input = { expectedRecipientsHash: preview.recipientsHash };
  expect(preview).toMatchObject({ studentCount: 2, startedCount: 0, completedCount: 0 });
  expect((await api(path, 'DELETE', input, other)).status).toBe(404);
  expect((await api(path, 'DELETE', input, pupils[0].cookie)).status).toBe(403);
  expect((await api(path, 'DELETE', input, teacher, 'https://foreign.example')).status).toBe(403);
  expect((await api(path, 'DELETE', { ...input, deleteAll: true })).status).toBe(400);
  expect((await api(path, 'DELETE', {})).status).toBe(400);
  await db.assessmentRecipient.create({ data: { assignmentId: id, versionId: fixture.version.id, studentName: 'Новый получатель', studentLogin: 'qa-new' } });
  expect((await api(path, 'DELETE', input)).status).toBe(409);
  expect(await db.assessmentRecipient.count({ where: { assignmentId: id } })).toBe(3);
});

it('deletes started/completed answers, real photos, PDF reviews and receipts only for the chosen assignment; old retries cannot affect a new assignment', async () => {
  const fixture = await assigned();
  const target = fixture.assignments.find((item) => item.classId === classIds[0])!;
  const own = fixture.recipients.find((item) => item.studentId === pupils[0].id)!;
  const finished = fixture.recipients.find((item) => item.studentId === pupils[1].id)!;
  const kept = fixture.recipients.find((item) => item.studentId === pupils[2].id)!;
  for (const [recipient, pupil] of [[own, pupils[0]], [finished, pupils[1]], [kept, pupils[2]]] as const) {
    expect((await api(`${studentRoot}/${recipient.id}/start`, 'POST', undefined, pupil.cookie)).status).toBe(200);
    expect((await api(`${studentRoot}/${recipient.id}/answers/${taskId}`, 'PATCH', { requestId: randomUUID(), expectedRevision: 1, answer: { type: 'short_number', value: '300' } }, pupil.cookie)).status).toBe(200);
    const photoId = randomUUID();
    expect((await api(`/assessment-solutions/${recipient.id}/items/${extendedId}/photos/${photoId}?revision=0`, 'PUT', image, pupil.cookie, origin, '', 'image/png')).status).toBe(200);
  }
  expect((await api(`${studentRoot}/${finished.id}/finish`, 'POST', { expectedRevision: 2 }, pupils[1].cookie)).status).toBe(200);
  const solution = await db.assessmentSolutionAnswer.findFirstOrThrow({ where: { recipientId: own.id } });
  const reportId = randomUUID();
  expect((await api(`/reviewer/v1/reports/${reportId}`, 'PUT', { solutionId: solution.id, sourceRevision: 1 }, '', origin, agent)).status).toBe(200);
  expect((await api(`/reviewer/v1/reports/${reportId}/file`, 'PUT', pdf, '', origin, agent, 'application/pdf')).status).toBe(200);
  const draft = await api(`/reviewer/v1/solutions/${solution.id}/draft`, 'PUT', { requestId: randomUUID(), sourceRevision: 1, expectedReviewRevision: 0, points: 2, reportId }, '', origin, agent);
  expect(draft.status).toBe(200);
  const publication = { requestId: randomUUID(), items: [{ reviewId: draft.data.id, reviewRevision: 1, sourceRevision: 1, expectedPublishedRevision: null }] };
  expect((await api('/reviewer/v1/publications', 'POST', publication, '', origin, agent)).status).toBe(201);
  const deletedKeys = [...await db.assessmentSolutionPhoto.findMany({ where: { answer: { recipient: { assignmentId: target.id } } } }), ...await db.assessmentReviewReport.findMany({ where: { solution: { recipient: { assignmentId: target.id } } } })].map((file) => file.objectKey);
  deletedKeys.forEach((key) => keys.add(key));
  const keptBefore = await db.assessmentRecipient.findUniqueOrThrow({ where: { id: kept.id } });
  const keptPhotos = await db.assessmentSolutionPhoto.findMany({ where: { answer: { recipientId: kept.id } } });
  const path = `${root}/classes/${target.id}`;
  const preview = (await api(`${path}/revocation`)).data;
  expect(preview).toMatchObject({ studentCount: 2, startedCount: 2, completedCount: 1 });
  // A transferred pupil still belongs to the original assignment's deletion scope.
  await db.studentProfile.update({ where: { userId: own.studentId! }, data: { classId: classIds[1] } });
  const input = { expectedRecipientsHash: preview.recipientsHash };
  const pair = await Promise.all([api(path, 'DELETE', input), api(`${studentRoot}/${own.id}/finish`, 'POST', { expectedRevision: 2 }, pupils[0].cookie)]);
  expect(pair[0].status, JSON.stringify(pair[0].data)).toBe(200);
  expect([200, 404]).toContain(pair[1].status);
  expect(await db.assessmentAssignment.findUnique({ where: { id: target.id } })).toBeNull();
  expect(await db.assessmentRecipient.count({ where: { assignmentId: target.id } })).toBe(0);
  expect(await db.assessmentSolutionAnswer.count({ where: { recipientId: { in: [own.id, finished.id] } } })).toBe(0);
  expect(await db.assessmentReview.findUnique({ where: { id: draft.data.id } })).toBeNull();
  expect(await db.assessmentReviewReport.findUnique({ where: { id: reportId } })).toBeNull();
  expect(await db.reviewerWriteReceipt.count({ where: { assignmentId: target.id } })).toBe(0);
  expect(await db.assessmentRecipient.findUnique({ where: { id: kept.id } })).toEqual(keptBefore);
  expect(await db.assessmentSolutionPhoto.findMany({ where: { answer: { recipientId: kept.id } } })).toEqual(keptPhotos);
  expect(await db.assessmentWorkVersion.findUnique({ where: { id: fixture.version.id } })).toEqual(fixture.version);
  expect(await db.assessmentWork.findUnique({ where: { id: fixture.work.id } })).toEqual(fixture.work);
  expect((await api(`${root}/${fixture.version.id}`)).data.studentCount).toBe(1);
  for (const suffix of ['', '/availability']) expect((await api(`${studentRoot}/${own.id}${suffix}`, 'GET', undefined, pupils[0].cookie)).status).toBe(404);
  expect((await api(`${studentRoot}/${own.id}/start`, 'POST', undefined, pupils[0].cookie)).status).toBe(404);
  expect((await api(`${studentRoot}/${own.id}/answers/${taskId}`, 'PATCH', { requestId: randomUUID(), expectedRevision: 2, answer: null }, pupils[0].cookie)).status).toBe(404);
  expect((await api(`/assessment-solutions/${own.id}`, 'GET', undefined, pupils[0].cookie)).status).toBe(404);
  expect((await api(studentRoot, 'GET', undefined, pupils[0].cookie)).data.some((row: { id: string }) => row.id === own.id)).toBe(false);
  for (const route of [`solutions/${solution.id}`, `reports/${reportId}/file`, `publications/${publication.requestId}`, `assignments/${target.id}/solutions`]) expect((await api(`/reviewer/v1/${route}`, 'GET', undefined, '', origin, agent)).status).toBe(404);
  expect((await api('/reviewer/v1/publications', 'POST', publication, '', origin, agent)).status).toBe(404);
  expect((await api(`${root}/works/${fixture.work.id}`, 'POST', fixture.input)).status).toBe(409);
  const prepared = (await api(`${root}/works/${fixture.work.id}/prepare?version=1`)).data;
  const group = prepared.classes.find((item: { id: string }) => item.id === classIds[0]);
  expect(group.assignmentId).toBeNull();
  expect((await api(`${root}/works/${fixture.work.id}`, 'POST', { requestId: randomUUID(), selection: prepared.selection, classes: [{ id: group.id, rosterHash: group.rosterHash }] })).status).toBe(201);
  const renewed = await db.assessmentAssignment.findFirstOrThrow({ where: { versionId: fixture.version.id, classId: classIds[0] } });
  expect(renewed.id).not.toBe(target.id);
  expect((await api(path, 'DELETE', input)).status).toBe(200);
  expect((await api(path, 'DELETE', input, other)).status).toBe(404);
  expect(await db.assessmentAssignment.findUnique({ where: { id: renewed.id } })).not.toBeNull();
  const fresh = await db.assessmentRecipient.findFirstOrThrow({ where: { assignmentId: renewed.id } });
  expect(fresh).toMatchObject({ startedAt: null, completedAt: null, points: null, answers: {} });
  expect(fresh.id).not.toBe(finished.id);
  await expect.poll(async () => db.assessmentFileDeletion.count({ where: { objectKey: { in: deletedKeys } } }), { timeout: 5000 }).toBe(0);
  for (const key of deletedKeys) await expect(storage.getObjectStream(key)).rejects.toThrow();
  expect((await api(`/assessment-solutions/${kept.id}`, 'GET', undefined, pupils[2].cookie)).data[0].photos).toHaveLength(1);
}, 30000);

it('removes the last class from reports and lists, including an assignment with no recipients', async () => {
  const fixture = await assigned();
  for (const assignment of fixture.assignments) {
    if (assignment.classId === classIds[0]) await db.assessmentRecipient.deleteMany({ where: { assignmentId: assignment.id } });
    const path = `${root}/classes/${assignment.id}`;
    const preview = (await api(`${path}/revocation`)).data;
    expect((await api(path, 'DELETE', { expectedRecipientsHash: preview.recipientsHash })).status).toBe(200);
  }
  expect((await api(`${root}/${fixture.version.id}`)).status).toBe(404);
  expect((await api(root)).data.some((row: { versionId: string }) => row.versionId === fixture.version.id)).toBe(false);
});

it('serializes revocation with an in-flight photo upload without leaving an orphaned object or answer', async () => {
  const fixture = await assigned();
  const recipient = fixture.recipients.find((item) => item.studentId === pupils[1].id)!;
  const target = fixture.assignments.find((item) => item.id === recipient.assignmentId)!;
  expect((await api(`${studentRoot}/${recipient.id}/start`, 'POST', undefined, pupils[1].cookie)).status).toBe(200);
  const path = `${root}/classes/${target.id}`, preview = (await api(`${path}/revocation`)).data;
  const photoId = randomUUID(), key = `assessment-solutions/${recipient.id}/${extendedId}/${photoId}`;
  keys.add(key);
  const pair = await Promise.all([
    api(`/assessment-solutions/${recipient.id}/items/${extendedId}/photos/${photoId}?revision=0`, 'PUT', image, pupils[1].cookie, origin, '', 'image/png'),
    api(path, 'DELETE', { expectedRecipientsHash: preview.recipientsHash }),
  ]);
  expect([200, 404]).toContain(pair[0].status);
  expect(pair[1].status, JSON.stringify(pair[1].data)).toBe(200);
  expect(await db.assessmentSolutionPhoto.count({ where: { id: photoId } })).toBe(0);
  await expect.poll(() => db.assessmentFileDeletion.count({ where: { objectKey: key } }), { timeout: 5000 }).toBe(0);
  await expect(storage.getObjectStream(key)).rejects.toThrow();
});

it('serializes revocation with adding recipients and never silently widens the confirmed deletion scope', async () => {
  for (let n = 0; n < 3; n++) {
    const fixture = await assigned(), target = fixture.assignments.find((item) => item.classId === classIds[0])!;
    const path = `${root}/classes/${target.id}`, preview = (await api(`${path}/revocation`)).data;
    const added = await pupil(classIds[0]);
    const prepared = (await api(`${root}/works/${fixture.work.id}/prepare?version=1`)).data;
    const group = prepared.classes.find((item: { id: string }) => item.id === classIds[0]);
    const pair = await Promise.all([
      api(`${root}/works/${fixture.work.id}`, 'POST', { requestId: randomUUID(), selection: prepared.selection, classes: [{ id: group.id, rosterHash: group.rosterHash }] }),
      api(path, 'DELETE', { expectedRecipientsHash: preview.recipientsHash }),
    ]);
    if (pair[1].status === 200) {
      expect(pair[0].status, JSON.stringify(pair)).toBe(409);
      expect(await db.assessmentAssignment.findUnique({ where: { id: target.id } })).toBeNull();
    } else {
      expect(pair.map((item) => item.status).sort(), JSON.stringify(pair)).toEqual([201, 409]);
      expect(await db.assessmentRecipient.findFirst({ where: { assignmentId: target.id, studentId: added.id } })).not.toBeNull();
    }
  }
}, 30000);
