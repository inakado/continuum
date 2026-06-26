import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  AttemptResult,
  NotificationType,
  PhotoTaskSubmissionAnswerKind,
  type Prisma,
  StudentTaskStatus,
} from '@prisma/client';
import type {
  TeacherPhotoAcceptRequest,
  TeacherPhotoFeedbackBoardPresignUploadRequest,
  TeacherPhotoRejectRequest,
} from '@continuum/shared';
import type { ObjectStorageService } from '../infra/storage/object-storage.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { StudentsService } from '../students/students.service';
import type { LearningAuditLogService } from './learning-audit-log.service';
import type { LearningAvailabilityService } from './learning-availability.service';
import type { PhotoTaskPolicyService } from './photo-task-policy.service';
import { mapSubmission, parseAssetKeysJson } from './photo-task-read.shared';
import {
  buildGeneratedAssetKey,
  buildPhotoTaskTeacherFeedbackAssetPrefix,
  mapPhotoTaskState,
  mapPhotoUnitSnapshot,
} from './photo-task-write.shared';

type TeacherFeedbackBoardKeys = {
  teacherFeedbackBoardAssetKey?: string;
  teacherFeedbackPreviewAssetKey?: string;
};

const buildTeacherReviewAuditAnswerPayload = (submission: {
  answerKind: PhotoTaskSubmissionAnswerKind;
  assetKeysJson: Prisma.JsonValue;
  boardAssetKey: string | null;
  boardPreviewAssetKey: string | null;
  teacherFeedbackBoardAssetKey: string | null;
  teacherFeedbackPreviewAssetKey: string | null;
}) => ({
  answer_kind: submission.answerKind,
  ...(submission.answerKind === PhotoTaskSubmissionAnswerKind.board
    ? {
        board_asset_key: submission.boardAssetKey,
        board_preview_asset_key: submission.boardPreviewAssetKey,
      }
    : {
        asset_keys: parseAssetKeysJson(submission.assetKeysJson),
      }),
  ...(submission.teacherFeedbackBoardAssetKey && submission.teacherFeedbackPreviewAssetKey
    ? {
        teacher_feedback_board_asset_key: submission.teacherFeedbackBoardAssetKey,
        teacher_feedback_preview_asset_key: submission.teacherFeedbackPreviewAssetKey,
      }
    : null),
});

const getTeacherFeedbackBoardKeys = (body?: TeacherFeedbackBoardKeys) => {
  if (!body?.teacherFeedbackBoardAssetKey || !body.teacherFeedbackPreviewAssetKey) return null;
  return {
    teacherFeedbackBoardAssetKey: body.teacherFeedbackBoardAssetKey,
    teacherFeedbackPreviewAssetKey: body.teacherFeedbackPreviewAssetKey,
  };
};

const validateTeacherFeedbackBoardKeys = ({
  feedbackKeys,
  photoTaskPolicyService,
  studentId,
  submission,
  taskId,
}: {
  feedbackKeys: NonNullable<ReturnType<typeof getTeacherFeedbackBoardKeys>> | null;
  photoTaskPolicyService: PhotoTaskPolicyService;
  studentId: string;
  submission: {
    answerKind: PhotoTaskSubmissionAnswerKind;
    taskRevisionId: string;
  };
  taskId: string;
}) => {
  if (!feedbackKeys) return;
  if (submission.answerKind !== PhotoTaskSubmissionAnswerKind.board) {
    throw new ConflictException({
      code: 'FEEDBACK_BOARD_UNSUPPORTED',
      message: 'teacher feedback board is supported only for board submissions',
    });
  }

  photoTaskPolicyService.assertTeacherFeedbackBoardAssetKeysMatchGeneratedPattern({
    ...feedbackKeys,
    prefix: buildPhotoTaskTeacherFeedbackAssetPrefix(taskId, studentId, submission.taskRevisionId),
  });
};

const createStudentPhotoReviewedNotification = async ({
  status,
  studentId,
  submission,
  teacherId,
  tx,
}: {
  status: 'accepted' | 'rejected';
  studentId: string;
  submission: {
    id: string;
    answerKind: PhotoTaskSubmissionAnswerKind;
    taskId: string;
    taskRevisionId: string;
    unitId: string;
    teacherFeedbackBoardAssetKey: string | null;
    teacherFeedbackPreviewAssetKey: string | null;
  };
  teacherId: string;
  tx: Prisma.TransactionClient;
}) => {
  await tx.notification.create({
    data: {
      recipientUserId: studentId,
      type: NotificationType.photo_reviewed,
      payload: {
        studentId,
        teacherId,
        submissionId: submission.id,
        taskId: submission.taskId,
        taskRevisionId: submission.taskRevisionId,
        unitId: submission.unitId,
        status,
        answerKind: submission.answerKind,
        ...(submission.teacherFeedbackBoardAssetKey && submission.teacherFeedbackPreviewAssetKey
          ? {
              teacherFeedbackBoardAssetKey: submission.teacherFeedbackBoardAssetKey,
              teacherFeedbackPreviewAssetKey: submission.teacherFeedbackPreviewAssetKey,
            }
          : null),
      },
    },
  });
};

