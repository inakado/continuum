import { ConflictException, NotFoundException } from '@nestjs/common';
import { PhotoTaskSubmissionStatus, Role, type Prisma } from '@prisma/client';
import type {
  TeacherPhotoInboxQuery,
  TeacherPhotoPresignViewQuery,
  TeacherPhotoQueueQuery,
  TeacherPhotoSubmissionDetailQuery,
} from '@continuum/shared';
import type { ObjectStorageService } from '../infra/storage/object-storage.service';
import type { PrismaService } from '../prisma/prisma.service';
import type { StudentsService } from '../students/students.service';
import type { PhotoTaskPolicyService } from './photo-task-policy.service';
import {
  type InboxFilters,
  type InboxSort,
  type InboxStatus,
  mapSubmission,
  parseAssetKeysJson,
  requirePublishedPhotoTask,
} from './photo-task-read.shared';

const mapInboxStatusToDb = (status?: InboxStatus): PhotoTaskSubmissionStatus | undefined => {
  if (!status) return undefined;
  if (status === 'pending_review') return PhotoTaskSubmissionStatus.submitted;
  if (status === 'accepted') return PhotoTaskSubmissionStatus.accepted;
  return PhotoTaskSubmissionStatus.rejected;
};

const mapSubmissionStatusForInbox = (status: PhotoTaskSubmissionStatus): InboxStatus => {
  if (status === PhotoTaskSubmissionStatus.submitted) return 'pending_review';
  if (status === PhotoTaskSubmissionStatus.accepted) return 'accepted';
  return 'rejected';
};

const buildInboxWhere = (
  teacherId: string,
  filters: InboxFilters,
): Prisma.PhotoTaskSubmissionWhereInput => ({
  student: {
    studentProfile: {
      is: {
        leadTeacherId: teacherId,
      },
    },
  },
  ...(filters.status ? { status: mapInboxStatusToDb(filters.status) } : null),
  ...(filters.studentId ? { studentUserId: filters.studentId } : null),
  ...(filters.unitId ? { unitId: filters.unitId } : null),
  ...(filters.taskId ? { taskId: filters.taskId } : null),
  ...(filters.sectionId || filters.courseId
    ? {
        unit: {
          ...(filters.sectionId ? { sectionId: filters.sectionId } : null),
          ...(filters.courseId ? { section: { courseId: filters.courseId } } : null),
        },
      }
    : null),
});

const buildInboxOrderBy = (sort: InboxSort): Prisma.PhotoTaskSubmissionOrderByWithRelationInput[] => {
  if (sort === 'oldest') {
    return [{ submittedAt: 'asc' }, { id: 'asc' }];
  }
  return [{ submittedAt: 'desc' }, { id: 'desc' }];
};

const findAdjacentInboxSubmissionId = async ({
  current,
  direction,
  prisma,
  sort,
  where,
}: {
  current: { id: string; submittedAt: Date };
  direction: 'prev' | 'next';
  prisma: PrismaService;
  sort: InboxSort;
  where: Prisma.PhotoTaskSubmissionWhereInput;
}): Promise<string | null> => {
  const newerThanCurrent: Prisma.PhotoTaskSubmissionWhereInput = {
    OR: [{ submittedAt: { gt: current.submittedAt } }, { submittedAt: current.submittedAt, id: { gt: current.id } }],
  };
  const olderThanCurrent: Prisma.PhotoTaskSubmissionWhereInput = {
    OR: [{ submittedAt: { lt: current.submittedAt } }, { submittedAt: current.submittedAt, id: { lt: current.id } }],
  };

  const comparator =
    sort === 'oldest'
      ? direction === 'prev'
        ? olderThanCurrent
        : newerThanCurrent
      : direction === 'prev'
        ? newerThanCurrent
        : olderThanCurrent;

  const orderBy =
    sort === 'oldest'
      ? direction === 'prev'
        ? ([{ submittedAt: 'desc' }, { id: 'desc' }] as Prisma.PhotoTaskSubmissionOrderByWithRelationInput[])
        : ([{ submittedAt: 'asc' }, { id: 'asc' }] as Prisma.PhotoTaskSubmissionOrderByWithRelationInput[])
      : direction === 'prev'
        ? ([{ submittedAt: 'asc' }, { id: 'asc' }] as Prisma.PhotoTaskSubmissionOrderByWithRelationInput[])
        : ([{ submittedAt: 'desc' }, { id: 'desc' }] as Prisma.PhotoTaskSubmissionOrderByWithRelationInput[]);

  const adjacent = await prisma.photoTaskSubmission.findFirst({
    where: {
      AND: [where, comparator],
    },
    orderBy,
    select: { id: true },
  });

  return adjacent?.id ?? null;
};

