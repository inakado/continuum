import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import type { AssignmentRevoke } from '@continuum/shared';
import { PrismaService } from '../prisma/prisma.service';
import { WorkSnapshotSchema } from '../assessment-works/assessment-works-read.service';
import { AssessmentFileCleanupService } from './assessment-file-cleanup.service';

const unavailable = () => new NotFoundException('Назначение недоступно.');
const recipientsHash = (ids: string[]) => createHash('sha256').update(JSON.stringify(ids.sort())).digest('hex');
@Injectable()
export class AssignmentRevocationService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService, @Inject(AssessmentFileCleanupService) private readonly cleanup: AssessmentFileCleanupService) {}
  private async target(tx: Prisma.TransactionClient, teacherId: string, id: string) {
    const row = await tx.assessmentAssignment.findFirst({ where: { id, version: { work: { teacherId } } }, include: { version: true } });
    if (!row) throw unavailable();
    return row;
  }
  async preview(teacherId: string, id: string) {
    return this.db.$transaction(async (tx) => {
      const row = await this.target(tx, teacherId, id);
      const recipients = await tx.assessmentRecipient.findMany({ where: { assignmentId: id }, select: { id: true, startedAt: true, completedAt: true } });
      return { id, workId: row.version.workId, versionId: row.versionId, title: WorkSnapshotSchema.parse(row.version.data).title,
        classTitle: row.classTitle, academicYear: row.academicYear, studentCount: recipients.length,
        startedCount: recipients.filter((item) => item.startedAt).length, completedCount: recipients.filter((item) => item.completedAt).length,
        recipientsHash: recipientsHash(recipients.map((item) => item.id)) };
    });
  }
  private async receipt(tx: Prisma.TransactionClient, teacherId: string, id: string) {
    const row = await tx.assessmentAssignmentRevocation.findFirst({ where: { id, teacherId } });
    if (!row) throw unavailable();
    return { id, workId: row.workId, versionId: row.versionId };
  }
  async remove(teacherId: string, id: string, input: AssignmentRevoke) {
    const result = await this.db.$transaction(async (tx) => {
      const initial = await tx.assessmentAssignment.findFirst({ where: { id, version: { work: { teacherId } } }, select: { version: { select: { workId: true } } } });
      if (!initial) return this.receipt(tx, teacherId, id);
      await tx.$queryRaw`SELECT id FROM assessment_works WHERE id = ${initial.version.workId}::uuid FOR UPDATE`;
      const current = await tx.assessmentAssignment.findUnique({ where: { id } });
      if (!current) return this.receipt(tx, teacherId, id);
      await tx.$queryRaw`SELECT id FROM assessment_recipients WHERE assignment_id = ${id}::uuid ORDER BY id FOR UPDATE`;
      const recipients = await tx.assessmentRecipient.findMany({ where: { assignmentId: id }, select: { id: true } });
      if (recipientsHash(recipients.map((item) => item.id)) !== input.expectedRecipientsHash) throw new ConflictException('Список получателей изменился. Закройте окно и проверьте назначение заново.');
      const scope = { recipient: { assignmentId: id } };
      const [photos, reports] = await Promise.all([
        tx.assessmentSolutionPhoto.findMany({ where: { answer: scope }, select: { objectKey: true } }),
        tx.assessmentReviewReport.findMany({ where: { solution: scope }, select: { objectKey: true } }),
      ]);
      const keys = [...new Set([...photos, ...reports].map((file) => file.objectKey))];
      if (keys.length) await tx.assessmentFileDeletion.createMany({ data: keys.map((objectKey) => ({ objectKey })), skipDuplicates: true });
      // Delete review versions first: their report FK is Restrict, not Cascade.
      await tx.assessmentReview.deleteMany({ where: { solution: scope } });
      await tx.reviewerWriteReceipt.deleteMany({ where: { assignmentId: id } });
      await tx.assessmentRecipient.deleteMany({ where: { assignmentId: id } });
      await tx.assessmentAssignment.delete({ where: { id } });
      await tx.assessmentAssignmentRequest.updateMany({ where: { workId: initial.version.workId, invalidatedAt: null }, data: { invalidatedAt: new Date() } });
      await tx.assessmentAssignmentRevocation.create({ data: { id, teacherId, workId: initial.version.workId, versionId: current.versionId } });
      return { id, workId: initial.version.workId, versionId: current.versionId };
    }, { timeout: 30000 });
    this.cleanup.kick();
    return result;
  }
}
