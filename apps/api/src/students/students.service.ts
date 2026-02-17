import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AttemptKind, ContentStatus, Role, StudentTaskStatus, StudentUnitStatus } from '@prisma/client';
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

const creditedStatuses = new Set<StudentTaskStatus>([
  StudentTaskStatus.correct,
  StudentTaskStatus.accepted,
  StudentTaskStatus.credited_without_progress,
  StudentTaskStatus.teacher_credited,
]);

const normalizeTaskState = (
  state: {
    status: StudentTaskStatus;
    wrongAttempts: number;
    lockedUntil: Date | null;
    requiredSkipped: boolean;
    activeRevisionId: string;
  } | null,
  activeRevisionId: string | null,
  now: Date,
) => {
  if (!state || !activeRevisionId) {
    return {
      status: StudentTaskStatus.not_started,
      wrongAttempts: 0,
      blockedUntil: null as Date | null,
      requiredSkipped: false,
    };
  }

  if (!creditedStatuses.has(state.status) && state.activeRevisionId !== activeRevisionId) {
    return {
      status: StudentTaskStatus.not_started,
      wrongAttempts: 0,
      blockedUntil: null as Date | null,
      requiredSkipped: false,
    };
  }

  const isBlocked = Boolean(state.lockedUntil && state.lockedUntil > now);
  const status =
    state.status === StudentTaskStatus.blocked && !isBlocked
      ? state.wrongAttempts > 0
        ? StudentTaskStatus.in_progress
        : StudentTaskStatus.not_started
      : state.status;

  return {
    status,
    wrongAttempts: state.wrongAttempts,
    blockedUntil: isBlocked ? state.lockedUntil : null,
    requiredSkipped: state.requiredSkipped,
  };
};

@Injectable()
export class StudentsService {
  constructor(private readonly prisma: PrismaService) {}

  private extractStudentIdFromPayload(payload: unknown) {
    if (!payload || typeof payload !== 'object') return null;
    const value = (payload as Record<string, unknown>).studentId;
    return typeof value === 'string' && value ? value : null;
  }

  async assertTeacherOwnsStudent(teacherId: string, studentId: string) {
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
    if (profile.leadTeacherId !== teacherId) {
      throw new ForbiddenException('Student is not assigned to this teacher');
    }

    return profile;
  }

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

