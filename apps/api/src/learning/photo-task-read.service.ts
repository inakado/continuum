import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  StudentPhotoPresignViewQuery,
  TeacherPhotoInboxQuery,
  TeacherPhotoPresignViewQuery,
  TeacherPhotoQueueQuery,
  TeacherPhotoSubmissionDetailQuery,
} from '@continuum/shared';
import {
  ContentStatus,
  PhotoTaskSubmissionStatus,
  type Prisma,
  Role,
  StudentUnitStatus,
  TaskAnswerType,
} from '@prisma/client';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudentsService } from '../students/students.service';
import { LearningAvailabilityService } from './learning-availability.service';
import { PhotoTaskPolicyService } from './photo-task-policy.service';

type DbClient = PrismaService | Prisma.TransactionClient;
type InboxSort = 'oldest' | 'newest';
type InboxStatus = 'pending_review' | 'accepted' | 'rejected';
type InboxFilters = {
  status?: InboxStatus;
  studentId?: string;
  courseId?: string;
  sectionId?: string;
  unitId?: string;
  taskId?: string;
};

type PublishedPhotoTask = {
  id: string;
  unitId: string;
  activeRevisionId: string;
  unit: {
    id: string;
    sectionId: string;
  };
};

@Injectable()
export class PhotoTaskReadService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(StudentsService)
    private readonly studentsService: StudentsService,
    @Inject(LearningAvailabilityService)
    private readonly learningAvailabilityService: LearningAvailabilityService,
    @Inject(ObjectStorageService)
    private readonly objectStorageService: ObjectStorageService,
    @Inject(PhotoTaskPolicyService)
    private readonly photoTaskPolicyService: PhotoTaskPolicyService,
  ) {}

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
    query: TeacherPhotoQueueQuery,
  ) {
    await this.studentsService.assertTeacherOwnsStudent(teacherId, studentId);
    const status = query.status;
    const limit = query.limit;
    const offset = query.offset;

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

  async listInboxForTeacher(teacherId: string, query: TeacherPhotoInboxQuery) {
    const filters: InboxFilters = {
      status: query.status,
      studentId: query.studentId,
      courseId: query.courseId,
      sectionId: query.sectionId,
      unitId: query.unitId,
      taskId: query.taskId,
    };
    const sort = query.sort;
    const limit = query.limit;
    const offset = query.offset;
    const where = this.buildInboxWhere(teacherId, filters);

    const [items, total] = await this.prisma.$transaction([
      this.prisma.photoTaskSubmission.findMany({
        where,
        orderBy: this.buildInboxOrderBy(sort),
        take: limit,
        skip: offset,
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
      this.prisma.photoTaskSubmission.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        submissionId: item.id,
        status: this.mapSubmissionStatusForInbox(item.status),
        submittedAt: item.submittedAt,
        assetKeysCount: this.parseAssetKeysJson(item.assetKeysJson).length,
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
      limit,
      offset,
      sort,
    };
  }

  async getInboxSubmissionForTeacher(
    teacherId: string,
    submissionId: string,
    query: TeacherPhotoSubmissionDetailQuery,
  ) {
    const filters: InboxFilters = {
      status: query.status,
      studentId: query.studentId,
      courseId: query.courseId,
      sectionId: query.sectionId,
      unitId: query.unitId,
      taskId: query.taskId,
    };
    const sort = query.sort;
    const aclWhere = this.buildInboxWhere(teacherId, {});

    const submission = await this.prisma.photoTaskSubmission.findFirst({
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

    const filteredWhere = this.buildInboxWhere(teacherId, filters);
    const prevSubmissionId = await this.findAdjacentInboxSubmissionId(
      filteredWhere,
      submission,
      sort,
      'prev',
    );
    const nextSubmissionId = await this.findAdjacentInboxSubmissionId(
      filteredWhere,
      submission,
      sort,
      'next',
    );

    return {
      submission: {
        submissionId: submission.id,
        status: this.mapSubmissionStatusForInbox(submission.status),
        submittedAt: submission.submittedAt,
        reviewedAt: submission.reviewedAt,
        rejectedReason: submission.rejectedReason,
        assetKeys: this.parseAssetKeysJson(submission.assetKeysJson),
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
        sort,
      },
    };
  }

  async presignViewForStudent(
    studentId: string,
    taskId: string,
    query: StudentPhotoPresignViewQuery,
  ) {
    const task = await this.requirePublishedPhotoTask(this.prisma, taskId);
    await this.assertUnitAvailableForStudent(studentId, task.unit.sectionId, task.unit.id);
    const assetKey = query.assetKey;

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

    const ttlSec = this.photoTaskPolicyService.resolveViewTtl(Role.student, query.ttlSec);
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
    query: TeacherPhotoPresignViewQuery,
  ) {
    await this.studentsService.assertTeacherOwnsStudent(teacherId, studentId);
    const assetKey = query.assetKey;

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

    const ttlSec = this.photoTaskPolicyService.resolveViewTtl(Role.teacher, query.ttlSec);
    const responseContentType = this.photoTaskPolicyService.inferResponseContentType(assetKey);
    const url = await this.objectStorageService.presignGetObject(assetKey, ttlSec, responseContentType);

    return {
      ok: true,
      assetKey,
      expiresInSec: ttlSec,
      url,
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

  private mapInboxStatusToDb(status?: InboxStatus): PhotoTaskSubmissionStatus | undefined {
    if (!status) return undefined;
    if (status === 'pending_review') return PhotoTaskSubmissionStatus.submitted;
    if (status === 'accepted') return PhotoTaskSubmissionStatus.accepted;
    return PhotoTaskSubmissionStatus.rejected;
  }

  private mapSubmissionStatusForInbox(status: PhotoTaskSubmissionStatus): InboxStatus {
    if (status === PhotoTaskSubmissionStatus.submitted) return 'pending_review';
    if (status === PhotoTaskSubmissionStatus.accepted) return 'accepted';
    return 'rejected';
  }

  private buildInboxWhere(
    teacherId: string,
    filters: InboxFilters,
  ): Prisma.PhotoTaskSubmissionWhereInput {
    return {
      student: {
        studentProfile: {
          is: {
            leadTeacherId: teacherId,
          },
        },
      },
      ...(filters.status ? { status: this.mapInboxStatusToDb(filters.status) } : null),
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
    };
  }

  private buildInboxOrderBy(sort: InboxSort): Prisma.PhotoTaskSubmissionOrderByWithRelationInput[] {
    if (sort === 'oldest') {
      return [{ submittedAt: 'asc' }, { id: 'asc' }];
    }
    return [{ submittedAt: 'desc' }, { id: 'desc' }];
  }

  private async findAdjacentInboxSubmissionId(
    where: Prisma.PhotoTaskSubmissionWhereInput,
    current: { id: string; submittedAt: Date },
    sort: InboxSort,
    direction: 'prev' | 'next',
  ): Promise<string | null> {
    const newerThanCurrent: Prisma.PhotoTaskSubmissionWhereInput = {
      OR: [
        { submittedAt: { gt: current.submittedAt } },
        { submittedAt: current.submittedAt, id: { gt: current.id } },
      ],
    };
    const olderThanCurrent: Prisma.PhotoTaskSubmissionWhereInput = {
      OR: [
        { submittedAt: { lt: current.submittedAt } },
        { submittedAt: current.submittedAt, id: { lt: current.id } },
      ],
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

    const adjacent = await this.prisma.photoTaskSubmission.findFirst({
      where: {
        AND: [where, comparator],
      },
      orderBy,
      select: { id: true },
    });

    return adjacent?.id ?? null;
  }

  private parseAssetKeysJson(value: Prisma.JsonValue): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
  }
}
