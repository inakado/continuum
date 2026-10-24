import 'reflect-metadata';
import { randomUUID, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { IdentityProvisioningService } from '../../src/auth/identity-provisioning.service';
import { createBetterAuth } from '../../src/auth/better-auth.factory';
import { ObjectStorageService } from '../../src/infra/storage/object-storage.service';
import { resolveObjectStorageConfig } from '../../src/infra/storage/object-storage.config';

const db = new PrismaService(), identities = new IdentityProvisioningService(db), storage = new ObjectStorageService(resolveObjectStorageConfig());
const origin = 'http://localhost:3001', password = 'Local-review-123';
const users: string[] = [], assignmentIds: string[] = [], workIds: string[] = [];
const taskIds = [randomUUID(), randomUUID()];
const graphKey = `reviewer-integration/${randomUUID()}.png`;
let teacher = '', colleague = '', student = '', teacherId = '', colleagueId = '', studentId = '', recipientId = '', classId = '', otherClassId = '', assignmentId = '', outsideRecipientId = '', outsideSolutionId = '', outsideStudentId = '', publishedRequestId = '';
let key = '', secondKey = '', colleagueKey = '', keyId = '', secondKeyId = '', photo: Buffer;
let solutions: string[] = [];
const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n');
async function cookie(login: string) {
  const response = await createBetterAuth(db).api.signInUsername({ body: { username: login, password }, headers: new Headers({ origin }), asResponse: true });
  return response.headers.getSetCookie().map((value) => value.split(';')[0]).join('; ');
}
async function api(path: string, method = 'GET', body?: object | Buffer, token = key, session = '', contentType = 'application/json') {
  const response = await fetch(`http://localhost:3000${path}`, { method, headers: { origin, 'content-type': contentType, ...(token ? { authorization: `Bearer ${token}` } : {}), ...(session ? { cookie: session } : {}) }, body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body) });
  const bytes = Buffer.from(await response.arrayBuffer());
  return { status: response.status, data: response.headers.get('content-type')?.includes('json') ? JSON.parse(bytes.toString()) : bytes, headers: response.headers };
}
async function device(name: string, session = teacher, targets = { classIds: [classId], studentIds: [] as string[] }) {
  const result = await api('/teacher/reviewer-access/keys', 'POST', { name, password, ...targets }, '', session);
  expect(result.status).toBe(201);
  return result.data;
}
async function report(solutionId: string, revision: number, token = key) {
  const id = randomUUID();
  expect((await api(`/reviewer/v1/reports/${id}`, 'PUT', { solutionId, sourceRevision: revision }, token)).status).toBe(200);
  const uploaded = await api(`/reviewer/v1/reports/${id}/file`, 'PUT', pdf, token, '', 'application/pdf');
  expect(uploaded.status).toBe(200);
  expect(uploaded.data).toMatchObject({ id, ready: true, sha256: createHash('sha256').update(pdf).digest('hex') });
  return id;
}
beforeAll(async () => {
  await db.$connect();
  for (let n = 0; n < 2; n++) {
    const login = `review-t-${randomUUID()}`;
    const identity = await identities.createTeacher({ login, password, firstName: 'Тест', lastName: 'Проверяющий', middleName: null });
    users.push(identity.user.id);
    if (!n) { teacherId = identity.user.id; teacher = await cookie(login); }
    else { colleagueId = identity.user.id; colleague = await cookie(login); }
  }
  classId = (await db.schoolClass.create({ data: { teacherId, title: `11 Проверка ${randomUUID()}`, grade: 11, academicYear: 2026 } })).id;
  otherClassId = (await db.schoolClass.create({ data: { teacherId: colleagueId, title: `11 Другая ${randomUUID()}`, grade: 11, academicYear: 2026 } })).id;
  const login = `review-s-${randomUUID()}`;
  const pupil = await identities.createStudent({ login, password, leadTeacherId: teacherId, firstName: 'Тест', lastName: 'Ученик' });
  studentId = pupil.user.id;
  users.push(pupil.user.id); student = await cookie(login);
  await db.studentProfile.update({ where: { userId: studentId }, data: { classId } });
  const outside = await identities.createStudent({ login: `review-s-${randomUUID()}`, password, leadTeacherId: colleagueId, firstName: 'Другой', lastName: 'Ученик' });
  outsideStudentId = outside.user.id; users.push(outsideStudentId);
  const task = JSON.parse(await readFile(resolve(__dirname, '../../../../examples/assessment-package/extended-v1/tasks/shkolkovo-14449/task.json'), 'utf8'));
  photo = await readFile(resolve(__dirname, '../../../../examples/assessment-package/extended-v1/tasks/shkolkovo-14449/images/process.png'));
  await storage.putObject({ key: graphKey, body: photo, contentType: 'image/png' });
  const workId = randomUUID(); workIds.push(workId);
  await db.assessmentWork.create({ data: { id: workId, teacherId, title: 'Проверка API', gradeBand: 'grade_10_11', items: [] } });
  const version = await db.assessmentWorkVersion.create({ data: { workId, number: 1, revision: 1, data: { title: 'Проверка API', instructions: '', gradeBand: 'grade_10_11', items: taskIds.map((taskId) => ({ taskId, version: 1, data: { task, statement: 'Условие $p_1 = 100$. ![График](images/process.png)', solution: null, hash: 'a'.repeat(64), images: [{ path: 'images/process.png', key: graphKey, hash: 'b'.repeat(64), contentType: 'image/png' }] } })) } } });
  const assignment = await db.assessmentAssignment.create({ data: { versionId: version.id, classId, classTitle: '11 Проверка', academicYear: 2026 } });
  assignmentId = assignment.id; assignmentIds.push(assignmentId);
  const recipient = await db.assessmentRecipient.create({ data: { assignmentId, versionId: version.id, studentId: pupil.user.id, studentName: 'Тест Ученик', studentLogin: login, startedAt: new Date() } });
  recipientId = recipient.id;
  outsideRecipientId = (await db.assessmentRecipient.create({ data: { assignmentId, versionId: version.id, studentId: outsideStudentId, studentName: 'Другой Ученик', studentLogin: outside.user.login, startedAt: new Date() } })).id;
  expect((await api(`/assessment-solutions/${outsideRecipientId}/items/${taskIds[0]}/photos/${randomUUID()}?revision=0`, 'PUT', photo, '', await cookie(outside.user.login), 'image/png')).status).toBe(200);
  outsideSolutionId = (await db.assessmentSolutionAnswer.findFirstOrThrow({ where: { recipientId: outsideRecipientId } })).id;
  for (const taskId of taskIds) expect((await api(`/assessment-solutions/${recipientId}/items/${taskId}/photos/${randomUUID()}?revision=0`, 'PUT', photo, '', student, 'image/png')).status).toBe(200);
  solutions = (await db.assessmentSolutionAnswer.findMany({ where: { recipientId }, orderBy: { taskId: 'asc' } })).map((row) => row.id);
}, 30000);
afterAll(async () => {
  const recipientIds = [recipientId, outsideRecipientId].filter(Boolean);
  const reports = await db.assessmentReviewReport.findMany({ where: { solution: { recipientId: { in: recipientIds } } } });
  const photos = await db.assessmentSolutionPhoto.findMany({ where: { answer: { recipientId: { in: recipientIds } } } });
  for (const item of [...reports, ...photos]) await storage.deleteObject(item.objectKey);
  await storage.deleteObject(graphKey);
  await db.reviewerWriteReceipt.deleteMany({ where: { assignmentId: { in: assignmentIds } } });
  await db.assessmentReview.deleteMany({ where: { solution: { recipientId: { in: recipientIds } } } });
  await db.assessmentReviewReport.deleteMany({ where: { solution: { recipientId: { in: recipientIds } } } });
  await db.assessmentRecipient.deleteMany({ where: { id: { in: recipientIds } } });
  await db.assessmentAssignment.deleteMany({ where: { id: { in: assignmentIds } } });
  await db.assessmentWorkVersion.deleteMany({ where: { workId: { in: workIds } } });
  await db.assessmentWork.deleteMany({ where: { id: { in: workIds } } });
  await db.studentProfile.updateMany({ where: { userId: { in: users } }, data: { classId: null } });
  await db.schoolClass.deleteMany({ where: { id: { in: [classId, otherClassId].filter(Boolean) } } });
  await db.apikey.deleteMany({ where: { referenceId: { in: users } } });
  await db.studentProfile.deleteMany({ where: { userId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
}, 30000);

it('issues independent scoped device keys with bounded TTL, hashed secrets and no teacher-session or generic-plugin bypass', async () => {
  expect((await api('/reviewer/v1/me', 'GET', undefined, '', teacher)).status).toBe(401);
  expect((await api('/teacher/reviewer-access/keys', 'POST', { name: 'Mac', password: 'wrong', classIds: [classId], studentIds: [] }, '', teacher)).status).toBe(401);
  expect((await api('/auth/api-key/create', 'POST', { name: 'bypass' }, '', teacher)).status).toBe(404);
  const first = await device('Мой Mac'); key = first.key; keyId = first.entry.id;
  const second = await device('Другой Mac'); secondKey = second.key; secondKeyId = second.entry.id;
  expect(key).not.toBe(secondKey);
  expect(Date.parse(first.entry.expiresAt) - Date.now()).toBeGreaterThan(29 * 86400000);
  expect(Date.parse(first.entry.expiresAt) - Date.now()).toBeLessThanOrEqual(30 * 86400000);
  expect((await db.apikey.findUniqueOrThrow({ where: { id: keyId } })).key).not.toBe(key);
  expect((await api('/reviewer/v1/me')).data).toMatchObject({ userId: teacherId, keyId });
  expect((await api('/teacher/students')).status).toBe(401);
  const listed = await api('/teacher/reviewer-access/keys', 'GET', undefined, '', teacher);
  expect(listed.data).toHaveLength(2); expect(JSON.stringify(listed.data)).not.toContain(key);
  expect((await api('/reviewer/v1/assignments')).data.items).toHaveLength(1);
  expect((await api('/teacher/reviewer-access/keys', 'POST', { name: 'Injected', password, classIds: [classId], studentIds: [], userId: colleagueId }, '', teacher)).status).toBe(400);
  expect((await api('/teacher/reviewer-access/keys', 'POST', { name: 'Injected', password, classIds: [classId], studentIds: [], scopes: ['read'] }, '', teacher)).status).toBe(400);
  expect((await api('/teacher/reviewer-access/keys', 'POST', { name: 'Missing', password, classIds: [], studentIds: [] }, '', teacher)).status).toBe(400);
});

it('lets both teachers use the common roster but limits each agent to selected students, including those without a class', async () => {
  const targets = await api('/teacher/reviewer-access/targets', 'GET', undefined, '', colleague);
  expect(targets.status).toBe(200);
  expect(targets.data.classes).toEqual(expect.arrayContaining([expect.objectContaining({ id: classId })]));
  expect(targets.data.students).toEqual(expect.arrayContaining([expect.objectContaining({ id: outsideStudentId, classId: null })]));
  const peer = await device('Коллега', colleague); colleagueKey = peer.key;
  expect((await api(`/reviewer/v1/solutions/${solutions[0]}`, 'GET', undefined, colleagueKey)).status).toBe(200);
  expect((await api(`/reviewer/v1/solutions/${outsideSolutionId}`)).status).toBe(404);
  const list = await api(`/reviewer/v1/assignments/${assignmentId}/solutions`);
  expect(list.data.items.map((row: { id: string }) => row.id).sort()).toEqual([...solutions].sort());
  const individual = await device('Ученик без класса', colleague, { classIds: [], studentIds: [outsideStudentId] });
  expect((await api(`/reviewer/v1/solutions/${outsideSolutionId}`, 'GET', undefined, individual.key)).status).toBe(200);
  expect((await api(`/reviewer/v1/solutions/${solutions[0]}`, 'GET', undefined, individual.key)).status).toBe(404);
  expect((await api(`/teacher/reviewer-access/keys/${keyId}`, 'DELETE', undefined, '', colleague)).status).toBe(404);
});
it('searches immutable assigned titles after the draft is renamed, including case-insensitive matches and class names', async () => {
  await db.assessmentWork.update({ where: { id: workIds[0] }, data: { title: 'Другое название черновика' } });
  try {
    const bySnapshot = await api(`/reviewer/v1/assignments?query=${encodeURIComponent('проверка api')}`);
    expect(bySnapshot.status).toBe(200);
    expect(bySnapshot.data.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: assignmentId, title: 'Проверка API' })]));
    const byDraft = await api(`/reviewer/v1/assignments?query=${encodeURIComponent('Другое название черновика')}`);
    expect(byDraft.data.items).toEqual([]);
    const byClass = await api(`/reviewer/v1/assignments?query=${encodeURIComponent('11 Проверка')}`);
    expect(byClass.data.items).toEqual(expect.arrayContaining([expect.objectContaining({ id: assignmentId })]));
  } finally {
    await db.assessmentWork.update({ where: { id: workIds[0] }, data: { title: 'Проверка API' } });
  }
});