    const studentIdSet = new Set(students.map((student) => student.userId));
    const unreadNotifications = await this.prisma.notification.findMany({
      where: {
        recipientUserId: leaderTeacherId,
        readAt: null,
      },
      select: { payload: true },
    });
    const activeNotificationsMap = new Map<string, number>();
    unreadNotifications.forEach((notification) => {
      const studentId = this.extractStudentIdFromPayload(notification.payload);
      if (!studentId || !studentIdSet.has(studentId)) return;
      activeNotificationsMap.set(studentId, (activeNotificationsMap.get(studentId) ?? 0) + 1);
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
      activeNotificationsCount: activeNotificationsMap.get(student.userId) ?? 0,
    }));
  }

  async getStudentProfileDetails(teacherId: string, studentId: string, courseId?: string) {
    const profile = await this.assertTeacherOwnsStudent(teacherId, studentId);

    const notifications = await this.prisma.notification.findMany({
      where: {
        recipientUserId: teacherId,
        payload: {
          path: ['studentId'],
          equals: studentId,
        },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        payload: true,
        createdAt: true,
        readAt: true,
      },
    });
    const activeNotificationsCount = notifications.filter((item) => !item.readAt).length;

    const courses = await this.prisma.course.findMany({
      where: { status: ContentStatus.published },
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    });

    const selectedCourseId =
      (courseId && courses.some((course) => course.id === courseId) ? courseId : null) ??
      courses[0]?.id ??
      null;

    let courseTree: {
      id: string;
      title: string;
      sections: Array<{
        id: string;
        title: string;
        sortOrder: number;
        units: Array<{
          id: string;
          title: string;
          sortOrder: number;
          state: {
            status: StudentUnitStatus;
            completionPercent: number;
            solvedPercent: number;
            countedTasks: number;
            solvedTasks: number;
            totalTasks: number;
            overrideOpened: boolean;
          };
          tasks: Array<{
            id: string;
            title: string | null;
            statementLite: string;
            answerType: string;
            isRequired: boolean;
            sortOrder: number;
            state: {
              status: StudentTaskStatus;
              attemptsUsed: number;
              wrongAttempts: number;
              blockedUntil: Date | null;
              requiredSkippedFlag: boolean;
              isCredited: boolean;
              isTeacherCredited: boolean;
              canTeacherCredit: boolean;
            };
          }>;
        }>;
      }>;
    } | null = null;

    if (selectedCourseId) {
      const course = await this.prisma.course.findFirst({
        where: { id: selectedCourseId, status: ContentStatus.published },
        include: {
          sections: {
            where: { status: ContentStatus.published },
            orderBy: { sortOrder: 'asc' },
            include: {
              units: {
                where: { status: ContentStatus.published },
                orderBy: { sortOrder: 'asc' },
                include: {
                  tasks: {
                    where: { status: ContentStatus.published },
                    orderBy: { sortOrder: 'asc' },
                    include: {
                      activeRevision: {
                        select: {
                          statementLite: true,
                          answerType: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (course) {
        const allTasks = course.sections.flatMap((section) =>
          section.units.flatMap((unit) => unit.tasks),
        );
        const allUnitIds = course.sections.flatMap((section) => section.units.map((unit) => unit.id));
        const taskIds = allTasks.map((task) => task.id);
        const activeRevisionIds = allTasks
          .map((task) => task.activeRevisionId)
          .filter((value): value is string => Boolean(value));

        const states = taskIds.length
          ? await this.prisma.studentTaskState.findMany({
              where: { studentId, taskId: { in: taskIds } },
              select: {
                taskId: true,
                status: true,
                wrongAttempts: true,
                lockedUntil: true,
                requiredSkipped: true,
                activeRevisionId: true,
              },
            })
          : [];
        const attemptsUsed = taskIds.length
          ? await this.prisma.attempt.groupBy({
              by: ['taskId', 'taskRevisionId'],
              where: {
                studentId,
                taskId: { in: taskIds },
                kind: { not: AttemptKind.photo },
                ...(activeRevisionIds.length
                  ? { taskRevisionId: { in: activeRevisionIds } }
                  : null),
              },
              _count: { _all: true },
            })
          : [];
        const unitStates = allUnitIds.length
          ? await this.prisma.studentUnitState.findMany({
              where: { studentId, unitId: { in: allUnitIds } },
              select: {
                unitId: true,
                status: true,
                completionPercent: true,
                solvedPercent: true,
                countedTasks: true,
                solvedTasks: true,
                totalTasks: true,
                overrideOpened: true,
              },
            })
          : [];

        const statesMap = new Map(states.map((state) => [state.taskId, state]));
        const attemptsMap = new Map(
          attemptsUsed.map((item) => [`${item.taskId}:${item.taskRevisionId}`, item._count._all]),
        );
        const unitStatesMap = new Map(unitStates.map((state) => [state.unitId, state]));
        const now = new Date();

        courseTree = {
          id: course.id,
          title: course.title,
          sections: course.sections.map((section) => ({
            id: section.id,
            title: section.title,
            sortOrder: section.sortOrder,
            units: section.units.map((unit) => ({
              id: unit.id,
              title: unit.title,
              sortOrder: unit.sortOrder,
              state: {
                status: unitStatesMap.get(unit.id)?.status ?? StudentUnitStatus.locked,
                completionPercent: unitStatesMap.get(unit.id)?.completionPercent ?? 0,
                solvedPercent: unitStatesMap.get(unit.id)?.solvedPercent ?? 0,
                countedTasks: unitStatesMap.get(unit.id)?.countedTasks ?? 0,
                solvedTasks: unitStatesMap.get(unit.id)?.solvedTasks ?? 0,
                totalTasks: unitStatesMap.get(unit.id)?.totalTasks ?? unit.tasks.length,
                overrideOpened: unitStatesMap.get(unit.id)?.overrideOpened ?? false,
              },
              tasks: unit.tasks.map((task) => {
                const normalizedState = normalizeTaskState(
                  statesMap.get(task.id) ?? null,
                  task.activeRevisionId,
                  now,
                );
                const attemptsKey = task.activeRevisionId
                  ? `${task.id}:${task.activeRevisionId}`
                  : '';
                const status = normalizedState.status;
                return {
                  id: task.id,
                  title: task.title,
                  statementLite: task.activeRevision?.statementLite ?? '',
                  answerType: task.activeRevision?.answerType ?? 'numeric',
                  isRequired: task.isRequired,
                  sortOrder: task.sortOrder,
                  state: {
                    status,
                    attemptsUsed: attemptsKey ? (attemptsMap.get(attemptsKey) ?? 0) : 0,
                    wrongAttempts: normalizedState.wrongAttempts,
                    blockedUntil: normalizedState.blockedUntil,
                    requiredSkippedFlag: normalizedState.requiredSkipped,
                    isCredited: creditedStatuses.has(status),
                    isTeacherCredited: status === StudentTaskStatus.teacher_credited,
                    canTeacherCredit:
                      status !== StudentTaskStatus.correct &&
                      status !== StudentTaskStatus.accepted &&
                      status !== StudentTaskStatus.teacher_credited,
                  },
                };
              }),
            })),
          })),
        };
      }
    }

    return {
      profile: {
        id: profile.user.id,
        login: profile.user.login,
        firstName: profile.firstName,
        lastName: profile.lastName,
        leadTeacherId: profile.leadTeacherId,
        leadTeacherLogin: profile.leadTeacher.login,
      },
      notifications: {
        activeCount: activeNotificationsCount,
        items: notifications,
      },
      courses,
      selectedCourseId,
      courseTree,
    };
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
    await this.assertTeacherOwnsStudent(leaderTeacherId, studentId);

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
    const profile = await this.assertTeacherOwnsStudent(leaderTeacherId, studentId);

    const password = generatePassword();
    const passwordHash = await argon2.hash(password);

    await this.prisma.user.update({
      where: { id: profile.userId },
      data: { passwordHash },
    });

    return { id: profile.userId, login: profile.user.login, password };
  }

  async transferStudent(studentId: string, leaderTeacherId: string, nextTeacherId: string) {
    const profile = await this.assertTeacherOwnsStudent(leaderTeacherId, studentId);
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
    const profile = await this.assertTeacherOwnsStudent(leaderTeacherId, studentId);

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