export const listTeacherPhotoSubmissionsForTask = async ({
  prisma,
  studentsService,
  studentId,
  taskId,
  teacherId,
}: {
  prisma: PrismaService;
  studentsService: StudentsService;
  studentId: string;
  taskId: string;
  teacherId: string;
}) => {
  await studentsService.assertTeacherOwnsStudent(teacherId, studentId);
  await requirePublishedPhotoTask(prisma, taskId);

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

export const listTeacherPhotoQueue = async ({
  prisma,
  query,
  studentId,
  studentsService,
  teacherId,
}: {
  prisma: PrismaService;
  query: TeacherPhotoQueueQuery;
  studentId: string;
  studentsService: StudentsService;
  teacherId: string;
}) => {
  await studentsService.assertTeacherOwnsStudent(teacherId, studentId);
  const where: Prisma.PhotoTaskSubmissionWhereInput = {
    studentUserId: studentId,
    ...(query.status ? { status: query.status } : null),
  };

  const [items, total] = await prisma.$transaction([
    prisma.photoTaskSubmission.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      take: query.limit,
      skip: query.offset,
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
    prisma.photoTaskSubmission.count({ where }),
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
      assetKeysCount: parseAssetKeysJson(item.assetKeysJson).length,
    })),
    total,
    limit: query.limit,
    offset: query.offset,
  };
};