it('reports received photo tasks independently of automatic completion and private review drafts', async () => {
  const outsideAnswer = await db.assessmentSolutionAnswer.create({ data: { recipientId: outsideRecipientId, taskId: taskIds[1] } });
  await db.assessmentSolutionPhoto.createMany({ data: [
    { id: randomUUID(), answerId: outsideAnswer.id, objectKey: `reviewer-integration/${randomUUID()}`, contentHash: 'a'.repeat(64), contentType: 'image/png', sizeBytes: 1 },
    { id: randomUUID(), answerId: outsideAnswer.id, objectKey: `reviewer-integration/${randomUUID()}`, contentHash: 'a'.repeat(64), contentType: 'image/png', sizeBytes: 1, confirmedAt: new Date(), removedAt: new Date() },
  ] });
  const list = await api('/student/assessment-works', 'GET', undefined, '', student);
  expect(list.data.find((row: { id: string }) => row.id === recipientId)).toMatchObject({ automaticTaskCount: 0, extendedTaskCount: 2,
    progress: { photoTaskCount: 2, publishedReviewTaskCount: 0, resultReady: false } });
  const recipient = await db.assessmentRecipient.findUniqueOrThrow({ where: { id: recipientId } });
  const overview = await api('/teacher/assessment-assignments', 'GET', undefined, '', teacher);
  expect(overview.data.find((row: { versionId: string }) => row.versionId === recipient.versionId)).toMatchObject({ studentCount: 2, completedCount: 0, allPhotosCount: 1, allReviewsPublishedCount: 0 });
  const execution = await api(`/teacher/assessment-assignments/${recipient.versionId}`, 'GET', undefined, '', teacher);
  expect(execution.data.recipients.find((row: { id: string }) => row.id === outsideRecipientId).progress.photoTaskCount).toBe(1);
});

