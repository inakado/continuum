import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttemptKind,
  AttemptResult,
  ContentStatus,
  EventCategory,
  PhotoTaskSubmissionStatus,
  Prisma,
  Role,
  StudentTaskStatus,
  StudentUnitStatus,
  TaskAnswerType,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { EventsLogService } from '../events/events-log.service';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudentsService } from '../students/students.service';
import { LearningAvailabilityService, UnitProgressSnapshot } from './learning-availability.service';
import { PhotoTaskPolicyService } from './photo-task-policy.service';

type DbClient = PrismaService | Prisma.TransactionClient;
const PHOTO_SUBMISSION_STATUSES = new Set<PhotoTaskSubmissionStatus>([
  PhotoTaskSubmissionStatus.submitted,
  PhotoTaskSubmissionStatus.accepted,
  PhotoTaskSubmissionStatus.rejected,
]);

type PublishedPhotoTask = {
  id: string;
  unitId: string;
  activeRevisionId: string;
  unit: {
    id: string;
    sectionId: string;
  };
};

const CREDITED_STATUSES = new Set<StudentTaskStatus>([
  StudentTaskStatus.correct,
  StudentTaskStatus.credited_without_progress,
  StudentTaskStatus.teacher_credited,
  StudentTaskStatus.accepted,
]);

