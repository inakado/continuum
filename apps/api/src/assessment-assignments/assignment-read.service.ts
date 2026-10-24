import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssessmentWorksReadService, WorkSnapshotSchema } from '../assessment-works/assessment-works-read.service';
import { AssignmentRosterService } from './assignment-roster.service';
import { attemptStatus, type WorkSnapshot } from './assignment-data';
import { progressScope, readWorkProgress } from './work-progress';

const reportInclude = {
  assignments: { orderBy: { createdAt: 'asc' }, select: { id: true, classId: true, classTitle: true, academicYear: true } },
  recipients: { orderBy: [{ studentName: 'asc' }, { id: 'asc' }], select: {
    id: true, studentName: true, studentLogin: true, studentId: true, assignmentId: true, answeredCount: true,
    startedAt: true, completedAt: true, points: true, correctCount: true, incorrectCount: true, student: { select: { isActive: true } },
  } },
} satisfies Prisma.AssessmentWorkVersionInclude;
type ReportRow = Prisma.AssessmentWorkVersionGetPayload<{ include: typeof reportInclude }>;
function summary(row: Pick<ReportRow, 'id' | 'workId' | 'number' | 'assignments'>, snapshot: WorkSnapshot, studentCount: number, completedCount: number) {
  return { versionId: row.id, workId: row.workId, title: snapshot.title, versionNumber: row.number, taskCount: snapshot.items.length,
    automaticTaskCount: snapshot.items.filter((item) => item.data.task.type !== 'extended').length, extendedTaskCount: snapshot.items.filter((item) => item.data.task.type === 'extended').length,
    maxPoints: snapshot.items.reduce((sum, item) => sum + item.data.task.maxPoints, 0),
    classes: row.assignments.map((item) => ({ id: item.id, classId: item.classId, title: item.classTitle, academicYear: item.academicYear })),
    studentCount, completedCount };
}
@Injectable()
export class AssignmentReadService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService,
    @Inject(AssessmentWorksReadService) private readonly works: AssessmentWorksReadService,
    @Inject(AssignmentRosterService) private readonly roster: AssignmentRosterService) {}
  async prepare(teacherId: string, workId: string, number?: number) {
    const current = await this.works.owned(teacherId, workId);
    const versions = await this.db.assessmentWorkVersion.findMany({ where: { workId }, orderBy: { number: 'desc' } });
    const selected = number ? versions.find((item) => item.number === number) : versions.find((item) => item.revision === current.revision);
    if (number && !selected) throw new NotFoundException('Версия работы не найдена.');
    const metadata = versions.map((item) => {
      const data = WorkSnapshotSchema.parse(item.data);
      return { number: item.number, revision: item.revision, title: data.title, taskCount: data.items.length, maxPoints: data.items.reduce((sum, task) => sum + task.data.task.maxPoints, 0) };
    });
    const chosen = number ? metadata.find((item) => item.number === number)! : current;
    const snapshot = number && selected ? WorkSnapshotSchema.parse(selected.data) : null;
    return { work: { id: current.id, title: chosen.title, gradeBand: snapshot?.gradeBand ?? current.gradeBand, taskCount: chosen.taskCount, maxPoints: chosen.maxPoints, revision: chosen.revision },
      selection: number ? { kind: 'version' as const, number } : { kind: 'draft' as const, expectedRevision: current.revision },
      versions: metadata, classes: await this.roster.classes(teacherId, selected?.id) };
  }
  async list(teacherId: string) {
    const rows = await this.db.assessmentWorkVersion.findMany({ where: { work: { teacherId }, assignments: { some: {} } }, orderBy: { createdAt: 'desc' },
      include: { assignments: reportInclude.assignments, recipients: { select: { id: true, completedAt: true } } } });
    const prepared = rows.map((row) => ({ row, snapshot: WorkSnapshotSchema.parse(row.data) }));
    const progress = await readWorkProgress(this.db, prepared.flatMap(({ row, snapshot }) => row.recipients.map((recipient) => progressScope(recipient, snapshot))));
    return prepared.map(({ row, snapshot }) => {
      const extendedCount = snapshot.items.filter((item) => item.data.task.type === 'extended').length;
      return { ...summary(row, snapshot, row.recipients.length, row.recipients.filter((item) => item.completedAt).length),
        allPhotosCount: extendedCount ? row.recipients.filter((item) => progress.get(item.id)!.photoTaskCount === extendedCount).length : 0,
        allReviewsPublishedCount: extendedCount ? row.recipients.filter((item) => progress.get(item.id)!.publishedReviewTaskCount === extendedCount).length : 0 };
    });
  }
  async report(teacherId: string, versionId: string) {
    const row = await this.db.assessmentWorkVersion.findFirst({ where: { id: versionId, work: { teacherId }, assignments: { some: {} } }, include: reportInclude });
    if (!row) throw new NotFoundException('Назначение не найдено.');
    const snapshot = WorkSnapshotSchema.parse(row.data);
    const base = summary(row, snapshot, row.recipients.length, row.recipients.filter((item) => item.completedAt).length);
    const progress = await readWorkProgress(this.db, row.recipients.map((item) => progressScope(item, snapshot)));
    const automaticMaxPoints = snapshot.items.filter((item) => item.data.task.type !== 'extended').reduce((sum, item) => sum + item.data.task.maxPoints, 0);
    return { ...base,
      allPhotosCount: base.extendedTaskCount ? row.recipients.filter((item) => progress.get(item.id)!.photoTaskCount === base.extendedTaskCount).length : 0,
      allReviewsPublishedCount: base.extendedTaskCount ? row.recipients.filter((item) => progress.get(item.id)!.publishedReviewTaskCount === base.extendedTaskCount).length : 0,
      recipients: row.recipients.map((item) => ({ id: item.id, name: item.studentName, login: item.studentLogin, assignmentId: item.assignmentId,
      deleted: item.studentId === null, isActive: item.student?.isActive ?? false, status: attemptStatus(item), answeredCount: item.answeredCount, completedAt: item.completedAt?.toISOString() ?? null,
      photoTaskCount: progress.get(item.id)!.photoTaskCount, progress: progress.get(item.id)!,
      result: item.completedAt && automaticMaxPoints > 0 ? { points: item.points!, maxPoints: automaticMaxPoints, percentage: Math.round(100 * item.points! / automaticMaxPoints), correctCount: item.correctCount!, incorrectCount: item.incorrectCount!, partialCount: base.automaticTaskCount - item.correctCount! - item.incorrectCount! } : null,
    })) };
  }
}