it('downloads actual photos/images and publishes only complete current reviews; two clients cannot overwrite drafts or publish stale photo sets', async () => {
  const id = solutions[0];
  const detail = (await api(`/reviewer/v1/solutions/${id}`)).data;
  expect(detail.photos).toHaveLength(1); expect(detail).not.toHaveProperty('grading');
  expect((await api(detail.photos[0].downloadPath)).data).toEqual(photo);
  expect((await api(detail.images[0].downloadPath)).data).toEqual(photo);
  const reportId = await report(id, 1);
  expect((await api(`/reviewer/v1/reports/${reportId}/file`, 'PUT', Buffer.from('%PDF-1.4\nchanged\n%%EOF'), key, '', 'application/pdf')).status).toBe(409);
  const input = { requestId: randomUUID(), sourceRevision: 1, expectedReviewRevision: 0, points: 1, reportId };
  const saved = await api(`/reviewer/v1/solutions/${id}/draft`, 'PUT', input);
  expect(saved.status).toBe(200);
  expect((await api(`/reviewer/v1/solutions/${id}/draft`, 'PUT', input, secondKey)).data).toEqual(saved.data);
  expect((await api(`/reviewer/v1/solutions/${id}/draft`, 'PUT', { ...input, points: 2 })).status).toBe(409);
  const taskId = detail.taskId;
  const studentPath = `/assessment-solutions/${recipientId}/items/${taskId}/review`;
  expect((await api(studentPath, 'GET', undefined, '', student)).status).toBe(404);
  expect((await api(`/assessment-solutions/${recipientId}`, 'GET', undefined, '', student)).data.every((row: { publishedReview: unknown }) => row.publishedReview === null)).toBe(true);
  expect((await api(`/assessment-solutions/${recipientId}/items/${taskId}/photos/${randomUUID()}?revision=1`, 'PUT', photo, '', student, 'image/png')).status).toBe(200);
  expect((await api(detail.photos[0].downloadPath)).status).toBe(409);
  const stale = { requestId: randomUUID(), items: [{ reviewId: saved.data.id, reviewRevision: 1, sourceRevision: 1, expectedPublishedRevision: null }] };
  expect((await api('/reviewer/v1/publications', 'POST', stale)).status).toBe(409);
  const nextReport = await report(id, 2);
  const nextInput = { ...input, requestId: randomUUID(), sourceRevision: 2, expectedReviewRevision: 1, reportId: nextReport, points: 0 };
  const concurrent = await Promise.all([key, secondKey].map((token) => api(`/reviewer/v1/solutions/${id}/draft`, 'PUT', { ...nextInput, requestId: randomUUID() }, token)));
  expect(concurrent.map((row) => row.status).sort()).toEqual([200, 409]);
  const latest = (await api(`/reviewer/v1/solutions/${id}`)).data;
  const incomplete = await api(`/reviewer/v1/solutions/${solutions[1]}/draft`, 'PUT', { requestId: randomUUID(), sourceRevision: 1, expectedReviewRevision: 0, points: null, reportId: null });
  expect(incomplete.status).toBe(200);
  const publishInput = { requestId: randomUUID(), items: [{ reviewId: latest.review.id, reviewRevision: latest.review.revision, sourceRevision: 2, expectedPublishedRevision: null }] };
  publishedRequestId = publishInput.requestId;
  const mixed = await api('/reviewer/v1/publications', 'POST', { requestId: randomUUID(), items: [...publishInput.items, { reviewId: incomplete.data.id, reviewRevision: 1, sourceRevision: 1, expectedPublishedRevision: null }] });
  expect(mixed.status).toBe(409);
  expect((await db.assessmentSolutionAnswer.findUniqueOrThrow({ where: { id } })).lockedAt).toBeNull();
  const published = await api('/reviewer/v1/publications', 'POST', publishInput);
  expect(published.status).toBe(201); expect(published.data.items[0].points).toBe(0);
  expect((await api('/reviewer/v1/publications', 'POST', publishInput, secondKey)).data).toEqual(published.data);
  expect((await api(studentPath, 'GET', undefined, '', student)).data).toEqual(pdf);
  expect((await api(studentPath, 'GET', undefined, '', colleague)).status).toBe(404);
  expect((await api(`/assessment-solutions/${recipientId}/items/${taskId}/photos/${randomUUID()}?revision=2`, 'PUT', photo, '', student, 'image/png')).status).toBe(409);
  const other = (await api(`/reviewer/v1/solutions/${solutions[1]}`)).data;
  expect((await api(`/assessment-solutions/${recipientId}/items/${other.taskId}/photos/${randomUUID()}?revision=1`, 'PUT', photo, '', student, 'image/png')).status).toBe(200);
  const correction = await api(`/reviewer/v1/solutions/${id}/draft`, 'PUT', { ...nextInput, requestId: randomUUID(), expectedReviewRevision: latest.review.revision, points: 2 });
  expect(correction.status).toBe(200);
  const publicAnswers = (await api(`/assessment-solutions/${recipientId}`, 'GET', undefined, '', student)).data;
  expect(publicAnswers.find((row: { taskId: string }) => row.taskId === taskId).publishedReview.points).toBe(0);
  const progress = { photoTaskCount: 2, publishedReviewTaskCount: 1, resultReady: false };
  const listed = await api('/student/assessment-works', 'GET', undefined, '', student);
  expect(listed.data.find((row: { id: string }) => row.id === recipientId).progress).toEqual(progress);
  const recipient = await db.assessmentRecipient.findUniqueOrThrow({ where: { id: recipientId } });
  const execution = await api(`/teacher/assessment-assignments/${recipient.versionId}`, 'GET', undefined, '', teacher);
  expect(execution.data.recipients.find((row: { id: string }) => row.id === recipientId).progress).toEqual(progress);
}, 30000);

