import { ConflictException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { StudentPhotoPresignViewQuery } from '@continuum/shared';
import type { LearningAvailabilityService } from './learning-availability.service';
import type { PhotoTaskPolicyService } from './photo-task-policy.service';
import type { ObjectStorageService } from '../infra/storage/object-storage.service';
import type { PrismaService } from '../prisma/prisma.service';
import {
  assertUnitAvailableForStudent,
  mapSubmission,
  requirePublishedPhotoTask,
} from './photo-task-read.shared';

export const listStudentPhotoSubmissions = async ({
  learningAvailabilityService,
  prisma,
  studentId,
  taskId,
}: {
  learningAvailabilityService: LearningAvailabilityService;
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

  const submissions = await prisma.photoTaskSubmission.findMany({
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
    items: submissions.map((item) => mapSubmission(item)),
  };
};

export const presignStudentPhotoView = async ({
  learningAvailabilityService,
  objectStorageService,
  photoTaskPolicyService,
  prisma,
  query,
  studentId,
  taskId,
}: {
  learningAvailabilityService: LearningAvailabilityService;
  objectStorageService: ObjectStorageService;
  photoTaskPolicyService: PhotoTaskPolicyService;
  prisma: PrismaService;
  query: StudentPhotoPresignViewQuery;
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
  const assetKey = query.assetKey;

  const owned = await prisma.photoTaskSubmission.findFirst({
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

  const ttlSec = photoTaskPolicyService.resolveViewTtl(Role.student, query.ttlSec);
  const responseContentType = photoTaskPolicyService.inferResponseContentType(assetKey);
  const url = await objectStorageService.presignGetObject(assetKey, ttlSec, responseContentType);

  return {
    ok: true,
    assetKey,
    expiresInSec: ttlSec,
    url,
  };
};
