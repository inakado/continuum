import { Injectable } from '@nestjs/common';
import { ContentStatus, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LearningAvailabilityService } from './learning-availability.service';

@Injectable()
export class LearningRecomputeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly learningAvailabilityService: LearningAvailabilityService,
  ) {}

  async recomputeForSection(sectionId: string) {
    const section = await this.prisma.section.findFirst({
      where: {
        id: sectionId,
        status: ContentStatus.published,
        course: { status: ContentStatus.published },
      },
      select: { id: true },
    });
    if (!section) {
      return {
        sectionId,
        studentsProcessed: 0,
        skipped: true as const,
      };
    }

    const studentIds = await this.loadRelevantStudentIds(sectionId);
    for (const studentId of studentIds) {
      await this.learningAvailabilityService.recomputeSectionAvailability(studentId, sectionId);
    }

    return {
      sectionId,
      studentsProcessed: studentIds.length,
      skipped: false as const,
    };
  }

  async recomputeForTask(taskId: string) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { unit: { select: { sectionId: true } } },
    });
    if (!task) {
      return {
        taskId,
        studentsProcessed: 0,
        skipped: true as const,
      };
    }

    const result = await this.recomputeForSection(task.unit.sectionId);
    return {
      taskId,
      ...result,
    };
  }

  async recomputeForUnit(unitId: string) {
    const unit = await this.prisma.unit.findUnique({
      where: { id: unitId },
      select: { sectionId: true },
    });
    if (!unit) {
      return {
        unitId,
        studentsProcessed: 0,
        skipped: true as const,
      };
    }

    const result = await this.recomputeForSection(unit.sectionId);
    return {
      unitId,
      ...result,
    };
  }

  private async loadRelevantStudentIds(sectionId: string): Promise<string[]> {
    const [fromUnitState, fromTaskState, fromAttempts, allActiveStudents] = await Promise.all([
      this.prisma.studentUnitState.findMany({
        where: { unit: { sectionId } },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
      this.prisma.studentTaskState.findMany({
        where: { task: { unit: { sectionId } } },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
      this.prisma.attempt.findMany({
        where: { task: { unit: { sectionId } } },
        select: { studentId: true },
        distinct: ['studentId'],
      }),
      this.prisma.studentProfile.findMany({
        where: { user: { role: Role.student, isActive: true } },
        select: { userId: true },
      }),
    ]);

    const unique = new Set<string>();
    fromUnitState.forEach((row) => unique.add(row.studentId));
    fromTaskState.forEach((row) => unique.add(row.studentId));
    fromAttempts.forEach((row) => unique.add(row.studentId));
    // Safety-first strategy for VS-06: include all active students to avoid missing
    // students with zero/noisy historical activity in section-scoped recomputes.
    allActiveStudents.forEach((row) => unique.add(row.userId));
    return [...unique].sort((a, b) => a.localeCompare(b));
  }
}
