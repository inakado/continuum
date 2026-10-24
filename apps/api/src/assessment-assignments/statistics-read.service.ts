import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AssessmentStatistics, StatisticsTaskDetail } from '@continuum/shared';
import { PrismaService } from '../prisma/prisma.service';
import { WorkSnapshotSchema } from '../assessment-works/assessment-works-read.service';
import { mapAssessmentSummary, mapAssessmentView } from '../assessment-bank/assessment-bank.mapper';
import { answersSchema } from './assignment-data';
import { SolutionReadService } from './solution-read.service';
import { buildStatistics, statisticsStudent, type StatisticsSolution } from './statistics-aggregate';

const include = {
  assignments: { orderBy: { createdAt: 'asc' }, select: { id: true, classId: true, classTitle: true, academicYear: true } },
} satisfies Prisma.AssessmentWorkVersionInclude;
const recipientFields = { id: true, assignmentId: true, studentName: true, studentLogin: true, answers: true, startedAt: true, completedAt: true, points: true } satisfies Prisma.AssessmentRecipientSelect;

@Injectable()
export class StatisticsReadService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(SolutionReadService) private readonly solutions: SolutionReadService) {}
  private async owned(tx: Prisma.TransactionClient, teacherId: string, id: string) {
    const row = await tx.assessmentWorkVersion.findFirst({ where: { id, work: { teacherId }, assignments: { some: {} } }, include });
    if (!row) throw new NotFoundException('Статистика работы недоступна.');
    return row;
  }
  private async published(tx: Prisma.TransactionClient, recipientIds: string[]): Promise<StatisticsSolution[]> {
    if (!recipientIds.length) return [];
    const answers = await tx.assessmentSolutionAnswer.findMany({ where: { recipientId: { in: recipientIds } }, select: {
      id: true, recipientId: true, taskId: true, revision: true, review: { select: { id: true, publishedRevision: true } },
      _count: { select: { photos: { where: { confirmedAt: { not: null }, removedAt: null } } } },
    } });
    const refs = answers.flatMap((answer) => answer.review?.publishedRevision != null ? [{ reviewId: answer.review.id, revision: answer.review.publishedRevision }] : []);
    const versions = refs.length ? await tx.assessmentReviewVersion.findMany({ where: { OR: refs }, select: {
      reviewId: true, revision: true, sourceRevision: true, points: true, report: { select: { solutionId: true, sourceRevision: true, confirmedAt: true } },
    } }) : [];
    const published = new Map(versions.map((version) => [`${version.reviewId}:${version.revision}`, version]));
    return answers.map((answer) => {
      const review = published.get(`${answer.review?.id}:${answer.review?.publishedRevision}`);
      const valid = review?.sourceRevision === answer.revision && review.report?.confirmedAt && review.report.solutionId === answer.id && review.report.sourceRevision === answer.revision;
      return { recipientId: answer.recipientId, taskId: answer.taskId, hasPhotos: answer._count.photos > 0, points: valid ? review.points : null };
    });
  }
  report(teacherId: string, id: string): Promise<AssessmentStatistics> {
    return this.db.$transaction(async (tx) => {
      const row = await this.owned(tx, teacherId, id);
      const snapshot = WorkSnapshotSchema.parse(row.data);
      const classes = row.assignments.map((group) => ({ id: group.id, classId: group.classId, title: group.classTitle, academicYear: group.academicYear }));
      const recipients = await tx.assessmentRecipient.findMany({ where: { versionId: id }, orderBy: [{ studentName: 'asc' }, { id: 'asc' }], select: {
        ...recipientFields, student: { select: { studentProfile: { select: { firstName: true, lastName: true } } } },
      } });
      const solutions = await this.published(tx, recipients.map((student) => student.id));
      const statistics = buildStatistics(snapshot, recipients.map((recipient) => ({ ...recipient, answers: answersSchema.parse(recipient.answers) })), solutions, classes);
      return { versionId: row.id, workId: row.workId, title: snapshot.title, versionNumber: row.number, classes,
        tasks: snapshot.items.map((item) => mapAssessmentSummary(item.taskId, item.version, item.data)),
        ...statistics, students: statistics.students.map((student, index) => {
          const profile = recipients[index].student?.studentProfile;
          return { ...student, displayName: [profile?.lastName, profile?.firstName].filter(Boolean).join(' ') || student.login };
        }) };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
  }
  detail(teacherId: string, id: string, taskId: string, recipientId?: string): Promise<StatisticsTaskDetail> {
    return this.db.$transaction(async (tx) => {
      const row = await this.owned(tx, teacherId, id);
      const snapshot = WorkSnapshotSchema.parse(row.data);
      const item = snapshot.items.find((entry) => entry.taskId === taskId);
      if (!item) throw new NotFoundException('Задание не входит в эту версию работы.');
      const view = mapAssessmentView(item.taskId, item.version, item.data, `/teacher/assessment-bank/tasks/${item.taskId}/images`);
      if (!recipientId) return { item: view, student: null };
      const recipient = await tx.assessmentRecipient.findFirst({ where: { id: recipientId, versionId: id }, select: recipientFields });
      if (!recipient) throw new NotFoundException('Ученик не входит в это назначение.');
      const answers = answersSchema.parse(recipient.answers);
      const solutions = await this.published(tx, [recipient.id]);
      const student = statisticsStudent(snapshot, { ...recipient, answers }, new Map(solutions.map((solution) => [`${solution.recipientId}:${solution.taskId}`, solution])));
      const solution = item.data.task.type === 'extended' ? (await this.solutions.list({ id: teacherId, role: 'teacher' }, recipient.id, tx)).find((answer) => answer.taskId === taskId) ?? null : null;
      const score = student.scores[snapshot.items.indexOf(item)];
      return { item: view, student: { name: recipient.studentName, answer: answers[taskId] ?? null, score, solution: solution ? { ...solution, publishedReview: score.state === 'scored' ? solution.publishedReview : null } : null } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
  }
}