export const listTeacherPhotoInbox = async ({
  prisma,
  query,
  teacherId,
}: {
  prisma: PrismaService;
  query: TeacherPhotoInboxQuery;
  teacherId: string;
}) => {
  const filters: InboxFilters = {
    status: query.status,
    studentId: query.studentId,
    courseId: query.courseId,
    sectionId: query.sectionId,
    unitId: query.unitId,
    taskId: query.taskId,
  };
  const where = buildInboxWhere(teacherId, filters);

  const [items, total] = await prisma.$transaction([
    prisma.photoTaskSubmission.findMany({
      where,
      orderBy: buildInboxOrderBy(query.sort),
      take: query.limit,
      skip: query.offset,
      select: {
        id: true,
        status: true,
        submittedAt: true,
        assetKeysJson: true,
        studentUserId: true,
        taskId: true,
        unitId: true,
        student: {
          select: {
            id: true,
            login: true,
            studentProfile: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        task: {
          select: {
            id: true,
            title: true,
            sortOrder: true,
            unit: {
              select: {
                id: true,
                title: true,
                section: {
                  select: {
                    id: true,
                    title: true,
                    course: {
                      select: {
                        id: true,
                        title: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.photoTaskSubmission.count({ where }),
  ]);

  return {
    items: items.map((item) => ({
      submissionId: item.id,
      status: mapSubmissionStatusForInbox(item.status),
      submittedAt: item.submittedAt,
      assetKeysCount: parseAssetKeysJson(item.assetKeysJson).length,
      student: {
        id: item.student.id,
        login: item.student.login,
        firstName: item.student.studentProfile?.firstName ?? null,
        lastName: item.student.studentProfile?.lastName ?? null,
      },
      course: {
        id: item.task.unit.section.course.id,
        title: item.task.unit.section.course.title,
      },
      section: {
        id: item.task.unit.section.id,
        title: item.task.unit.section.title,
      },
      unit: {
        id: item.task.unit.id,
        title: item.task.unit.title,
      },
      task: {
        id: item.task.id,
        title: item.task.title,
        sortOrder: item.task.sortOrder,
      },
    })),
    total,
    limit: query.limit,
    offset: query.offset,
    sort: query.sort,
  };
};

export const getTeacherInboxSubmission = async ({
  prisma,
  query,
  submissionId,
  teacherId,
}: {
  prisma: PrismaService;
  query: TeacherPhotoSubmissionDetailQuery;
  submissionId: string;
  teacherId: string;
}) => {
  const filters: InboxFilters = {
    status: query.status,
    studentId: query.studentId,
    courseId: query.courseId,
    sectionId: query.sectionId,
    unitId: query.unitId,
    taskId: query.taskId,
  };
  const aclWhere = buildInboxWhere(teacherId, {});

  const submission = await prisma.photoTaskSubmission.findFirst({
    where: {
      ...aclWhere,
      id: submissionId,
    },
    select: {
      id: true,
      status: true,
      submittedAt: true,
      reviewedAt: true,
      rejectedReason: true,
      assetKeysJson: true,
      studentUserId: true,
      taskId: true,
      unitId: true,
      student: {
        select: {
          id: true,
          login: true,
          studentProfile: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      task: {
        select: {
          id: true,
          title: true,
          sortOrder: true,
          unit: {
            select: {
              id: true,
              title: true,
              section: {
                select: {
                  id: true,
                  title: true,
                  course: {
                    select: {
                      id: true,
                      title: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      taskRevision: {
        select: {
          statementLite: true,
        },
      },
    },
  });

  if (!submission) {
    throw new NotFoundException({
      code: 'PHOTO_SUBMISSION_NOT_FOUND',
      message: 'Photo submission not found',
    });
  }

  const filteredWhere = buildInboxWhere(teacherId, filters);
  const prevSubmissionId = await findAdjacentInboxSubmissionId({
    current: submission,
    direction: 'prev',
    prisma,
    sort: query.sort,
    where: filteredWhere,
  });
  const nextSubmissionId = await findAdjacentInboxSubmissionId({
    current: submission,
    direction: 'next',
    prisma,
    sort: query.sort,
    where: filteredWhere,
  });

  return {
    submission: {
      submissionId: submission.id,
      status: mapSubmissionStatusForInbox(submission.status),
      submittedAt: submission.submittedAt,
      reviewedAt: submission.reviewedAt,
      rejectedReason: submission.rejectedReason,
      assetKeys: parseAssetKeysJson(submission.assetKeysJson),
      student: {
        id: submission.student.id,
        login: submission.student.login,
        firstName: submission.student.studentProfile?.firstName ?? null,
        lastName: submission.student.studentProfile?.lastName ?? null,
      },
      course: {
        id: submission.task.unit.section.course.id,
        title: submission.task.unit.section.course.title,
      },
      section: {
        id: submission.task.unit.section.id,
        title: submission.task.unit.section.title,
      },
      unit: {
        id: submission.task.unit.id,
        title: submission.task.unit.title,
      },
      task: {
        id: submission.task.id,
        title: submission.task.title,
        sortOrder: submission.task.sortOrder,
        statementLite: submission.taskRevision.statementLite,
      },
    },
    navigation: {
      prevSubmissionId,
      nextSubmissionId,
    },
    appliedFilters: {
      ...filters,
      sort: query.sort,
    },
  };
};

export const presignTeacherPhotoView = async ({
  objectStorageService,
  photoTaskPolicyService,
  prisma,
  query,
  studentId,
  studentsService,
  taskId,
  teacherId,
}: {
  objectStorageService: ObjectStorageService;
  photoTaskPolicyService: PhotoTaskPolicyService;
  prisma: PrismaService;
  query: TeacherPhotoPresignViewQuery;
  studentId: string;
  studentsService: StudentsService;
  taskId: string;
  teacherId: string;
}) => {
  await studentsService.assertTeacherOwnsStudent(teacherId, studentId);
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

  const ttlSec = photoTaskPolicyService.resolveViewTtl(Role.teacher, query.ttlSec);
  const responseContentType = photoTaskPolicyService.inferResponseContentType(assetKey);
  const url = await objectStorageService.presignGetObject(assetKey, ttlSec, responseContentType);

  return {
    ok: true,
    assetKey,
    expiresInSec: ttlSec,
    url,
  };
};
