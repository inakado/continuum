import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ContentStatus, Prisma, StudentTaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StudentsService } from '../students/students.service';
import { LearningAuditLogService } from './learning-audit-log.service';
import { LearningAvailabilityService } from './learning-availability.service';

@Injectable()
export class LearningTeacherActionsService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(LearningAuditLogService)
    private readonly learningAuditLogService: LearningAuditLogService,
    @Inject(LearningAvailabilityService)
    private readonly learningAvailabilityService: LearningAvailabilityService,
    @Inject(StudentsService)
    private readonly studentsService: StudentsService,
  ) {}

  async listNotifications(teacherId: string, studentId?: string) {
    if (!studentId) {
      throw new BadRequestException({
        code: 'STUDENT_ID_REQUIRED',
        message: 'studentId is required',
      });
    }

    await this.studentsService.assertTeacherOwnsStudent(teacherId, studentId);

    return this.prisma.notification.findMany({
      where: {
        recipientUserId: teacherId,
        payload: {
          path: ['studentId'],
          equals: studentId,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async overrideOpenUnit(
    teacherId: string,
    studentId: string,
    unitId: string,
    reasonRaw?: string | null,
  ) {
    await this.studentsService.assertTeacherOwnsStudent(teacherId, studentId);

    const unit = await this.prisma.unit.findFirst({
      where: {
        id: unitId,
        status: ContentStatus.published,
        section: {
          status: ContentStatus.published,
          course: { status: ContentStatus.published },
        },
      },
      select: {
        id: true,
        sectionId: true,
        section: {
          select: {
            courseId: true,
          },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException({
        code: 'UNIT_NOT_FOUND',
        message: 'Unit not found',
      });
    }

    const normalizedReason =
      typeof reasonRaw === 'string' && reasonRaw.trim().length > 0 ? reasonRaw.trim() : null;

    try {
      await this.prisma.$transaction(async (tx) => {
        const existingOverride = await tx.unitUnlockOverride.findUnique({
          where: {
            studentId_unitId: {
              studentId,
              unitId,
            },
          },
          select: { id: true },
        });

        if (existingOverride) {
          throw new ConflictException({
            code: 'OVERRIDE_ALREADY_EXISTS',
            message: 'Override already exists',
          });
        }

        await tx.unitUnlockOverride.create({
          data: {
            studentId,
            unitId,
            openedByTeacherId: teacherId,
            reason: normalizedReason,
          },
        });

        await this.learningAvailabilityService.recomputeSectionAvailability(
          studentId,
          unit.sectionId,
          tx,
        );
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: 'OVERRIDE_ALREADY_EXISTS',
          message: 'Override already exists',
        });
      }
      throw error;
    }

    await this.learningAuditLogService.appendTeacherAdminEvent({
      eventType: 'UnitOverrideOpenedForStudent',
      teacherId,
      entityType: 'unit',
      entityId: unitId,
      payload: {
        teacher_id: teacherId,
        teacherId: teacherId,
        student_id: studentId,
        studentUserId: studentId,
        unit_id: unitId,
        unitId: unitId,
        section_id: unit.sectionId,
        sectionId: unit.sectionId,
        course_id: unit.section.courseId,
        courseId: unit.section.courseId,
        reason: normalizedReason,
      },
    });

    return { ok: true };
  }

  async overrideOpenSection(
    teacherId: string,
    studentId: string,
    sectionId: string,
    reasonRaw?: string | null,
  ) {
    await this.studentsService.assertTeacherOwnsStudent(teacherId, studentId);

    const section = await this.prisma.section.findFirst({
      where: {
        id: sectionId,
        status: ContentStatus.published,
        course: { status: ContentStatus.published },
      },
      select: {
        id: true,
        courseId: true,
      },
    });

    if (!section) {
      throw new NotFoundException({
        code: 'SECTION_NOT_FOUND',
        message: 'Section not found',
      });
    }

    const normalizedReason =
      typeof reasonRaw === 'string' && reasonRaw.trim().length > 0 ? reasonRaw.trim() : null;

    try {
      await this.prisma.$transaction(async (tx) => {
        const existingOverride = await tx.sectionUnlockOverride.findUnique({
          where: {
            studentId_sectionId: {
              studentId,
              sectionId,
            },
          },
          select: { id: true },
        });

        if (existingOverride) {
          throw new ConflictException({
            code: 'SECTION_OVERRIDE_ALREADY_EXISTS',
            message: 'Section override already exists',
          });
        }

        await tx.sectionUnlockOverride.create({
          data: {
            studentId,
            sectionId,
            openedByTeacherId: teacherId,
            reason: normalizedReason,
          },
        });

        await this.learningAvailabilityService.recomputeSectionAvailability(studentId, sectionId, tx);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException({
          code: 'SECTION_OVERRIDE_ALREADY_EXISTS',
          message: 'Section override already exists',
        });
      }
      throw error;
    }

    await this.learningAuditLogService.appendTeacherAdminEvent({
      eventType: 'SectionOverrideOpenedForStudent',
      teacherId,
      entityType: 'section',
      entityId: sectionId,
      payload: {
        teacher_id: teacherId,
        teacherId: teacherId,
        student_id: studentId,
        studentUserId: studentId,
        section_id: sectionId,
        sectionId: sectionId,
        course_id: section.courseId,
        courseId: section.courseId,
        reason: normalizedReason,
      },
    });

    return { ok: true };
  }

  async creditTask(teacherId: string, studentId: string, taskId: string) {
    return this.creditTaskWithReason(teacherId, studentId, taskId, null);
  }

  async creditTaskWithReason(
    teacherId: string,
    studentId: string,
    taskId: string,
    reasonRaw?: string | null,
  ) {
    await this.studentsService.assertTeacherOwnsStudent(teacherId, studentId);
    const now = new Date();
    const normalizedReason =
      typeof reasonRaw === 'string' && reasonRaw.trim().length > 0 ? reasonRaw.trim() : null;

    const result = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.findFirst({
        where: {
          id: taskId,
          status: ContentStatus.published,
          unit: {
            status: ContentStatus.published,
            section: {
              status: ContentStatus.published,
              course: { status: ContentStatus.published },
            },
          },
        },
        select: {
          id: true,
          activeRevisionId: true,
          unit: {
            select: {
              id: true,
              sectionId: true,
              section: {
                select: {
                  courseId: true,
                },
              },
            },
          },
        },
      });
      if (!task) {
        throw new NotFoundException({
          code: 'TASK_NOT_FOUND',
          message: 'Task not found',
        });
      }
      if (!task.activeRevisionId) {
        throw new ConflictException({
          code: 'TASK_ACTIVE_REVISION_MISSING',
          message: 'Task active revision is missing',
        });
      }

      const existingState = await tx.studentTaskState.findUnique({
        where: { studentId_taskId: { studentId, taskId } },
      });

      const alreadyCreditedStatuses = new Set<StudentTaskStatus>([
        StudentTaskStatus.correct,
        StudentTaskStatus.accepted,
        StudentTaskStatus.teacher_credited,
      ]);
      if (existingState && alreadyCreditedStatuses.has(existingState.status)) {
        throw new ConflictException({
          code: 'TASK_ALREADY_CREDITED',
          message: 'Task already credited',
        });
      }

      const updated = existingState
        ? await tx.studentTaskState.update({
            where: { studentId_taskId: { studentId, taskId } },
            data: {
              status: StudentTaskStatus.teacher_credited,
              activeRevisionId: task.activeRevisionId,
              wrongAttempts: 0,
              lockedUntil: null,
              requiredSkipped: false,
              creditedRevisionId: task.activeRevisionId,
              creditedAt: now,
              updatedAt: now,
            },
          })
        : await tx.studentTaskState.create({
            data: {
              studentId,
              taskId,
              status: StudentTaskStatus.teacher_credited,
              activeRevisionId: task.activeRevisionId,
              wrongAttempts: 0,
              lockedUntil: null,
              requiredSkipped: false,
              creditedRevisionId: task.activeRevisionId,
              creditedAt: now,
              updatedAt: now,
            },
          });

      await this.learningAvailabilityService.recomputeSectionAvailability(
        studentId,
        task.unit.sectionId,
        tx,
      );

      return {
        taskId: task.id,
        unitId: task.unit.id,
        sectionId: task.unit.sectionId,
        courseId: task.unit.section.courseId,
        previousStatus: existingState?.status ?? null,
        updated,
      };
    });

    await this.learningAuditLogService.appendTeacherAdminEvent({
      eventType: 'TaskTeacherCreditedForStudent',
      teacherId,
      entityType: 'task',
      entityId: taskId,
      payload: {
        teacher_id: teacherId,
        teacherId: teacherId,
        student_id: studentId,
        studentUserId: studentId,
        task_id: result.taskId,
        taskId: result.taskId,
        unit_id: result.unitId,
        unitId: result.unitId,
        section_id: result.sectionId,
        sectionId: result.sectionId,
        course_id: result.courseId,
        courseId: result.courseId,
        task_revision_id: result.updated.creditedRevisionId ?? result.updated.activeRevisionId,
        prevStatus: result.previousStatus,
        newStatus: result.updated.status,
        reason: normalizedReason,
      },
    });

    return {
      ok: true,
      status: result.updated.status,
      taskId: result.taskId,
      studentId,
    };
  }

  async unblockTask(
    teacherId: string,
    studentId: string,
    taskId: string,
    reasonRaw?: string | null,
  ) {
    await this.studentsService.assertTeacherOwnsStudent(teacherId, studentId);
    const now = new Date();
    const normalizedReason =
      typeof reasonRaw === 'string' && reasonRaw.trim().length > 0 ? reasonRaw.trim() : null;

    const result = await this.prisma.$transaction(async (tx) => {
      const task = await tx.task.findFirst({
        where: {
          id: taskId,
          status: ContentStatus.published,
          unit: {
            status: ContentStatus.published,
            section: {
              status: ContentStatus.published,
              course: { status: ContentStatus.published },
            },
          },
        },
        select: {
          id: true,
          activeRevisionId: true,
          unit: {
            select: {
              id: true,
              sectionId: true,
              section: {
                select: {
                  courseId: true,
                },
              },
            },
          },
        },
      });
      if (!task) {
        throw new NotFoundException({
          code: 'TASK_NOT_FOUND',
          message: 'Task not found',
        });
      }

      const state = await tx.studentTaskState.findUnique({
        where: { studentId_taskId: { studentId, taskId } },
      });
      if (!state) {
        throw new NotFoundException({
          code: 'TASK_STATE_NOT_FOUND',
          message: 'Task state not found',
        });
      }

      const isBlocked =
        state.status === StudentTaskStatus.blocked || Boolean(state.lockedUntil && state.lockedUntil > now);
      if (!isBlocked) {
        throw new ConflictException({
          code: 'TASK_NOT_BLOCKED',
          message: 'Task is not blocked',
        });
      }

      const nextStatus =
        state.status === StudentTaskStatus.not_started
          ? StudentTaskStatus.not_started
          : StudentTaskStatus.in_progress;

      const updated = await tx.studentTaskState.update({
        where: { studentId_taskId: { studentId, taskId } },
        data: {
          status: nextStatus,
          activeRevisionId: task.activeRevisionId ?? state.activeRevisionId,
          wrongAttempts: 0,
          lockedUntil: null,
          updatedAt: now,
        },
      });

      await this.learningAvailabilityService.recomputeSectionAvailability(
        studentId,
        task.unit.sectionId,
        tx,
      );

      return {
        taskId: task.id,
        unitId: task.unit.id,
        sectionId: task.unit.sectionId,
        courseId: task.unit.section.courseId,
        previousStatus: state.status,
        updated,
      };
    });

    await this.learningAuditLogService.appendTeacherAdminEvent({
      eventType: 'TaskUnblockedForStudent',
      teacherId,
      entityType: 'task',
      entityId: taskId,
      payload: {
        teacher_id: teacherId,
        teacherId: teacherId,
        student_id: studentId,
        studentUserId: studentId,
        task_id: result.taskId,
        taskId: result.taskId,
        unit_id: result.unitId,
        unitId: result.unitId,
        section_id: result.sectionId,
        sectionId: result.sectionId,
        course_id: result.courseId,
        courseId: result.courseId,
        prevStatus: result.previousStatus,
        newStatus: result.updated.status,
        reason: normalizedReason,
      },
    });

    return {
      ok: true,
      status: result.updated.status,
      taskId: result.taskId,
      studentId,
    };
  }
}
