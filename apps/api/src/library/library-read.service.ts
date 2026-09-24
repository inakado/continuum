import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  GradeBand,
  LessonArtifactViewResult,
  LessonDetail,
  StudentLibrary,
  TeacherLessonDetail,
  TeacherLibrary,
} from '@continuum/shared';
import { LessonArtifactType as DbLessonArtifactType, PublicationStatus } from '@prisma/client';
import { ObjectStorageService } from '../infra/storage/object-storage.service';
import { PrismaService } from '../prisma/prisma.service';
import { mapLessonDetail, mapLibrarySection } from './library.mapper';

const gradeBandOrder: GradeBand[] = ['grade_7', 'grade_8', 'grade_9', 'grade_10_11'];
const studentPdfTypes = [DbLessonArtifactType.pdf, DbLessonArtifactType.tasks_pdf];

const lessonSummaryInclude = {
  artifacts: {
    where: { status: PublicationStatus.published, isActive: true },
    select: { type: true },
  },
} as const;

const studentLessonSummaryInclude = {
  artifacts: {
    where: { status: PublicationStatus.published, isActive: true, type: { in: studentPdfTypes } },
    select: { type: true },
  },
} as const;

@Injectable()
export class LibraryReadService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ObjectStorageService) private readonly storage: ObjectStorageService,
  ) {}

  async getTeacherLibrary(teacherId: string): Promise<TeacherLibrary> {
    const sections = await this.prisma.section.findMany({
      where: { createdById: teacherId },
      orderBy: [{ gradeBand: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        lessons: {
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: lessonSummaryInclude,
        },
      },
    });

    return {
      gradeBands: gradeBandOrder.map((code) => ({
        code,
        sections: sections.filter((section) => section.gradeBand === code).map(mapLibrarySection),
      })),
    };
  }

  async getStudentLibrary(studentId: string): Promise<StudentLibrary> {
    const grants = await this.prisma.accessGrant.findMany({
      where: { studentId },
      select: { gradeBand: true, grantedById: true },
      orderBy: { gradeBand: 'asc' },
    });

    if (grants.length === 0) return { gradeBands: [] };

    const sections = await this.prisma.section.findMany({
      where: {
        status: PublicationStatus.published,
        OR: grants.map((grant) => ({
          gradeBand: grant.gradeBand,
          createdById: grant.grantedById,
        })),
      },
      orderBy: [{ gradeBand: 'asc' }, { sortOrder: 'asc' }, { id: 'asc' }],
      include: {
        lessons: {
          where: { status: PublicationStatus.published },
          orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
          include: studentLessonSummaryInclude,
        },
      },
    });

    return {
      gradeBands: gradeBandOrder
        .filter((code) => grants.some((grant) => grant.gradeBand === code))
        .map((code) => ({
          code,
          sections: sections.filter((section) => section.gradeBand === code).map(mapLibrarySection),
        })),
    };
  }

  async getStudentLesson(studentId: string, lessonId: string): Promise<LessonDetail> {
    const grants = await this.prisma.accessGrant.findMany({
      where: { studentId },
      select: { gradeBand: true, grantedById: true },
    });

    if (grants.length === 0) throw this.lessonNotFound();

    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        status: PublicationStatus.published,
        section: {
          is: {
            status: PublicationStatus.published,
            OR: grants.map((grant) => ({
              gradeBand: grant.gradeBand,
              createdById: grant.grantedById,
            })),
          },
        },
      },
      include: {
        section: { select: { id: true, gradeBand: true, title: true } },
        artifacts: {
          where: { status: PublicationStatus.published, isActive: true, type: { in: studentPdfTypes } },
          orderBy: [{ type: 'asc' }, { version: 'desc' }],
          include: {
            asset: { select: { filename: true, contentType: true, sizeBytes: true } },
          },
        },
      },
    });

    if (!lesson) throw this.lessonNotFound();
    return mapLessonDetail(lesson);
  }

  async getTeacherLesson(teacherId: string, lessonId: string): Promise<TeacherLessonDetail> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, createdById: teacherId },
      include: {
        section: { select: { id: true, gradeBand: true, title: true } },
        artifacts: {
          orderBy: [{ type: 'asc' }, { version: 'desc' }],
          include: {
            asset: { select: { filename: true, contentType: true, sizeBytes: true } },
          },
        },
      },
    });

    if (!lesson) throw this.lessonNotFound();
    return mapLessonDetail(lesson);
  }

  async getTeacherArtifactView(
    teacherId: string,
    artifactId: string,
  ): Promise<LessonArtifactViewResult> {
    const artifact = await this.prisma.lessonArtifact.findFirst({
      where: { id: artifactId, lesson: { is: { createdById: teacherId } } },
      select: { asset: { select: { objectKey: true, contentType: true } } },
    });
    if (!artifact) throw this.lessonNotFound();

    return {
      url: await this.storage.getPresignedGetUrl(
        artifact.asset.objectKey,
        300,
        artifact.asset.contentType,
      ),
    };
  }

  async getStudentArtifactView(
    studentId: string,
    artifactId: string,
  ): Promise<LessonArtifactViewResult> {
    const grants = await this.prisma.accessGrant.findMany({
      where: { studentId },
      select: { gradeBand: true, grantedById: true },
    });
    if (grants.length === 0) throw this.lessonNotFound();

    const artifact = await this.prisma.lessonArtifact.findFirst({
      where: {
        id: artifactId,
        type: { in: studentPdfTypes },
        status: PublicationStatus.published,
        isActive: true,
        lesson: {
          is: {
            status: PublicationStatus.published,
            section: {
              is: {
                status: PublicationStatus.published,
                OR: grants.map((grant) => ({
                  gradeBand: grant.gradeBand,
                  createdById: grant.grantedById,
                })),
              },
            },
          },
        },
      },
      select: { asset: { select: { objectKey: true, contentType: true } } },
    });
    if (!artifact) throw this.lessonNotFound();

    return {
      url: await this.storage.getPresignedGetUrl(
        artifact.asset.objectKey,
        300,
        artifact.asset.contentType,
      ),
    };
  }

  private lessonNotFound() {
    return new NotFoundException({
      code: 'LESSON_NOT_FOUND',
      message: 'Занятие не найдено.',
    });
  }
}
