import { ConflictException, NotFoundException } from '@nestjs/common';
import { AttemptResult, StudentTaskStatus } from '@prisma/client';
import type { TeacherPhotoRejectRequest } from '@continuum/shared';
import type { PrismaService } from '../prisma/prisma.service';
import type { StudentsService } from '../students/students.service';
import type { LearningAuditLogService } from './learning-audit-log.service';
import type { LearningAvailabilityService } from './learning-availability.service';
import { mapSubmission } from './photo-task-read.shared';
import { mapPhotoTaskState, mapPhotoUnitSnapshot } from './photo-task-write.shared';

export const acceptTeacherPhotoSubmission = async ({
  learningAuditLogService,
  learningAvailabilityService,
  prisma,
  studentId,
  studentsService,
  submissionId,
  taskId,
  teacherId,
}: {
  learningAuditLogService: LearningAuditLogService;
  learningAvailabilityService: LearningAvailabilityService;
  prisma: PrismaService;
  studentId: string;
  studentsService: StudentsService;
  submissionId: string;
  taskId: string;
  teacherId: string;
}) => {
  await studentsService.assertTeacherOwnsStudent(teacherId, studentId);

  const txResult = await prisma.$transaction(async (tx) => {
    const submission = await tx.photoTaskSubmission.findFirst({
      where: {
        id: submissionId,
        studentUserId: studentId,
        taskId,
      },
      include: {
        task: {
          select: {
            id: true,
            unit: {
              select: {
                id: true,
                sectionId: true,
              },
            },
          },
        },
      },
    });

    if (!submission) throw new NotFoundException('Photo submission not found');
    if (submission.status !== 'submitted') {
      throw new ConflictException('Photo submission already reviewed');
    }

    const now = new Date();

    const updatedSubmission = await tx.photoTaskSubmission.update({
      where: { id: submission.id },
      data: {
        status: 'accepted',
        reviewedByTeacherUserId: teacherId,
        reviewedAt: now,
        rejectedReason: null,
      },
    });

    await tx.attempt.update({
      where: { id: submission.attemptId },
      data: {
        result: AttemptResult.accepted,
      },
    });

    const taskState = await tx.studentTaskState.upsert({
      where: { studentId_taskId: { studentId, taskId } },
      create: {
        studentId,
        taskId,
        status: StudentTaskStatus.accepted,
        activeRevisionId: submission.taskRevisionId,
        wrongAttempts: 0,
        lockedUntil: null,
        requiredSkipped: false,
        creditedRevisionId: submission.taskRevisionId,
        creditedAt: now,
        updatedAt: now,
      },
      update: {
        status: StudentTaskStatus.accepted,
        activeRevisionId: submission.taskRevisionId,
        wrongAttempts: 0,
        lockedUntil: null,
        requiredSkipped: false,
        creditedRevisionId: submission.taskRevisionId,
        creditedAt: now,
        updatedAt: now,
      },
    });

    const snapshots = await learningAvailabilityService.recomputeSectionAvailability(
      studentId,
      submission.task.unit.sectionId,
      tx,
    );

    return {
      submission: updatedSubmission,
      taskState,
      unitSnapshot: snapshots.get(submission.task.unit.id) ?? null,
    };
  });

  await learningAuditLogService.appendTeacherAdminEvent({
    eventType: 'PhotoAttemptAccepted',
    teacherId,
    entityType: 'photo_submission',
    entityId: txResult.submission.id,
    payload: {
      teacher_id: teacherId,
      student_id: studentId,
      task_id: taskId,
      unit_id: txResult.submission.unitId,
      task_revision_id: txResult.submission.taskRevisionId,
      attempt_id: txResult.submission.attemptId,
    },
  });

  return {
    ok: true,
    submission: mapSubmission(txResult.submission),
    taskState: mapPhotoTaskState(txResult.taskState),
    ...(txResult.unitSnapshot ? { unitSnapshot: mapPhotoUnitSnapshot(txResult.unitSnapshot) } : null),
  };
};

export const rejectTeacherPhotoSubmission = async ({
  body,
  learningAuditLogService,
  learningAvailabilityService,
  prisma,
  studentId,
  studentsService,
  submissionId,
  taskId,
  teacherId,
}: {
  body: TeacherPhotoRejectRequest;
  learningAuditLogService: LearningAuditLogService;
  learningAvailabilityService: LearningAvailabilityService;
  prisma: PrismaService;
  studentId: string;
  studentsService: StudentsService;
  submissionId: string;
  taskId: string;
  teacherId: string;
}) => {
  await studentsService.assertTeacherOwnsStudent(teacherId, studentId);
  const reason = body.reason?.trim() ?? '';

  const txResult = await prisma.$transaction(async (tx) => {
    const submission = await tx.photoTaskSubmission.findFirst({
      where: {
        id: submissionId,
        studentUserId: studentId,
        taskId,
      },
      include: {
        task: {
          select: {
            id: true,
            unit: {
              select: {
                id: true,
                sectionId: true,
              },
            },
          },
        },
      },
    });

    if (!submission) throw new NotFoundException('Photo submission not found');
    if (submission.status !== 'submitted') {
      throw new ConflictException('Photo submission already reviewed');
    }

    const now = new Date();

    const updatedSubmission = await tx.photoTaskSubmission.update({
      where: { id: submission.id },
      data: {
        status: 'rejected',
        reviewedByTeacherUserId: teacherId,
        reviewedAt: now,
        rejectedReason: reason || null,
      },
    });

    await tx.attempt.update({
      where: { id: submission.attemptId },
      data: {
        result: AttemptResult.rejected,
      },
    });

    const taskState = await tx.studentTaskState.upsert({
      where: { studentId_taskId: { studentId, taskId } },
      create: {
        studentId,
        taskId,
        status: StudentTaskStatus.rejected,
        activeRevisionId: submission.taskRevisionId,
        wrongAttempts: 0,
        lockedUntil: null,
        requiredSkipped: false,
        creditedRevisionId: null,
        creditedAt: null,
        updatedAt: now,
      },
      update: {
        status: StudentTaskStatus.rejected,
        activeRevisionId: submission.taskRevisionId,
        wrongAttempts: 0,
        lockedUntil: null,
        requiredSkipped: false,
        creditedRevisionId: null,
        creditedAt: null,
        updatedAt: now,
      },
    });

    const snapshots = await learningAvailabilityService.recomputeSectionAvailability(
      studentId,
      submission.task.unit.sectionId,
      tx,
    );

    return {
      submission: updatedSubmission,
      taskState,
      unitSnapshot: snapshots.get(submission.task.unit.id) ?? null,
    };
  });

  await learningAuditLogService.appendTeacherAdminEvent({
    eventType: 'PhotoAttemptRejected',
    teacherId,
    entityType: 'photo_submission',
    entityId: txResult.submission.id,
    payload: {
      teacher_id: teacherId,
      student_id: studentId,
      task_id: taskId,
      unit_id: txResult.submission.unitId,
      task_revision_id: txResult.submission.taskRevisionId,
      attempt_id: txResult.submission.attemptId,
      ...(txResult.submission.rejectedReason ? { reason: txResult.submission.rejectedReason } : null),
    },
  });

  return {
    ok: true,
    submission: mapSubmission(txResult.submission),
    taskState: mapPhotoTaskState(txResult.taskState),
    ...(txResult.unitSnapshot ? { unitSnapshot: mapPhotoUnitSnapshot(txResult.unitSnapshot) } : null),
  };
};