it('serializes photo upload against publication and never publishes a mismatched revision', async () => {
  const id = solutions[1];
  const detail = (await api(`/reviewer/v1/solutions/${id}`)).data;
  const reportId = await report(id, detail.sourceRevision);
  const review = (await api(`/reviewer/v1/solutions/${id}/draft`, 'PUT', { requestId: randomUUID(), sourceRevision: detail.sourceRevision, expectedReviewRevision: detail.review.revision, points: 2, reportId })).data;
  const publication = { requestId: randomUUID(), items: [{ reviewId: review.id, reviewRevision: review.revision, sourceRevision: detail.sourceRevision, expectedPublishedRevision: null }] };
  const [published, uploaded] = await Promise.all([
    api('/reviewer/v1/publications', 'POST', publication),
    api(`/assessment-solutions/${recipientId}/items/${detail.taskId}/photos/${randomUUID()}?revision=${detail.sourceRevision}`, 'PUT', photo, '', student, 'image/png'),
  ]);
  expect([[201, 409], [409, 200]]).toContainEqual([published.status, uploaded.status]);
  const answer = await db.assessmentSolutionAnswer.findUniqueOrThrow({ where: { id }, include: { review: true } });
  if (published.status === 201) {
    expect(answer.revision).toBe(detail.sourceRevision);
    expect(answer.lockedAt).not.toBeNull();
    expect(answer.review?.publishedRevision).toBe(review.revision);
  } else {
    expect(answer.revision).toBe(detail.sourceRevision + 1);
    expect(answer.lockedAt).toBeNull();
    expect(answer.review?.publishedRevision).toBeNull();
  }
}, 30000);

