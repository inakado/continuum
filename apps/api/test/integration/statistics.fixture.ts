import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { Prisma } from '@prisma/client';
import { AssessmentPackageTaskSchema } from '@continuum/shared';
import type { PrismaService } from '../../src/prisma/prisma.service';
import { json } from '../../src/assessment-assignments/assignment-data';

export async function statisticsFixture(db: PrismaService, teacherId: string, taskCount = 3) {
  const matching = AssessmentPackageTaskSchema.parse(JSON.parse(await readFile(resolve(__dirname, '../../../../examples/assessment-package/ege-v1/tasks/shkolkovo-14139/task.json'), 'utf8')));
  const extended = AssessmentPackageTaskSchema.parse(JSON.parse(await readFile(resolve(__dirname, '../../../../examples/assessment-package/extended-v1/tasks/shkolkovo-14449/task.json'), 'utf8')));
  const workId = randomUUID(), versionId = randomUUID();
  const items = Array.from({ length: taskCount }, (_, index) => ({ taskId: randomUUID(), version: 1, data: { task: index === taskCount - 1 ? { ...extended, maxPoints: 3 } : matching,
    statement: index === taskCount - 1 ? 'Газ расширяется. Найдите работу газа.' : 'Для каждой величины определите характер изменения. $R = mv/(qB)$.', solution: null, hash: 'fixture', images: [] } }));
  const snapshot = { title: `Проверка статистики · ${taskCount} заданий`, instructions: '', gradeBand: 'grade_10_11', items };
  return db.$transaction(async (tx) => {
  await tx.assessmentWork.create({ data: { id: workId, teacherId, title: snapshot.title, gradeBand: 'grade_10_11', items: [], taskCount, maxPoints: 2 * (taskCount - 1) + 3 } });
  await tx.assessmentWorkVersion.create({ data: { id: versionId, workId, number: 1, revision: 1, data: json(snapshot) } });
  const groups = await Promise.all(['11А · QA', '11Б · QA'].map((title) => tx.assessmentAssignment.create({ data: { versionId, classTitle: title, academicYear: 2026 } })));
  const recipients = await Promise.all(Array.from({ length: 20 }, (_, index) => {
    const completed = index < 12;
    const points = completed ? index % 3 : 0;
    const answers = Object.fromEntries(items.slice(0, -1).map((item) => [item.taskId, { type: 'matching', matches: points === 2 ? { radius: '2', force: '2' } : points === 1 ? { radius: '2', force: '1' } : { radius: '1', force: '1' } }]));
    return tx.assessmentRecipient.create({ data: { versionId, assignmentId: groups[index < 10 ? 0 : 1].id, studentName: `Учебный ученик ${String(index + 1).padStart(2, '0')}`, studentLogin: `qa${index + 1}`,
      startedAt: index < 16 ? new Date() : null, completedAt: completed ? new Date() : null, points: completed ? points * (taskCount - 1) : null,
      correctCount: completed ? points === 2 ? taskCount - 1 : 0 : null, incorrectCount: completed ? points === 0 ? taskCount - 1 : 0 : null, answers: json(answers) } });
  }));
  const reports: string[] = [], solutions: string[] = [];
  for (let index = 0; index < 7; index++) {
    const answer = await tx.assessmentSolutionAnswer.create({ data: { recipientId: recipients[index].id, taskId: items.at(-1)!.taskId, revision: 1 } });
    solutions.push(answer.id);
    await tx.assessmentSolutionPhoto.create({ data: { id: randomUUID(), answerId: answer.id, objectKey: `qa-statistics/${answer.id}/photo.png`, contentHash: 'fixture', contentType: 'image/png', sizeBytes: 128, confirmedAt: new Date() } });
    const report = await tx.assessmentReviewReport.create({ data: { id: randomUUID(), solutionId: answer.id, sourceRevision: 1, uploaderId: teacherId, objectKey: `qa-statistics/${answer.id}/report.pdf`, confirmedAt: new Date(), sizeBytes: 128 } });
    reports.push(report.id);
    const review = await tx.assessmentReview.create({ data: { solutionId: answer.id, revision: 2, publishedRevision: index < 5 ? 1 : null } });
    await tx.assessmentReviewVersion.createMany({ data: [
      { reviewId: review.id, revision: 1, sourceRevision: 1, points: index % 4, reportId: report.id, authorUserId: teacherId, keyId: randomUUID() },
      { reviewId: review.id, revision: 2, sourceRevision: 1, points: 3, reportId: report.id, authorUserId: teacherId, keyId: randomUUID() },
    ] });
  }
  // Stale published revision and unconfirmed photo must both be excluded.
  await tx.assessmentSolutionAnswer.update({ where: { id: solutions[4] }, data: { revision: 2 } });
  await tx.assessmentSolutionPhoto.updateMany({ where: { answerId: solutions[6] }, data: { confirmedAt: null } });
  return { workId, versionId, items, groups, recipients, solutions, reports };
  }, { timeout: 30000 });
}

export async function clearStatisticsFixture(db: PrismaService, workId: string) {
  const scope = { recipient: { version: { workId } } };
  await db.$transaction(async (tx) => {
    await tx.assessmentReview.deleteMany({ where: { solution: scope } });
    await tx.assessmentReviewReport.deleteMany({ where: { solution: scope } });
    await tx.assessmentRecipient.deleteMany({ where: { version: { workId } } });
    await tx.assessmentAssignment.deleteMany({ where: { version: { workId } } });
    await tx.assessmentWorkVersion.deleteMany({ where: { workId } });
    await tx.assessmentWork.deleteMany({ where: { id: workId } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
