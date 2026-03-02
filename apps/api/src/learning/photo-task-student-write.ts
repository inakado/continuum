import { ConflictException } from '@nestjs/common';
import { AttemptKind, AttemptResult, Prisma, StudentTaskStatus } from '@prisma/client';
import type {
  StudentPhotoPresignUploadRequest,
  StudentPhotoSubmitRequest,
} from '@continuum/shared';
import type { ObjectStorageService } from '../infra/storage/object-storage.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { LearningAuditLogService } from './learning-audit-log.service';
import type { LearningAvailabilityService } from './learning-availability.service';
import type { PhotoTaskPolicyService } from './photo-task-policy.service';
import {
  assertUnitAvailableForStudent,
  parseAssetKeysJson,
  requirePublishedPhotoTask,
} from './photo-task-read.shared';
import {
  buildGeneratedAssetKey,
  buildPhotoTaskAssetPrefix,
  mapPhotoTaskState,
  mapPhotoUnitSnapshot,
} from './photo-task-write.shared';

const CREDITED_STATUSES = new Set<StudentTaskStatus>([
  StudentTaskStatus.correct,
  StudentTaskStatus.credited_without_progress,
  StudentTaskStatus.teacher_credited,
  StudentTaskStatus.accepted,
]);

export const presignStudentPhotoUpload = async ({
  body,
  learningAvailabilityService,
  objectStorageService,
  photoTaskPolicyService,
  prisma,
  studentId,
  taskId,
}: {
  body: StudentPhotoPresignUploadRequest;
  learningAvailabilityService: LearningAvailabilityService;
  objectStorageService: ObjectStorageService;
  photoTaskPolicyService: PhotoTaskPolicyService;
  prisma: PrismaService;
  studentId: string;
  taskId: string;
}) => {
  const task = await requirePublishedPhotoTask(prisma, taskId);
  await assertUnitAvailableForStudent({
    learningAvailabilityService,
    sectionId: task.unit.sectionId,
    studentId,
    unitId: task.unit.id,
  });

  const ttlSec = photoTaskPolicyService.resolveUploadTtl(body.ttlSec);
  const prefix = buildPhotoTaskAssetPrefix(task.id, studentId, task.activeRevisionId);

  const uploads = await Promise.all(
    body.files.map(async (file, index) => {
      const ext = photoTaskPolicyService.extensionForContentType(file.contentType);
      const assetKey = buildGeneratedAssetKey({
        contentTypeExtension: ext,
        index,
        prefix,
      });
      const presigned = await objectStorageService.presignPutObject(assetKey, file.contentType, ttlSec);

      return {
        assetKey,
        url: presigned.url,
        headers: presigned.headers,
      };
    }),
  );

  return {
    uploads,
    expiresInSec: ttlSec,
  };
};

export const submitStudentPhotoTask = async ({
  body,
  learningAuditLogService,
  learningAvailabilityService,
  photoTaskPolicyService,
  prisma,
  studentId,
  taskId,
}: {
  body: StudentPhotoSubmitRequest;
  learningAuditLogService: LearningAuditLogService;
  learningAvailabilityService: LearningAvailabilityService;
  photoTaskPolicyService: PhotoTaskPolicyService;
  prisma: PrismaService;
  studentId: string;
  taskId: string;
}) => {
  const assetKeys = body.assetKeys;

  const txResult = await prisma.$transaction(async (tx) => {
    const task = await requirePublishedPhotoTask(tx, taskId);
    await assertUnitAvailableForStudent({
      learningAvailabilityService,
      sectionId: task.unit.sectionId,
      studentId,
      tx,
      unitId: task.unit.id,
    });

    const prefix = buildPhotoTaskAssetPrefix(task.id, studentId, task.activeRevisionId);
    photoTaskPolicyService.assertAssetKeysMatchGeneratedPattern(assetKeys, prefix);

    const now = new Date();
    const state = await tx.studentTaskState.findUnique({
      where: { studentId_taskId: { studentId, taskId: task.id } },
    });

    let currentState = state;
    if (!currentState) {
      currentState = await tx.studentTaskState.create({
        data: {
          studentId,
          taskId: task.id,
          status: StudentTaskStatus.not_started,
          activeRevisionId: task.activeRevisionId,
          wrongAttempts: 0,
          lockedUntil: null,
          requiredSkipped: false,
          creditedRevisionId: null,
          creditedAt: null,
          updatedAt: now,
        },
      });
    }

    if (!CREDITED_STATUSES.has(currentState.status) && currentState.activeRevisionId !== task.activeRevisionId) {
      currentState = await tx.studentTaskState.update({
        where: { studentId_taskId: { studentId, taskId: task.id } },
        data: {
          status: StudentTaskStatus.not_started,
          activeRevisionId: task.activeRevisionId,
          wrongAttempts: 0,
          lockedUntil: null,
          requiredSkipped: false,
          creditedRevisionId: null,
          creditedAt: null,
          updatedAt: now,
        },
      });
    }

    if (CREDITED_STATUSES.has(currentState.status)) {
      throw new ConflictException('Task already credited');
    }

    const lastAttempt = await tx.attempt.findFirst({
      where: {
        studentId,
        taskRevisionId: task.activeRevisionId,
      },
      orderBy: { attemptNo: 'desc' },
    });

    const attempt = await tx.attempt.create({
      data: {
        studentId,
        taskId: task.id,
        taskRevisionId: task.activeRevisionId,
        attemptNo: (lastAttempt?.attemptNo ?? 0) + 1,
        kind: AttemptKind.photo,
        numericAnswers: Prisma.DbNull,
        selectedChoiceKey: null,
        selectedChoiceKeys: Prisma.DbNull,
        result: AttemptResult.pending_review,
      },
    });

    const submission = await tx.photoTaskSubmission.create({
      data: {
        studentUserId: studentId,
        taskId: task.id,
        taskRevisionId: task.activeRevisionId,
        unitId: task.unitId,
        attemptId: attempt.id,
        assetKeysJson: assetKeys as unknown as Prisma.InputJsonValue,
        status: 'submitted',
        submittedAt: now,
      },
    });

    const taskState = await tx.studentTaskState.update({
      where: { studentId_taskId: { studentId, taskId: task.id } },
      data: {
        status: StudentTaskStatus.pending_review,
        activeRevisionId: task.activeRevisionId,
        wrongAttempts: 0,
        lockedUntil: null,
        requiredSkipped: false,
        creditedRevisionId: null,
        creditedAt: null,
        updatedAt: now,
      },
    });

    const snapshots = await learningAvailabilityService.recomputeSectionAvailability(studentId, task.unit.sectionId, tx);

    return {
      task,
      attempt,
      submission,
      taskState,
      unitSnapshot: snapshots.get(task.unit.id) ?? null,
    };
  });

  await learningAuditLogService.appendStudentLearningEvent({
    eventType: 'PhotoAttemptSubmitted',
    studentId,
    entityType: 'photo_submission',
    entityId: txResult.submission.id,
    payload: {
      student_id: studentId,
      task_id: txResult.task.id,
      unit_id: txResult.task.unitId,
      task_revision_id: txResult.task.activeRevisionId,
      attempt_id: txResult.attempt.id,
      asset_keys: parseAssetKeysJson(txResult.submission.assetKeysJson),
    },
  });

  return {
    ok: true,
    submissionId: txResult.submission.id,
    taskState: mapPhotoTaskState(txResult.taskState),
    ...(txResult.unitSnapshot ? { unitSnapshot: mapPhotoUnitSnapshot(txResult.unitSnapshot) } : null),
  };
};