@Injectable()
export class PhotoTaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly studentsService: StudentsService,
    private readonly learningAvailabilityService: LearningAvailabilityService,
    private readonly eventsLogService: EventsLogService,
    private readonly objectStorageService: ObjectStorageService,
    private readonly photoTaskPolicyService: PhotoTaskPolicyService,
  ) {}

  async presignUpload(studentId: string, taskId: string, body: unknown) {
    const task = await this.requirePublishedPhotoTask(this.prisma, taskId);
    await this.assertUnitAvailableForStudent(studentId, task.unit.sectionId, task.unit.id);

    const payload = this.asRecord(body);
    const files = this.photoTaskPolicyService.validatePresignFiles(payload.files);
    const ttlSec = this.photoTaskPolicyService.resolveUploadTtl(payload.ttlSec);
    const prefix = this.buildAssetPrefix(task.id, studentId, task.activeRevisionId);

    const uploads = await Promise.all(
      files.map(async (file, index) => {
        const ext = this.photoTaskPolicyService.extensionForContentType(file.contentType);
        const assetKey = `${prefix}${Date.now()}-${randomBytes(4).toString('hex')}-${index + 1}.${ext}`;
        const presigned = await this.objectStorageService.presignPutObject(
          assetKey,
          file.contentType,
          ttlSec,
        );

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
  }

  async submit(studentId: string, taskId: string, body: unknown) {
    const payload = this.asRecord(body);
    const assetKeys = this.photoTaskPolicyService.parseAssetKeys(payload.assetKeys);

    const txResult = await this.prisma.$transaction(async (tx) => {
      const task = await this.requirePublishedPhotoTask(tx, taskId);
      await this.assertUnitAvailableForStudent(studentId, task.unit.sectionId, task.unit.id, tx);

      const prefix = this.buildAssetPrefix(task.id, studentId, task.activeRevisionId);
      this.photoTaskPolicyService.assertAssetKeysMatchGeneratedPattern(assetKeys, prefix);

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

      if (
        !CREDITED_STATUSES.has(currentState.status) &&
        currentState.activeRevisionId !== task.activeRevisionId
      ) {
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

      const snapshots = await this.learningAvailabilityService.recomputeSectionAvailability(
        studentId,
        task.unit.sectionId,
        tx,
      );

      return {
        task,
        attempt,
        submission,
        taskState,
        unitSnapshot: snapshots.get(task.unit.id) ?? null,
      };
    });

    await this.eventsLogService.append({
      category: EventCategory.learning,
      eventType: 'PhotoAttemptSubmitted',
      actorUserId: studentId,
      actorRole: Role.student,
      entityType: 'photo_submission',
      entityId: txResult.submission.id,
      payload: {
        student_id: studentId,
        task_id: txResult.task.id,
        unit_id: txResult.task.unitId,
        task_revision_id: txResult.task.activeRevisionId,
        attempt_id: txResult.attempt.id,
        asset_keys: this.parseAssetKeysJson(txResult.submission.assetKeysJson),
      },
    });

    return {
      ok: true,
      submissionId: txResult.submission.id,
      taskState: this.mapTaskState(txResult.taskState),
      ...(txResult.unitSnapshot ? { unitSnapshot: this.mapUnitSnapshot(txResult.unitSnapshot) } : null),
    };
  }

  async listForTeacher(teacherId: string, studentId: string, taskId: string) {
    await this.studentsService.assertTeacherOwnsStudent(teacherId, studentId);
    await this.requirePublishedPhotoTask(this.prisma, taskId);

    const submissions = await this.prisma.photoTaskSubmission.findMany({
      where: {
        studentUserId: studentId,
        taskId,
      },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        studentUserId: true,
        taskId: true,
        taskRevisionId: true,
        unitId: true,
        status: true,
        assetKeysJson: true,
        rejectedReason: true,
        submittedAt: true,
        reviewedAt: true,
        reviewedByTeacherUserId: true,
        attemptId: true,
      },
    });

    return {
      items: submissions.map((item) => this.mapSubmission(item)),
    };
  }

  async listForStudent(studentId: string, taskId: string) {
    const task = await this.requirePublishedPhotoTask(this.prisma, taskId);
    await this.assertUnitAvailableForStudent(studentId, task.unit.sectionId, task.unit.id);

    const submissions = await this.prisma.photoTaskSubmission.findMany({
      where: {
        studentUserId: studentId,
        taskId,
      },
      orderBy: { submittedAt: 'desc' },
      select: {
        id: true,
        studentUserId: true,
        taskId: true,
        taskRevisionId: true,
        unitId: true,
        status: true,
        assetKeysJson: true,
        rejectedReason: true,
        submittedAt: true,
        reviewedAt: true,
        reviewedByTeacherUserId: true,
        attemptId: true,
      },
    });

    return {
      items: submissions.map((item) => this.mapSubmission(item)),
    };
  }

  async listQueueForTeacher(
    teacherId: string,
    studentId: string,
    statusRaw: unknown,
    limitRaw: unknown,
    offsetRaw: unknown,
  ) {
    await this.studentsService.assertTeacherOwnsStudent(teacherId, studentId);

    const status = this.parseQueueStatus(statusRaw);
    const limit = this.parseLimit(limitRaw);
    const offset = this.parseOffset(offsetRaw);

    const where: Prisma.PhotoTaskSubmissionWhereInput = {
      studentUserId: studentId,
      ...(status ? { status } : null),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.photoTaskSubmission.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          taskId: true,
          unitId: true,
          status: true,
          submittedAt: true,
          rejectedReason: true,
          assetKeysJson: true,
          task: {
            select: {
              title: true,
              unit: {
                select: {
                  title: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.photoTaskSubmission.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        submissionId: item.id,
        taskId: item.taskId,
        taskTitle: item.task.title,
        unitId: item.unitId,
        unitTitle: item.task.unit.title,
        status: item.status,
        submittedAt: item.submittedAt,
        rejectedReason: item.rejectedReason,
        assetKeysCount: this.parseAssetKeysJson(item.assetKeysJson).length,
      })),
      total,
      limit,
      offset,
    };
  }

  async presignViewForStudent(
    studentId: string,
    taskId: string,
    assetKeyRaw: unknown,
    ttlRaw: unknown,
  ) {
    const task = await this.requirePublishedPhotoTask(this.prisma, taskId);
    await this.assertUnitAvailableForStudent(studentId, task.unit.sectionId, task.unit.id);

    const assetKey = this.photoTaskPolicyService.parseSingleAssetKey(assetKeyRaw);

    const owned = await this.prisma.photoTaskSubmission.findFirst({
      where: {
        studentUserId: studentId,
        taskId,
        assetKeysJson: {
          array_contains: [assetKey],
        },
      },
      select: { id: true },
    });

    if (!owned) {
      throw new ConflictException({
        code: 'INVALID_ASSET_KEY',
        message: 'assetKey is not found for this student/task',
      });
    }

    const ttlSec = this.photoTaskPolicyService.resolveViewTtl(Role.student, ttlRaw);
    const responseContentType = this.photoTaskPolicyService.inferResponseContentType(assetKey);
    const url = await this.objectStorageService.presignGetObject(assetKey, ttlSec, responseContentType);

    return {
      ok: true,
      assetKey,
      expiresInSec: ttlSec,
      url,
    };
  }

  async presignViewForTeacher(
    teacherId: string,
    studentId: string,
    taskId: string,
    assetKeyRaw: unknown,
    ttlRaw: unknown,
  ) {
    await this.studentsService.assertTeacherOwnsStudent(teacherId, studentId);
    await this.requirePublishedPhotoTask(this.prisma, taskId);

    const assetKey = this.photoTaskPolicyService.parseSingleAssetKey(assetKeyRaw);

    const owned = await this.prisma.photoTaskSubmission.findFirst({
      where: {
        studentUserId: studentId,
        taskId,
        assetKeysJson: {
          array_contains: [assetKey],
        },
      },
      select: { id: true },
    });

    if (!owned) {
      throw new ConflictException({
        code: 'INVALID_ASSET_KEY',
        message: 'assetKey is not found for this student/task',
      });
    }

    const ttlSec = this.photoTaskPolicyService.resolveViewTtl(Role.teacher, ttlRaw);
    const responseContentType = this.photoTaskPolicyService.inferResponseContentType(assetKey);
    const url = await this.objectStorageService.presignGetObject(assetKey, ttlSec, responseContentType);

    return {
      ok: true,
      assetKey,
      expiresInSec: ttlSec,
      url,
    };
  }

  async accept(teacherId: string, studentId: string, taskId: string, submissionId: string) {
    await this.studentsService.assertTeacherOwnsStudent(teacherId, studentId);

    const txResult = await this.prisma.$transaction(async (tx) => {
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

      const snapshots = await this.learningAvailabilityService.recomputeSectionAvailability(
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

    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'PhotoAttemptAccepted',
      actorUserId: teacherId,
      actorRole: Role.teacher,
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
      submission: this.mapSubmission(txResult.submission),
      taskState: this.mapTaskState(txResult.taskState),
      ...(txResult.unitSnapshot ? { unitSnapshot: this.mapUnitSnapshot(txResult.unitSnapshot) } : null),
    };
  }

  async reject(
    teacherId: string,
    studentId: string,
    taskId: string,
    submissionId: string,
    body: unknown,
  ) {
    await this.studentsService.assertTeacherOwnsStudent(teacherId, studentId);

    const reasonRaw = this.asRecord(body).reason;
    const reason = typeof reasonRaw === 'string' ? reasonRaw.trim() : '';

    const txResult = await this.prisma.$transaction(async (tx) => {
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

      const snapshots = await this.learningAvailabilityService.recomputeSectionAvailability(
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

    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'PhotoAttemptRejected',
      actorUserId: teacherId,
      actorRole: Role.teacher,
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
      submission: this.mapSubmission(txResult.submission),
      taskState: this.mapTaskState(txResult.taskState),
      ...(txResult.unitSnapshot ? { unitSnapshot: this.mapUnitSnapshot(txResult.unitSnapshot) } : null),
    };
  }

  private async requirePublishedPhotoTask(db: DbClient, taskId: string): Promise<PublishedPhotoTask> {
    const task = await db.task.findFirst({
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
        unitId: true,
        activeRevisionId: true,
        activeRevision: {
          select: {
            id: true,
            answerType: true,
          },
        },
        unit: {
          select: {
            id: true,
            sectionId: true,
          },
        },
      },
    });

    if (!task) throw new NotFoundException('Task not found');

    if (!task.activeRevisionId || !task.activeRevision) {
      throw new ConflictException({
        code: 'TASK_ACTIVE_REVISION_MISSING',
        message: 'Task active revision is missing',
      });
    }

    if (task.activeRevision.answerType !== TaskAnswerType.photo) {
      throw new ConflictException({
        code: 'TASK_NOT_PHOTO',
        message: 'Task is not a photo task',
      });
    }

    return {
      id: task.id,
      unitId: task.unitId,
      activeRevisionId: task.activeRevisionId,
      unit: {
        id: task.unit.id,
        sectionId: task.unit.sectionId,
      },
    };
  }

  private async assertUnitAvailableForStudent(
    studentId: string,
    sectionId: string,
    unitId: string,
    tx?: Prisma.TransactionClient,
  ) {
    const snapshots = await this.learningAvailabilityService.recomputeSectionAvailability(
      studentId,
      sectionId,
      tx,
    );
    const snapshot = snapshots.get(unitId);
    if (!snapshot || snapshot.status === StudentUnitStatus.locked) {
      throw new ConflictException({
        code: 'UNIT_LOCKED',
        message: 'Unit is locked',
      });
    }
  }

  private buildAssetPrefix(taskId: string, studentId: string, taskRevisionId: string): string {
    return `tasks/${taskId}/photo/${studentId}/${taskRevisionId}/`;
  }

  private mapTaskState(taskState: {
    status: StudentTaskStatus;
    wrongAttempts: number;
    lockedUntil: Date | null;
    requiredSkipped: boolean;
  }) {
    return {
      status: taskState.status,
      wrongAttempts: taskState.wrongAttempts,
      blockedUntil: taskState.lockedUntil,
      requiredSkipped: taskState.requiredSkipped,
    };
  }

  private mapSubmission(submission: {
    id: string;
    studentUserId: string;
    taskId: string;
    taskRevisionId: string;
    unitId: string;
    attemptId: string;
    status: PhotoTaskSubmissionStatus;
    assetKeysJson: Prisma.JsonValue;
    rejectedReason: string | null;
    submittedAt: Date;
    reviewedAt: Date | null;
    reviewedByTeacherUserId: string | null;
  }) {
    return {
      id: submission.id,
      studentUserId: submission.studentUserId,
      taskId: submission.taskId,
      taskRevisionId: submission.taskRevisionId,
      unitId: submission.unitId,
      attemptId: submission.attemptId,
      status: submission.status,
      assetKeys: this.parseAssetKeysJson(submission.assetKeysJson),
      rejectedReason: submission.rejectedReason,
      submittedAt: submission.submittedAt,
      reviewedAt: submission.reviewedAt,
      reviewedByTeacherUserId: submission.reviewedByTeacherUserId,
    };
  }

  private mapUnitSnapshot(snapshot: UnitProgressSnapshot) {
    return {
      unitId: snapshot.unitId,
      status: snapshot.status,
      totalTasks: snapshot.totalTasks,
      countedTasks: snapshot.countedTasks,
      solvedTasks: snapshot.solvedTasks,
      completionPercent: snapshot.completionPercent,
      solvedPercent: snapshot.solvedPercent,
    };
  }

  private parseQueueStatus(raw: unknown): PhotoTaskSubmissionStatus {
    const parsed = typeof raw === 'string' ? raw.trim() : '';
    if (!parsed) return PhotoTaskSubmissionStatus.submitted;
    if (PHOTO_SUBMISSION_STATUSES.has(parsed as PhotoTaskSubmissionStatus)) {
      return parsed as PhotoTaskSubmissionStatus;
    }
    throw new ConflictException({
      code: 'INVALID_QUEUE_STATUS',
      message: `status must be one of: ${Array.from(PHOTO_SUBMISSION_STATUSES).join(', ')}`,
    });
  }

  private parseLimit(raw: unknown): number {
    if (raw === undefined || raw === null || raw === '') return 20;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new ConflictException({
        code: 'INVALID_LIMIT',
        message: 'limit must be a positive integer',
      });
    }
    return Math.min(parsed, 100);
  }

  private parseOffset(raw: unknown): number {
    if (raw === undefined || raw === null || raw === '') return 0;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new ConflictException({
        code: 'INVALID_OFFSET',
        message: 'offset must be a non-negative integer',
      });
    }
    return parsed;
  }

  private parseAssetKeysJson(value: Prisma.JsonValue): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object') return {};
    return value as Record<string, unknown>;
  }
}
