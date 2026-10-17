import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { inputHash } from './assignment-data';

@Injectable()
export class AssignmentRosterService {
  constructor(@Inject(PrismaService) private readonly db: PrismaService) {}
  async classes(teacherId: string, versionId?: string, tx: Prisma.TransactionClient = this.db, classIds?: string[]) {
    const [classes, assigned, recipients] = await Promise.all([
      tx.schoolClass.findMany({ where: { teacherId, isArchived: false, ...(classIds ? { id: { in: classIds } } : {}) }, orderBy: [{ academicYear: 'desc' }, { title: 'asc' }], select: {
        id: true, title: true, grade: true, academicYear: true,
        students: { where: { leadTeacherId: teacherId }, select: { user: { select: { id: true, name: true, login: true, isActive: true } } }, orderBy: { user: { name: 'asc' } } },
      } }),
      versionId ? tx.assessmentAssignment.findMany({ where: { versionId }, select: { id: true, classId: true } }) : [],
      versionId ? tx.assessmentRecipient.findMany({ where: { versionId }, select: { studentId: true } }) : [],
    ]);
    const used = new Set(recipients.map((item) => item.studentId));
    const groups = new Map(assigned.map((item) => [item.classId, item.id]));
    return classes.map((item) => {
      const students = item.students.map(({ user }) => ({ ...user, alreadyAssigned: used.has(user.id) }));
      return { id: item.id, title: item.title, grade: item.grade, academicYear: item.academicYear, students,
        assignmentId: groups.get(item.id) ?? null, rosterHash: inputHash({ id: item.id, title: item.title, academicYear: item.academicYear, students }) };
    });
  }
}