it('rechecks current class membership on reads and writes while explicit student access survives transfer', async () => {
  const individual = await device('Точный ученик', teacher, { classIds: [], studentIds: [studentId] });
  await db.studentProfile.update({ where: { userId: studentId }, data: { classId: otherClassId } });
  expect((await api(`/reviewer/v1/solutions/${solutions[0]}`)).status).toBe(404);
  expect((await api(`/reviewer/v1/assignments/${assignmentId}/solutions`)).status).toBe(404);
  expect((await api(`/reviewer/v1/publications/${publishedRequestId}`)).status).toBe(404);
  expect((await api(`/reviewer/v1/solutions/${solutions[0]}/draft`, 'PUT', { requestId: randomUUID(), sourceRevision: 2, expectedReviewRevision: 3, points: 1, reportId: null })).status).toBe(404);
  expect((await api(`/reviewer/v1/solutions/${solutions[0]}`, 'GET', undefined, individual.key)).status).toBe(200);
  await db.user.update({ where: { id: studentId }, data: { isActive: false } });
  expect((await api(`/reviewer/v1/solutions/${solutions[0]}`, 'GET', undefined, individual.key)).status).toBe(404);
  await db.user.update({ where: { id: studentId }, data: { isActive: true } });
  await db.studentProfile.update({ where: { userId: studentId }, data: { classId } });
});

