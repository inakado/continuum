import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AccessGrant,
  CreateLessonInput,
  CreateSectionInput,
  LessonSummary,
  LibrarySection,
  PublicationResult,
  SetAccessGrantInput,
  SetAccessGrantResult,
} from '@continuum/shared';
import { PublicationStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LibraryWriteService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createSection(teacherId: string, input: CreateSectionInput): Promise<LibrarySection> {
    const order = await this.prisma.section.aggregate({
      where: { createdById: teacherId, gradeBand: input.gradeBand },
      _max: { sortOrder: true },
    });
    const section = await this.prisma.section.create({
      data: {
        gradeBand: input.gradeBand,
        title: input.title,
        description: input.description ?? null,
        sortOrder: (order._max.sortOrder ?? -1) + 1,
        createdById: teacherId,
      },
    });

    return { ...section, lessons: [] };
  }

  async createLesson(teacherId: string, input: CreateLessonInput): Promise<LessonSummary> {
    const section = await this.prisma.section.findFirst({
      where: { id: input.sectionId, createdById: teacherId },
      select: { id: true },
    });
    if (!section) throw this.sectionNotFound();

    const order = await this.prisma.lesson.aggregate({
      where: { sectionId: section.id },
      _max: { sortOrder: true },
    });
    const lesson = await this.prisma.lesson.create({
      data: {
        sectionId: section.id,
        title: input.title,
        description: input.description ?? null,
        sortOrder: (order._max.sortOrder ?? -1) + 1,
        createdById: teacherId,
      },
    });

    return {
      ...lesson,
      formats: { pdf: false, interactive: false, tasks: false },
    };
  }

  async publishSection(teacherId: string, sectionId: string): Promise<PublicationResult> {
    const section = await this.prisma.section.findFirst({
      where: { id: sectionId, createdById: teacherId },
      select: { id: true },
    });
    if (!section) throw this.sectionNotFound();

    return this.prisma.section.update({
      where: { id: section.id },
      data: { status: PublicationStatus.published },
      select: { id: true, status: true },
    });
  }

  async publishLesson(teacherId: string, lessonId: string): Promise<PublicationResult> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: lessonId, createdById: teacherId },
      select: { id: true, section: { select: { status: true } } },
    });
    if (!lesson) throw this.lessonNotFound();
    if (lesson.section.status !== PublicationStatus.published) {
      throw new ForbiddenException({
        code: 'SECTION_NOT_PUBLISHED',
        message: 'Сначала опубликуйте раздел.',
      });
    }

    return this.prisma.lesson.update({
      where: { id: lesson.id },
      data: { status: PublicationStatus.published, publishedAt: new Date() },
      select: { id: true, status: true },
    });
  }

  async setAccessGrant(
    teacherId: string,
    input: SetAccessGrantInput,
  ): Promise<SetAccessGrantResult> {
    const student = await this.prisma.user.findFirst({
      where: {
        id: input.studentId,
        role: Role.student,
        studentProfile: { is: { leadTeacherId: teacherId } },
      },
      select: { id: true },
    });
    if (!student) {
      throw new ForbiddenException({
        code: 'STUDENT_NOT_MANAGED',
        message: 'Ученик не привязан к этому преподавателю.',
      });
    }

    if (!input.enabled) {
      await this.prisma.accessGrant.deleteMany({
        where: { studentId: student.id, gradeBand: input.gradeBand, grantedById: teacherId },
      });
      return { grant: null };
    }

    const grant = await this.prisma.accessGrant.upsert({
      where: {
        studentId_gradeBand: { studentId: student.id, gradeBand: input.gradeBand },
      },
      create: {
        studentId: student.id,
        gradeBand: input.gradeBand,
        grantedById: teacherId,
      },
      update: { grantedById: teacherId },
    });

    return { grant: this.mapGrant(grant) };
  }

  private mapGrant(grant: {
    studentId: string;
    gradeBand: AccessGrant['gradeBand'];
    grantedAt: Date;
  }): AccessGrant {
    return {
      studentId: grant.studentId,
      gradeBand: grant.gradeBand,
      grantedAt: grant.grantedAt.toISOString(),
    };
  }

  private sectionNotFound() {
    return new NotFoundException({
      code: 'SECTION_NOT_FOUND',
      message: 'Раздел не найден.',
    });
  }

  private lessonNotFound() {
    return new NotFoundException({
      code: 'LESSON_NOT_FOUND',
      message: 'Занятие не найдено.',
    });
  }
}
