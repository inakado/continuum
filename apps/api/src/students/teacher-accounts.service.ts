import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from '@prisma/client';
import argon2 from 'argon2';
import type { PrismaService } from '../prisma/prisma.service';
import {
  assertPasswordStrength,
  generatePassword,
  normalizeName,
  normalizeRequiredName,
} from './students.shared';

export class TeacherAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async listTeachers() {
    const teachers = await this.prisma.user.findMany({
      where: { role: Role.teacher, isActive: true },
      select: {
        id: true,
        login: true,
        teacherProfile: {
          select: {
            firstName: true,
            lastName: true,
            middleName: true,
          },
        },
      },
      orderBy: { login: 'asc' },
    });

    return teachers.map((teacher) => ({
      id: teacher.id,
      login: teacher.login,
      firstName: teacher.teacherProfile?.firstName ?? null,
      lastName: teacher.teacherProfile?.lastName ?? null,
      middleName: teacher.teacherProfile?.middleName ?? null,
    }));
  }

  async getTeacherMe(teacherId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: teacherId, role: Role.teacher, isActive: true },
      select: {
        id: true,
        login: true,
        role: true,
        teacherProfile: {
          select: {
            firstName: true,
            lastName: true,
            middleName: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException({
        code: 'TEACHER_NOT_FOUND',
        message: 'Teacher not found.',
      });
    }

    return {
      user: {
        id: user.id,
        login: user.login,
        role: user.role,
      },
      profile: user.teacherProfile
        ? {
            firstName: user.teacherProfile.firstName,
            lastName: user.teacherProfile.lastName,
            middleName: user.teacherProfile.middleName,
          }
        : null,
    };
  }

  async updateTeacherProfile(
    teacherId: string,
    firstName: string | null | undefined,
    lastName: string | null | undefined,
    middleName?: string | null,
  ) {
    const teacherExists = await this.prisma.user.findFirst({
      where: { id: teacherId, role: Role.teacher, isActive: true },
      select: { id: true },
    });
    if (!teacherExists) {
      throw new NotFoundException({
        code: 'TEACHER_NOT_FOUND',
        message: 'Teacher not found.',
      });
    }

    const normalizedFirstName = normalizeRequiredName(
      firstName,
      'INVALID_PROFILE_NAME',
      'First name is required.',
    );
    const normalizedLastName = normalizeRequiredName(
      lastName,
      'INVALID_PROFILE_NAME',
      'Last name is required.',
    );
    const normalizedMiddleName = normalizeName(middleName);

    const updated = await this.prisma.teacherProfile.upsert({
      where: { userId: teacherId },
      create: {
        userId: teacherId,
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        middleName: normalizedMiddleName,
      },
      update: {
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        middleName: normalizedMiddleName,
      },
      select: {
        userId: true,
        firstName: true,
        lastName: true,
        middleName: true,
      },
    });

    return {
      id: updated.userId,
      firstName: updated.firstName,
      lastName: updated.lastName,
      middleName: updated.middleName,
    };
  }

  async changeTeacherPassword(
    teacherId: string,
    currentPassword: string | null | undefined,
    newPassword: string | null | undefined,
  ) {
    const current = currentPassword?.trim() ?? '';
    const next = newPassword?.trim() ?? '';
    if (!current) {
      throw new BadRequestException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'Current password is required.',
      });
    }
    if (!next) {
      throw new BadRequestException({
        code: 'WEAK_PASSWORD',
        message: 'New password is required.',
      });
    }

    const teacher = await this.prisma.user.findFirst({
      where: { id: teacherId, role: Role.teacher, isActive: true },
      select: { id: true, login: true, passwordHash: true },
    });
    if (!teacher) {
      throw new NotFoundException({
        code: 'TEACHER_NOT_FOUND',
        message: 'Teacher not found.',
      });
    }

    const isCurrentValid = await argon2.verify(teacher.passwordHash, current);
    if (!isCurrentValid) {
      throw new BadRequestException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'Current password is invalid.',
      });
    }

    assertPasswordStrength(next);
    const nextPasswordHash = await argon2.hash(next);
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: teacher.id },
        data: { passwordHash: nextPasswordHash },
      });

      await tx.authSession.updateMany({
        where: {
          userId: teacher.id,
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          revokeReason: 'PASSWORD_CHANGED',
          lastUsedAt: now,
        },
      });

      await tx.authRefreshToken.updateMany({
        where: {
          revokedAt: null,
          session: {
            userId: teacher.id,
          },
        },
        data: { revokedAt: now },
      });
    });

    return {
      id: teacher.id,
      login: teacher.login,
    };
  }

  async createTeacher(input: {
    login: string;
    firstName: string;
    lastName: string;
    middleName?: string | null;
    password?: string | null;
    generatePassword?: boolean;
  }) {
    const login = input.login?.trim();
    if (!login) {
      throw new BadRequestException({
        code: 'LOGIN_REQUIRED',
        message: 'Login is required.',
      });
    }

    const firstName = normalizeRequiredName(
      input.firstName,
      'INVALID_PROFILE_NAME',
      'First name is required.',
    );
    const lastName = normalizeRequiredName(
      input.lastName,
      'INVALID_PROFILE_NAME',
      'Last name is required.',
    );
    const middleName = normalizeName(input.middleName);

    const providedPassword = input.password?.trim() ?? '';
    const shouldGeneratePassword = input.generatePassword === true || providedPassword.length === 0;
    const password = shouldGeneratePassword ? generatePassword() : providedPassword;
    assertPasswordStrength(password);
    const passwordHash = await argon2.hash(password);

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            login,
            passwordHash,
            role: Role.teacher,
            isActive: true,
          },
          select: { id: true, login: true, role: true },
        });

        const profile = await tx.teacherProfile.create({
          data: {
            userId: user.id,
            firstName,
            lastName,
            middleName,
          },
          select: {
            firstName: true,
            lastName: true,
            middleName: true,
          },
        });

        return { user, profile };
      });

      return {
        user: created.user,
        profile: created.profile,
        password: shouldGeneratePassword ? password : null,
      };
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2002') {
        throw new ConflictException({
          code: 'LOGIN_ALREADY_EXISTS',
          message: 'Login already exists.',
        });
      }
      throw error;
    }
  }

  async deleteTeacher(teacherId: string, actorTeacherId: string) {
    if (teacherId === actorTeacherId) {
      throw new ConflictException({
        code: 'CANNOT_DELETE_SELF',
        message: 'Teacher cannot delete own account.',
      });
    }

    const teacher = await this.prisma.user.findFirst({
      where: { id: teacherId, role: Role.teacher, isActive: true },
      include: {
        teacherProfile: {
          select: {
            firstName: true,
            lastName: true,
            middleName: true,
          },
        },
      },
    });

    if (!teacher) {
      throw new NotFoundException({
        code: 'TEACHER_NOT_FOUND',
        message: 'Teacher not found.',
      });
    }

    try {
      await this.prisma.user.delete({
        where: { id: teacher.id },
      });
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2003') {
        throw new ConflictException({
          code: 'TEACHER_HAS_STUDENTS',
          message: 'Teacher has assigned students.',
        });
      }
      throw error;
    }

    return {
      id: teacher.id,
      login: teacher.login,
      firstName: teacher.teacherProfile?.firstName ?? null,
      lastName: teacher.teacherProfile?.lastName ?? null,
      middleName: teacher.teacherProfile?.middleName ?? null,
    };
  }
}
