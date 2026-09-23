import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type {
  CreateTeacherStudentInput,
  SetStudentActiveInput,
  TeacherStudentMutationResult,
} from '@continuum/shared';
import { Role } from '@prisma/client';
import { IdentityProvisioningService } from '../auth/identity-provisioning.service';
import { PrismaService } from '../prisma/prisma.service';

const hasPrismaCode = (error: unknown, code: string) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === code;

@Injectable()
export class IdentityAccessWriteService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(IdentityProvisioningService)
    private readonly identities: IdentityProvisioningService,
  ) {}

  async createStudent(
    teacherId: string,
    input: CreateTeacherStudentInput,
  ): Promise<TeacherStudentMutationResult> {
    try {
      const created = await this.identities.createStudent({
        login: input.login,
        password: input.password,
        leadTeacherId: teacherId,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
      });
      return { id: created.user.id, isActive: true };
    } catch (error) {
      if (hasPrismaCode(error, 'P2002')) {
        throw new ConflictException({
          code: 'LOGIN_TAKEN',
          message: 'Учётная запись с таким логином уже существует.',
        });
      }
      throw error;
    }
  }

  async setStudentActive(
    teacherId: string,
    studentId: string,
    input: SetStudentActiveInput,
  ): Promise<TeacherStudentMutationResult> {
    return this.prisma.$transaction(async (tx) => {
      const student = await tx.user.findFirst({
        where: {
          id: studentId,
          role: Role.student,
          studentProfile: { is: { leadTeacherId: teacherId } },
        },
        select: { id: true },
      });
      if (!student) {
        throw new ForbiddenException({
          code: 'STUDENT_NOT_MANAGED',
          message: 'Ученик не привязан к этому преподавателю.',
        });
      }

      const updated = await tx.user.update({
        where: { id: student.id },
        data: { isActive: input.isActive },
        select: { id: true, isActive: true },
      });
      if (!input.isActive) {
        await tx.session.deleteMany({ where: { userId: student.id } });
      }
      return updated;
    });
  }
}