export const presignTeacherFeedbackBoardUpload = async ({
  body,
  objectStorageService,
  photoTaskPolicyService,
  prisma,
  studentId,
  studentsService,
  submissionId,
  taskId,
  teacherId,
}: {
  body: TeacherPhotoFeedbackBoardPresignUploadRequest;
  objectStorageService: ObjectStorageService;
  photoTaskPolicyService: PhotoTaskPolicyService;
  prisma: PrismaService;
  studentId: string;
  studentsService: StudentsService;
  submissionId: string;
  taskId: string;
  teacherId: string;
}) => {
  await studentsService.assertTeacherOwnsStudent(teacherId, studentId);

  const submission = await prisma.photoTaskSubmission.findFirst({
    where: {
      id: submissionId,
      studentUserId: studentId,
      taskId,
      answerKind: PhotoTaskSubmissionAnswerKind.board,
      status: 'submitted',
    },
    select: {
      taskRevisionId: true,
    },
  });

  if (!submission) {
    throw new NotFoundException({
      code: 'PHOTO_SUBMISSION_NOT_FOUND',
      message: 'Photo submission not found',
    });
  }

  const ttlSec = photoTaskPolicyService.resolveUploadTtl(body.ttlSec);
  const prefix = buildPhotoTaskTeacherFeedbackAssetPrefix(taskId, studentId, submission.taskRevisionId);
  const teacherFeedbackBoardAssetKey = buildGeneratedAssetKey({
    contentTypeExtension: 'json',
    index: 0,
    prefix,
  });
  const teacherFeedbackPreviewAssetKey = buildGeneratedAssetKey({
    contentTypeExtension: 'png',
    index: 1,
    prefix,
  });

  const [board, preview] = await Promise.all([
    objectStorageService.presignPutObject(
      teacherFeedbackBoardAssetKey,
      photoTaskPolicyService.boardJsonContentType(),
      ttlSec,
    ),
    objectStorageService.presignPutObject(
      teacherFeedbackPreviewAssetKey,
      photoTaskPolicyService.boardPreviewContentType(),
      ttlSec,
    ),
  ]);

  return {
    board: {
      assetKey: teacherFeedbackBoardAssetKey,
      url: board.url,
      headers: board.headers,
      contentType: photoTaskPolicyService.boardJsonContentType(),
    },
    preview: {
      assetKey: teacherFeedbackPreviewAssetKey,
      url: preview.url,
      headers: preview.headers,
      contentType: photoTaskPolicyService.boardPreviewContentType(),
    },
    expiresInSec: ttlSec,
  };
};

export const acceptTeacherPhotoSubmission = async ({
  body,
  learningAuditLogService,
  learningAvailabilityService,
  photoTaskPolicyService,
  prisma,
  studentId,
  studentsService,
  submissionId,
  taskId,
  teacherId,
}: {
  body: TeacherPhotoAcceptRequest;
  learningAuditLogService: LearningAuditLogService;
  learningAvailabilityService: LearningAvailabilityService;
  photoTaskPolicyService: PhotoTaskPolicyService;
  prisma: PrismaService;
  studentId: string;
  studentsService: StudentsService;
  submissionId: string;
  taskId: string;
  teacherId: string;
}) => {
  await studentsService.assertTeacherOwnsStudent(teacherId, studentId);
  const feedbackKeys = getTeacherFeedbackBoardKeys(body);

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
    validateTeacherFeedbackBoardKeys({
      feedbackKeys,
      photoTaskPolicyService,
      studentId,
      submission,
      taskId,
    });

    const now = new Date();

    const updatedSubmission = await tx.photoTaskSubmission.update({
      where: { id: submission.id },
      data: {
        status: 'accepted',
        reviewedByTeacherUserId: teacherId,
        reviewedAt: now,
        rejectedReason: null,
        teacherFeedbackBoardAssetKey: feedbackKeys?.teacherFeedbackBoardAssetKey ?? null,
        teacherFeedbackPreviewAssetKey: feedbackKeys?.teacherFeedbackPreviewAssetKey ?? null,
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

    await createStudentPhotoReviewedNotification({
      status: 'accepted',
      studentId,
      submission: updatedSubmission,
      teacherId,
      tx,
    });

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
      ...buildTeacherReviewAuditAnswerPayload(txResult.submission),
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
  photoTaskPolicyService,
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
  photoTaskPolicyService: PhotoTaskPolicyService;
  prisma: PrismaService;
  studentId: string;
  studentsService: StudentsService;
  submissionId: string;
  taskId: string;
  teacherId: string;
}) => {
  await studentsService.assertTeacherOwnsStudent(teacherId, studentId);
  const reason = body.reason?.trim() ?? '';
  const feedbackKeys = getTeacherFeedbackBoardKeys(body);

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
    validateTeacherFeedbackBoardKeys({
      feedbackKeys,
      photoTaskPolicyService,
      studentId,
      submission,
      taskId,
    });

    const now = new Date();

    const updatedSubmission = await tx.photoTaskSubmission.update({
      where: { id: submission.id },
      data: {
        status: 'rejected',
        reviewedByTeacherUserId: teacherId,
        reviewedAt: now,
        rejectedReason: reason || null,
        teacherFeedbackBoardAssetKey: feedbackKeys?.teacherFeedbackBoardAssetKey ?? null,
        teacherFeedbackPreviewAssetKey: feedbackKeys?.teacherFeedbackPreviewAssetKey ?? null,
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

    await createStudentPhotoReviewedNotification({
      status: 'rejected',
      studentId,
      submission: updatedSubmission,
      teacherId,
      tx,
    });

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
      ...buildTeacherReviewAuditAnswerPayload(txResult.submission),
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
