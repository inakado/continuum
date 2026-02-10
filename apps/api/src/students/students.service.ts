import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import argon2 from 'argon2';
import { randomInt } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

const PASSWORD_LENGTH = 10;
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const PASSWORD_CHARS = `${LETTERS}${DIGITS}`;
const MAX_NAME_LENGTH = 80;

const pickRandom = (source: string) => source[randomInt(0, source.length)];

const shuffle = (items: string[]) => {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
};

const generatePassword = () => {
  const chars = [pickRandom(LETTERS), pickRandom(DIGITS)];
  while (chars.length < PASSWORD_LENGTH) {
    chars.push(pickRandom(PASSWORD_CHARS));
  }
  return shuffle(chars).join('');
};

const normalizeName = (value?: string | null) => {
  if (value === undefined || value === null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new BadRequestException('Имя слишком длинное');
  }
  return trimmed;
};

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  async listTeachers() {
    return this.prisma.user.findMany({
      where: { role: Role.teacher, isActive: true },
      select: { id: true, login: true },
      orderBy: { login: 'asc' },
    });
  }

  async listStudents(leaderTeacherId: string, query?: string) {
    const trimmedQuery = query?.trim();
    const students = await this.prisma.studentProfile.findMany({
      where: {
        leadTeacherId: leaderTeacherId,
        ...(trimmedQuery
          ? {
              OR: [
                { user: { login: { contains: trimmedQuery, mode: 'insensitive' } } },
                { firstName: { contains: trimmedQuery, mode: 'insensitive' } },
                { lastName: { contains: trimmedQuery, mode: 'insensitive' } },
              ],
            }
          : null),
      },
      include: {
        user: { select: { id: true, login: true, createdAt: true, updatedAt: true } },
        leadTeacher: { select: { id: true, login: true } },
      },
      orderBy: { user: { login: 'asc' } },
    });

    return students.map((student) => ({
      id: student.userId,
      login: student.user.login,
      firstName: student.firstName,
      lastName: student.lastName,
      leadTeacherId: student.leadTeacherId,
      leadTeacherLogin: student.leadTeacher.login,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
    }));
  }

  async createStudent(
    login: string,
    leaderTeacherId: string,
    firstName?: string | null,
    lastName?: string | null,
  ) {
    const trimmedLogin = login?.trim();
    if (!trimmedLogin) {
      throw new BadRequestException('Login is required');
    }

    const normalizedFirstName = normalizeName(firstName);
    const normalizedLastName = normalizeName(lastName);
    const password = generatePassword();
    const passwordHash = await argon2.hash(password);

    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            login: trimmedLogin,
            passwordHash,
            role: Role.student,
            isActive: true,
          },
          select: { id: true, login: true, role: true },
        });

        const profile = await tx.studentProfile.create({
          data: {
            userId: user.id,
            leadTeacherId: leaderTeacherId,
            displayName: null,
            firstName: normalizedFirstName,
            lastName: normalizedLastName,
          },
        });

        return { user, profile };
      });

      return { ...result, password };
    } catch (error) {
      if (error instanceof Error && 'code' in error && (error as { code: string }).code === 'P2002') {
        throw new ConflictException('Login already exists');
      }
      throw error;
    }
  }

  async updateStudentProfile(
    studentId: string,
    leaderTeacherId: string,
    firstName?: string | null,
    lastName?: string | null,
  ) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: studentId },
      include: { user: { select: { id: true, login: true, role: true } } },
    });

    if (!profile || profile.user.role !== Role.student) {
      throw new NotFoundException('Student not found');
    }
    if (profile.leadTeacherId !== leaderTeacherId) {
      throw new ForbiddenException('Student is not assigned to this teacher');
    }

    const normalizedFirstName = normalizeName(firstName);
    const normalizedLastName = normalizeName(lastName);

    const updated = await this.prisma.studentProfile.update({
      where: { userId: studentId },
      data: {
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
      },
      include: { user: { select: { id: true, login: true } } },
    });

    return {
      id: updated.userId,
      login: updated.user.login,
      firstName: updated.firstName,
      lastName: updated.lastName,
    };
  }

  async resetPassword(studentId: string, leaderTeacherId: string) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: studentId },
      include: { user: { select: { id: true, login: true, role: true } } },
    });

    if (!profile || profile.user.role !== Role.student) {
      throw new NotFoundException('Student not found');
    }
    if (profile.leadTeacherId !== leaderTeacherId) {
      throw new ForbiddenException('Student is not assigned to this teacher');
    }

    const password = generatePassword();
    const passwordHash = await argon2.hash(password);

    await this.prisma.user.update({
      where: { id: profile.userId },
      data: { passwordHash },
    });

    return { id: profile.userId, login: profile.user.login, password };
  }

  async transferStudent(studentId: string, leaderTeacherId: string, nextTeacherId: string) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: studentId },
      include: {
        user: { select: { id: true, login: true, role: true } },
        leadTeacher: { select: { id: true, login: true } },
      },
    });

    if (!profile || profile.user.role !== Role.student) {
      throw new NotFoundException('Student not found');
    }
    if (profile.leadTeacherId !== leaderTeacherId) {
      throw new ForbiddenException('Student is not assigned to this teacher');
    }
    if (profile.leadTeacherId === nextTeacherId) {
      throw new ConflictException('Student is already assigned to this teacher');
    }

    const nextTeacher = await this.prisma.user.findFirst({
      where: { id: nextTeacherId, role: Role.teacher, isActive: true },
      select: { id: true, login: true },
    });

    if (!nextTeacher) {
      throw new NotFoundException('Teacher not found');
    }

    const updated = await this.prisma.studentProfile.update({
      where: { userId: profile.userId },
      data: { leadTeacherId: nextTeacherId },
    });

    return {
      id: profile.userId,
      login: profile.user.login,
      leadTeacherId: updated.leadTeacherId,
      leadTeacherLogin: nextTeacher.login,
      previousLeadTeacherId: profile.leadTeacherId,
    };
  }

  async deleteStudent(studentId: string, leaderTeacherId: string) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: studentId },
      include: { user: { select: { id: true, login: true, role: true } } },
    });

    if (!profile || profile.user.role !== Role.student) {
      throw new NotFoundException('Student not found');
    }
    if (profile.leadTeacherId !== leaderTeacherId) {
      throw new ForbiddenException('Student is not assigned to this teacher');
    }

    await this.prisma.user.delete({
      where: { id: profile.userId },
      select: { id: true },
    });

    return {
      id: profile.userId,
      login: profile.user.login,
      leadTeacherId: profile.leadTeacherId,
      firstName: profile.firstName,
      lastName: profile.lastName,
    };
  }
}
