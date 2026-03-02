import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  ContentStatus,
  type Prisma,
  StudentUnitStatus,
  TaskAnswerType,
} from '@prisma/client';
import type { PhotoTaskSubmissionStatus } from '@prisma/client';
import type { LearningAvailabilityService } from './learning-availability.service';
import type { PrismaService } from '../prisma/prisma.service';

export type DbClient = PrismaService | Prisma.TransactionClient;
export type InboxSort = 'oldest' | 'newest';
export type InboxStatus = 'pending_review' | 'accepted' | 'rejected';
export type InboxFilters = {
  status?: InboxStatus;
  studentId?: string;
  courseId?: string;
  sectionId?: string;
  unitId?: string;
  taskId?: string;
};

export type PublishedPhotoTask = {
  id: string;
  unitId: string;
  activeRevisionId: string;
  unit: {
    id: string;
    sectionId: string;
  };
};

export const requirePublishedPhotoTask = async (
  db: DbClient,
  taskId: string,
): Promise<PublishedPhotoTask> => {
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
};

export const assertUnitAvailableForStudent = async ({
  learningAvailabilityService,
  sectionId,
  studentId,
  tx,
  unitId,
}: {
  learningAvailabilityService: LearningAvailabilityService;
  sectionId: string;
  studentId: string;
  tx?: Prisma.TransactionClient;
  unitId: string;
}) => {
  const snapshots = await learningAvailabilityService.recomputeSectionAvailability(studentId, sectionId, tx);
  const snapshot = snapshots.get(unitId);
  if (!snapshot || snapshot.status === StudentUnitStatus.locked) {
    throw new ConflictException({
      code: 'UNIT_LOCKED',
      message: 'Unit is locked',
    });
  }
};

export const parseAssetKeysJson = (value: Prisma.JsonValue): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
};

export const mapSubmission = (submission: {
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
}) => ({
  id: submission.id,
  studentUserId: submission.studentUserId,
  taskId: submission.taskId,
  taskRevisionId: submission.taskRevisionId,
  unitId: submission.unitId,
  attemptId: submission.attemptId,
  status: submission.status,
  assetKeys: parseAssetKeysJson(submission.assetKeysJson),
  rejectedReason: submission.rejectedReason,
  submittedAt: submission.submittedAt,
  reviewedAt: submission.reviewedAt,
  reviewedByTeacherUserId: submission.reviewedByTeacherUserId,
});
