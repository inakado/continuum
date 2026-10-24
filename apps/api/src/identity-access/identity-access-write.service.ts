import { ConflictException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type {
  CreateTeacherStudentInput,
  SetStudentActiveInput,
  TeacherStudentMutationResult,
  UpdateStudentNamesInput,
} from '@continuum/shared';
import { Role } from '@prisma/client';
import { IdentityProvisioningService } from '../auth/identity-provisioning.service';
import { PrismaService } from '../prisma/prisma.service';
import { buildIdentityName } from '../auth/identity-policy';

const sameNames = (left: UpdateStudentNamesInput['expected'], right: UpdateStudentNamesInput['expected']) =>
  left.firstName === right.firstName && left.lastName === right.lastName && left.middleName === right.middleName;

const hasPrismaCode = (error: unknown, code: string) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === code;

@Injectable()
export class IdentityAccessWriteService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(IdentityProvisioningService)
    private readonly identities: IdentityProvisioningService,
  ) {}

  async updateStudentNames(studentId: string, input: UpdateStudentNamesInput): Promise<TeacherStudentMutationResult> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${studentId}::uuid FOR UPDATE`;
      const student = await tx.user.findFirst({ where: { id: studentId, role: Role.student }, include: { studentProfile: true } });
      if (!student?.studentProfile) throw new ForbiddenException({ code: 'STUDENT_NOT_MANAGED', message: 'Ученик не найден.' });
      const { firstName, lastName, middleName } = input;
      const names = { firstName, lastName, middleName };
      if (sameNames(student.studentProfile, names)) return { id: student.id, isActive: student.isActive };
      if (!sameNames(student.studentProfile, input.expected)) throw new ConflictException({ code: 'STUDENT_NAMES_CHANGED', message: 'Данные ученика изменились. Закройте форму и откройте её заново.' });
      await tx.studentProfile.update({ where: { userId: studentId }, data: names });
      return tx.user.update({ where: { id: studentId }, data: { name: buildIdentityName({ firstName, lastName, login: student.login }) }, select: { id: true, isActive: true } });
    });
  }

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
        middleName: input.middleName ?? null,
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
    _teacherId: string,
    studentId: string,
    input: SetStudentActiveInput,
  ): Promise<TeacherStudentMutationResult> {
    return this.prisma.$transaction(async (tx) => {
      const student = await tx.user.findFirst({
        where: {
          id: studentId,
          role: Role.student,
          studentProfile: { isNot: null },
        },
        select: { id: true },
      });
      if (!student) {
        throw new ForbiddenException({
          code: 'STUDENT_NOT_MANAGED',
          message: 'Ученик не найден.',
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
