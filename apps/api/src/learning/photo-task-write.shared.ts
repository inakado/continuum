import { randomBytes } from 'node:crypto';
import { type StudentTaskStatus } from '@prisma/client';
import type { UnitProgressSnapshot } from './learning-availability.service';

export const buildPhotoTaskAssetPrefix = (taskId: string, studentId: string, taskRevisionId: string) =>
  `tasks/${taskId}/photo/${studentId}/${taskRevisionId}/`;

export const buildGeneratedAssetKey = ({
  contentTypeExtension,
  index,
  prefix,
}: {
  contentTypeExtension: string;
  index: number;
  prefix: string;
}) => `${prefix}${Date.now()}-${randomBytes(4).toString('hex')}-${index + 1}.${contentTypeExtension}`;

export const mapPhotoTaskState = (taskState: {
  status: StudentTaskStatus;
  wrongAttempts: number;
  lockedUntil: Date | null;
  requiredSkipped: boolean;
}) => ({
  status: taskState.status,
  wrongAttempts: taskState.wrongAttempts,
  blockedUntil: taskState.lockedUntil,
  requiredSkipped: taskState.requiredSkipped,
});

export const mapPhotoUnitSnapshot = (snapshot: UnitProgressSnapshot) => ({
  unitId: snapshot.unitId,
  status: snapshot.status,
  totalTasks: snapshot.totalTasks,
  countedTasks: snapshot.countedTasks,
  solvedTasks: snapshot.solvedTasks,
  completionPercent: snapshot.completionPercent,
  solvedPercent: snapshot.solvedPercent,
});
