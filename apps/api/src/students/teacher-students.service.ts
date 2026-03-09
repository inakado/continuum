import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AttemptKind,
  ContentStatus,
  PhotoTaskSubmissionStatus,
  Role,
  StudentTaskStatus,
  StudentUnitStatus,
} from '@prisma/client';
import argon2 from 'argon2';
import type { PrismaService } from '../prisma/prisma.service';
import {
  buildLeadTeacherDisplayName,
  creditedStatuses,
  generatePassword,
  normalizeName,
  normalizeTaskState,
} from './students.shared';

export class TeacherStudentsService {
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
        leadTeacher: {
          select: {
            id: true,
            login: true,
            teacherProfile: {
              select: {
                firstName: true,
                middleName: true,
              },
            },
          },
        },
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
        leadTeacher: {
          select: {
            id: true,
            login: true,
            teacherProfile: {
              select: {
                firstName: true,
                middleName: true,
              },
            },
          },
        },
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
    const studentIds = students.map((student) => student.userId);
    const pendingPhotoReviewCounts = studentIds.length
      ? await this.prisma.photoTaskSubmission.groupBy({
          by: ['studentUserId'],
          where: {
            studentUserId: { in: studentIds },
            status: PhotoTaskSubmissionStatus.submitted,
          },
          _count: { _all: true },
        })
      : [];
    const pendingPhotoReviewMap = new Map(
      pendingPhotoReviewCounts.map((item) => [item.studentUserId, item._count._all]),
    );

    return students.map((student) => ({
      id: student.userId,
      login: student.user.login,
      firstName: student.firstName,
      lastName: student.lastName,
      leadTeacherId: student.leadTeacherId,
      leadTeacherLogin: student.leadTeacher.login,
      leadTeacherDisplayName: buildLeadTeacherDisplayName(student.leadTeacher),
      createdAt: student.createdAt,
      updatedAt: student.updatedAt,
      activeNotificationsCount: activeNotificationsMap.get(student.userId) ?? 0,
      pendingPhotoReviewCount: pendingPhotoReviewMap.get(student.userId) ?? 0,
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
            pendingPhotoReviewCount: number;
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
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
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
        const allTasks = course.sections.flatMap((section) => section.units.flatMap((unit) => unit.tasks));
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
                creditedRevisionId: true,
              },
            })
          : [];
        const activeAutoAttemptRevisionIds = new Set(activeRevisionIds);
        const creditedAttemptRevisionIds = new Set(
          states
            .map((state) => state.creditedRevisionId)
            .filter((value): value is string => Boolean(value)),
        );
        const allAttemptRevisionIds = new Set([
          ...activeAutoAttemptRevisionIds,
          ...creditedAttemptRevisionIds,
        ]);

        const autoAttemptsUsed = taskIds.length
          ? await this.prisma.attempt.groupBy({
              by: ['taskId', 'taskRevisionId'],
              where: {
                studentId,
                taskId: { in: taskIds },
                kind: { not: AttemptKind.photo },
                ...(activeAutoAttemptRevisionIds.size
                  ? { taskRevisionId: { in: [...activeAutoAttemptRevisionIds] } }
                  : null),
              },
              _count: { _all: true },
            })
          : [];
        const creditedAttemptsUsed = taskIds.length
          ? await this.prisma.attempt.groupBy({
              by: ['taskId', 'taskRevisionId'],
              where: {
                studentId,
                taskId: { in: taskIds },
                ...(allAttemptRevisionIds.size
                  ? { taskRevisionId: { in: [...allAttemptRevisionIds] } }
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
        const pendingPhotoReviewCountsByTask = taskIds.length
          ? await this.prisma.photoTaskSubmission.groupBy({
              by: ['taskId'],
              where: {
                studentUserId: studentId,
                taskId: { in: taskIds },
                status: PhotoTaskSubmissionStatus.submitted,
              },
              _count: { _all: true },
            })
          : [];

        const statesMap = new Map(states.map((state) => [state.taskId, state]));
        const autoAttemptsMap = new Map(
          autoAttemptsUsed.map((item) => [`${item.taskId}:${item.taskRevisionId}`, item._count._all]),
        );
        const creditedAttemptsMap = new Map(
          creditedAttemptsUsed.map((item) => [`${item.taskId}:${item.taskRevisionId}`, item._count._all]),
        );
        const unitStatesMap = new Map(unitStates.map((state) => [state.unitId, state]));
        const pendingPhotoReviewMap = new Map(
          pendingPhotoReviewCountsByTask.map((item) => [item.taskId, item._count._all]),
        );
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
                const activeAttemptsKey = task.activeRevisionId ? `${task.id}:${task.activeRevisionId}` : '';
                const stateSnapshot = statesMap.get(task.id) ?? null;
                const creditedAttemptsKey = stateSnapshot?.creditedRevisionId
                  ? `${task.id}:${stateSnapshot.creditedRevisionId}`
                  : '';
                const status = normalizedState.status;
                const attemptsUsed = creditedStatuses.has(status)
                  ? creditedAttemptsKey
                    ? (creditedAttemptsMap.get(creditedAttemptsKey) ?? 0)
                    : activeAttemptsKey
                      ? (creditedAttemptsMap.get(activeAttemptsKey) ?? 0)
                      : 0
                  : activeAttemptsKey
                    ? (autoAttemptsMap.get(activeAttemptsKey) ?? 0)
                    : 0;
                return {
                  id: task.id,
                  title: task.title,
                  statementLite: task.activeRevision?.statementLite ?? '',
                  answerType: task.activeRevision?.answerType ?? 'numeric',
                  isRequired: task.isRequired,
                  sortOrder: task.sortOrder,
                  pendingPhotoReviewCount: pendingPhotoReviewMap.get(task.id) ?? 0,
                  state: {
                    status,
                    attemptsUsed,
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
        leadTeacherDisplayName: buildLeadTeacherDisplayName(profile.leadTeacher),
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
