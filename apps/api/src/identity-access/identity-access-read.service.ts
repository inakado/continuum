import { Inject, Injectable } from '@nestjs/common';
import type { TeacherStudent, TeacherStudents } from '@continuum/shared';
import { Role, type GradeBand } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type ManagedStudentRecord = {
  id: string;
  login: string;
  name: string;
  isActive: boolean;
  studentProfile: { firstName: string | null; lastName: string | null } | null;
  accessGrants: Array<{ gradeBand: GradeBand }>;
};

@Injectable()
export class IdentityAccessReadService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getStudents(teacherId: string): Promise<TeacherStudents> {
    const students = await this.prisma.user.findMany({
      where: {
        role: Role.student,
        studentProfile: { is: { leadTeacherId: teacherId } },
      },
      orderBy: [{ isActive: 'desc' }, { login: 'asc' }],
      select: {
        id: true,
        login: true,
        name: true,
        isActive: true,
        studentProfile: { select: { firstName: true, lastName: true } },
        accessGrants: {
          where: { grantedById: teacherId },
          orderBy: { gradeBand: 'asc' },
          select: { gradeBand: true },
        },
      },
    });

    return { students: students.map((student) => this.mapStudent(student)) };
  }

  private mapStudent(student: ManagedStudentRecord): TeacherStudent {
    return {
      id: student.id,
      login: student.login,
      name: student.name,
      firstName: student.studentProfile?.firstName ?? null,
      lastName: student.studentProfile?.lastName ?? null,
      isActive: student.isActive,
      gradeBands: student.accessGrants.map((grant) => grant.gradeBand),
    };
  }
}
