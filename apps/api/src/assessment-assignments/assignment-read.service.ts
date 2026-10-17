import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AssessmentWorksReadService, WorkSnapshotSchema } from '../assessment-works/assessment-works-read.service';
import { AssignmentRosterService } from './assignment-roster.service';
import { attemptStatus } from './assignment-data';

const reportInclude = {
  assignments: { orderBy: { createdAt: 'asc' }, select: { id: true, classId: true, classTitle: true, academicYear: true } },
  recipients: { orderBy: [{ studentName: 'asc' }, { id: 'asc' }], select: {
    id: true, studentName: true, studentLogin: true, studentId: true, assignmentId: true, answeredCount: true,
    startedAt: true, completedAt: true, points: true, correctCount: true, incorrectCount: true, student: { select: { isActive: true } },
  } },
} satisfies Prisma.AssessmentWorkVersionInclude;
type ReportRow = Prisma.AssessmentWorkVersionGetPayload<{ include: typeof reportInclude }>;
function summary(row: Pick<ReportRow, 'id' | 'workId' | 'number' | 'data' | 'assignments'>, studentCount: number, completedCount: number) {
  const snapshot = WorkSnapshotSchema.parse(row.data);
  return { versionId: row.id, workId: row.workId, title: snapshot.title, versionNumber: row.number, taskCount: snapshot.items.length,
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
    const [rows, completed] = await Promise.all([
      this.db.assessmentWorkVersion.findMany({ where: { work: { teacherId }, assignments: { some: {} } }, orderBy: { createdAt: 'desc' },
        include: { assignments: reportInclude.assignments, _count: { select: { recipients: true } } } }),
      this.db.assessmentRecipient.groupBy({ by: ['versionId'], where: { version: { work: { teacherId } }, completedAt: { not: null } }, _count: { _all: true } }),
    ]);
    const counts = new Map(completed.map((item) => [item.versionId, item._count._all]));
    return rows.map((row) => summary(row, row._count.recipients, counts.get(row.id) ?? 0));
  }
  async report(teacherId: string, versionId: string) {
    const row = await this.db.assessmentWorkVersion.findFirst({ where: { id: versionId, work: { teacherId }, assignments: { some: {} } }, include: reportInclude });
    if (!row) throw new NotFoundException('Назначение не найдено.');
    const base = summary(row, row.recipients.length, row.recipients.filter((item) => item.completedAt).length);
    return { ...base, recipients: row.recipients.map((item) => ({ id: item.id, name: item.studentName, login: item.studentLogin, assignmentId: item.assignmentId,
      deleted: item.studentId === null, isActive: item.student?.isActive ?? false, status: attemptStatus(item), answeredCount: item.answeredCount, completedAt: item.completedAt?.toISOString() ?? null,
      result: item.completedAt ? { points: item.points!, maxPoints: base.maxPoints, percentage: Math.round(100 * item.points! / base.maxPoints), correctCount: item.correctCount!, incorrectCount: item.incorrectCount! } : null,
    })) };
  }
}
