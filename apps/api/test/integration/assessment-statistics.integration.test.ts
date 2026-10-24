import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { AssessmentStatisticsSchema, StatisticsTaskDetailSchema } from '@continuum/shared';
import { PrismaService } from '../../src/prisma/prisma.service';
import { IdentityProvisioningService } from '../../src/auth/identity-provisioning.service';
import { createBetterAuth } from '../../src/auth/better-auth.factory';
import { statisticsFixture, clearStatisticsFixture } from './statistics.fixture';

const db = new PrismaService(), identities = new IdentityProvisioningService(db);
const users: string[] = [];
let fixture: Awaited<ReturnType<typeof statisticsFixture>>, owner = '', other = '', learner = '';
const origin = 'http://localhost:3001';
async function identity(role: 'teacher' | 'student') {
  const login = `stats-${randomUUID()}`, password = 'Local-statistics-123';
  const created = role === 'teacher' ? await identities.createTeacher({ login, password, firstName: 'Тест', lastName: 'Статистика', middleName: null }) : await identities.createStudent({ login, password, leadTeacherId: users[0], firstName: 'Тест', lastName: 'Ученик' });
  users.push(created.user.id);
  const signed = await createBetterAuth(db).api.signInUsername({ body: { username: login, password }, asResponse: true, headers: new Headers({ origin }) });
  return signed.headers.getSetCookie().map((cookie) => cookie.split(';')[0]).join('; ');
}
async function api(path = '', cookie = owner) {
  const response = await fetch(`http://localhost:3000/teacher/assessment-statistics/${fixture.versionId}${path}`, { headers: { cookie, origin } });
  return { status: response.status, data: await response.json(), cache: response.headers.get('cache-control') };
}
beforeAll(async () => {
  await db.$connect(); owner = await identity('teacher'); other = await identity('teacher'); learner = await identity('student');
  fixture = await statisticsFixture(db, users[0]);
}, 30000);
afterAll(async () => {
  const works = await db.assessmentWork.findMany({ where: { teacherId: { in: users } }, select: { id: true } });
  for (const work of works) await clearStatisticsFixture(db, work.id);
  await db.studentProfile.deleteMany({ where: { userId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });
  await db.$disconnect();
}, 30000);
it('returns exact point distributions, per-class populations and independent part averages', async () => {
  const result = await api(); expect(result.status).toBe(200); expect(result.cache).toBe('no-store');
  const report = AssessmentStatisticsSchema.parse(result.data);
  expect(report.distributions[0]).toEqual({ scoredCount: 12, pendingCount: 8, buckets: [0, 1, 2].map((points) => ({ points, count: 4, percentage: 33.3 })) });
  expect(report.distributions[2]).toEqual({ scoredCount: 4, pendingCount: 16, buckets: [0, 1, 2, 3].map((points) => ({ points, count: 1, percentage: 25 })) });
  expect(report.classResults.map((row) => row.summary.studentCount)).toEqual([10, 10]);
  expect(report.summary.finalCount).toBe(4);
  expect(report.students[5].scores[2]).toEqual({ state: 'awaiting_review' });
  expect(report.students[6].scores[2]).toEqual({ state: 'no_photos' });
  expect(JSON.stringify(report)).not.toContain('grading');
  expect(JSON.stringify(report)).not.toContain('objectKey');
});
it('does not treat newer drafts or stale published photo revisions as graded', async () => {
  const report = AssessmentStatisticsSchema.parse((await api()).data);
  expect(report.students[0].scores[2]).toEqual({ state: 'scored', points: 0 });
  expect(report.students[4].scores[2]).toEqual({ state: 'awaiting_review' });
  expect(report.students[0].totalPoints).toBe(0);
});
it('loads the pinned condition, selected answer and actual published review only on detail', async () => {
  const stored = await db.assessmentRecipient.findUniqueOrThrow({ where: { id: fixture.recipients[1].id } });
  const detail = StatisticsTaskDetailSchema.parse((await api(`/items/${fixture.items[0].taskId}?recipient=${stored.id}`)).data);
  expect(detail.item.task.type).toBe('matching');
  expect(detail.student?.score).toEqual({ state: 'scored', points: 1 });
  expect(detail.student?.answer).toMatchObject({ type: 'matching' });
  expect(StatisticsTaskDetailSchema.parse((await api(`/items/${fixture.items[2].taskId}?recipient=${stored.id}`)).data).student?.solution?.publishedReview?.points).toBe(1);
  expect(await db.assessmentRecipient.findUniqueOrThrow({ where: { id: stored.id } })).toEqual(stored);
});
it('enforces teacher ownership, role, task membership and recipient membership on every route', async () => {
  for (const path of ['', `/items/${fixture.items[0].taskId}`]) {
    expect((await api(path, other)).status).toBe(404);
    expect((await api(path, learner)).status).toBe(403);
    expect((await api(path, '')).status).toBe(401);
  }
  expect((await api(`/items/${randomUUID()}`)).status).toBe(404);
  expect((await api(`/items/${fixture.items[0].taskId}?recipient=${randomUUID()}`)).status).toBe(404);
  expect((await api(`/items/${fixture.items[0].taskId}?recipient=invalid`)).status).toBe(400);
});
it('retains old totals without writes if historical detail is inconsistent', async () => {
  const row = fixture.recipients[0];
  await db.assessmentRecipient.update({ where: { id: row.id }, data: { points: 4 } });
  const report = AssessmentStatisticsSchema.parse((await api()).data);
  expect(report.students[0].automaticPoints).toBe(4);
  expect(report.students[0].scores[0]).toEqual({ state: 'unavailable' });
  expect(report.distributions[0].scoredCount).toBe(11);
  expect((await db.assessmentRecipient.findUniqueOrThrow({ where: { id: row.id } })).points).toBe(4);
});
it('uses explicit profile name parts for the compact label while preserving the historical name and falling back to login', async () => {
  const recipient = fixture.recipients[0];
  await db.studentProfile.update({ where: { userId: users[2] }, data: { firstName: 'Анна Мария', lastName: 'Иванова-Смирнова', middleName: 'Петровна' } });
  await db.assessmentRecipient.update({ where: { id: recipient.id }, data: { studentId: users[2] } });
  const report = AssessmentStatisticsSchema.parse((await api()).data);
  expect(report.students.find((row) => row.id === recipient.id)).toMatchObject({ name: recipient.studentName, displayName: 'Иванова-Смирнова Анна Мария' });
  expect(JSON.stringify(report)).not.toContain('middleName');
  await db.studentProfile.delete({ where: { userId: users[2] } });
  const withoutProfile = AssessmentStatisticsSchema.parse((await api()).data);
  expect(withoutProfile.students.find((row) => row.id === recipient.id)).toMatchObject({ name: recipient.studentName, displayName: recipient.studentLogin });
});