it('makes an extended-only result ready only after all exact reviews are published', async () => {
  for (const id of solutions) {
    const detail = (await api(`/reviewer/v1/solutions/${id}`)).data;
    const answer = await db.assessmentSolutionAnswer.findUniqueOrThrow({ where: { id }, include: { review: true } });
    if (answer.review?.publishedRevision != null) continue;
    const reportId = await report(id, detail.sourceRevision);
    const draft = (await api(`/reviewer/v1/solutions/${id}/draft`, 'PUT', { requestId: randomUUID(), sourceRevision: detail.sourceRevision, expectedReviewRevision: detail.review.revision, points: 0, reportId })).data;
    expect((await api('/reviewer/v1/publications', 'POST', { requestId: randomUUID(), items: [{ reviewId: draft.id, reviewRevision: draft.revision, sourceRevision: detail.sourceRevision, expectedPublishedRevision: null }] })).status).toBe(201);
  }
  const list = await api('/student/assessment-works', 'GET', undefined, '', student);
  expect(list.data.find((row: { id: string }) => row.id === recipientId)).toMatchObject({ status: 'in_progress', progress: { photoTaskCount: 2, publishedReviewTaskCount: 2, resultReady: true } });
  const recipient = await db.assessmentRecipient.findUniqueOrThrow({ where: { id: recipientId } });
  const overview = await api('/teacher/assessment-assignments', 'GET', undefined, '', teacher);
  expect(overview.data.find((row: { versionId: string }) => row.versionId === recipient.versionId)).toMatchObject({ completedCount: 0, allPhotosCount: 1, allReviewsPublishedCount: 1 });
});

it('revokes one device without affecting another, and denies expired/inactive identities', async () => {
  expect((await api(`/teacher/reviewer-access/keys/${keyId}`, 'DELETE', undefined, '', teacher)).status).toBe(200);
  expect((await api('/reviewer/v1/me')).status).toBe(401);
  expect((await api('/reviewer/v1/me', 'GET', undefined, secondKey)).status).toBe(200);
  await db.reviewerDeviceKey.update({ where: { id: secondKeyId }, data: { expiresAt: new Date(Date.now() - 1000) } });
  expect((await api('/reviewer/v1/me', 'GET', undefined, secondKey)).status).toBe(401);
  await db.user.update({ where: { id: colleagueId }, data: { isActive: false } });
  expect((await api('/reviewer/v1/me', 'GET', undefined, colleagueKey)).status).toBe(401);
});
