import { ConflictException, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { GradeBand } from '@prisma/client';

export const classGradeBand = (grade: number): GradeBand => grade >= 10 ? 'grade_10_11' : grade === 9 ? 'grade_9' : grade === 8 ? 'grade_8' : 'grade_7';

export function grantClassLibrary(tx: Prisma.TransactionClient, studentId: string, teacherId: string, grade: number) {
  const gradeBand = classGradeBand(grade);
  return tx.accessGrant.upsert({
    where: { studentId_gradeBand: { studentId, gradeBand } },
    create: { studentId, gradeBand, grantedById: teacherId }, update: { grantedById: teacherId },
  });
}

export const hasDbCode = (error: unknown, code: string) =>
  typeof error === 'object' && error !== null && 'code' in error && error.code === code;

export function isLoginConflict(error: unknown): boolean {
  if (!hasDbCode(error, 'P2002')) return false;
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  return Array.isArray(target) && target.some((field) => field === 'login' || field === 'email');
}

export async function managedClass(tx: Prisma.TransactionClient, teacherId: string, id: string, writable = true) {
  const schoolClass = await tx.schoolClass.findFirst({ where: { id, teacherId } });
  if (!schoolClass) throw new NotFoundException({ code: 'CLASS_NOT_FOUND', message: 'Класс не найден.' });
  if (writable && schoolClass.isArchived) {
    throw new ConflictException({ code: 'CLASS_ARCHIVED', message: 'Сначала восстановите класс из архива.' });
  }
  return schoolClass;
}

export async function managedStudent(tx: Prisma.TransactionClient, teacherId: string, id: string) {
  const student = await tx.user.findFirst({
    where: { id, role: 'student', studentProfile: { is: { leadTeacherId: teacherId } } },
    select: { id: true, name: true, login: true },
  });
  if (!student) throw new NotFoundException({ code: 'STUDENT_NOT_FOUND', message: 'Ученик не найден.' });
  return student;
}

// Archive, transfer and batch creation serialize against one another; no partial rosters.
export async function classTransaction<T>(prisma: PrismaService, write: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(write, { isolationLevel: 'Serializable', timeout: 30000 });
    } catch (error) {
      if ((hasDbCode(error, 'P2034') || isLoginConflict(error)) && attempt < 2) continue;
      throw error;
    }
  }
}
