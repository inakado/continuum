import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ContentStatus,
  StudentTaskStatus,
  StudentUnitStatus,
} from '@prisma/client';
import type { StudentAttemptRequest } from '@continuum/shared';
import { ContentService } from '../content/content.service';
import { type TaskWithActiveRevision } from '../content/task-revision-payload.service';
import { PrismaService } from '../prisma/prisma.service';
import { StudentsService } from '../students/students.service';
import { LearningAvailabilityService } from './learning-availability.service';
import { LearningAttemptsWriteService } from './learning-attempts-write.service';
import { LearningTeacherActionsService } from './learning-teacher-actions.service';

const TASK_SOLUTION_ALLOWED_STATUSES = new Set<StudentTaskStatus>([
  StudentTaskStatus.correct,
  StudentTaskStatus.accepted,
  StudentTaskStatus.credited_without_progress,
  StudentTaskStatus.teacher_credited,
]);

@Injectable()
export class LearningService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(ContentService)
    private readonly contentService: ContentService,
    @Inject(LearningAvailabilityService)
    private readonly learningAvailabilityService: LearningAvailabilityService,
    @Inject(StudentsService)
    private readonly studentsService: StudentsService,
    @Inject(LearningAttemptsWriteService)
    private readonly learningAttemptsWriteService: LearningAttemptsWriteService,
    @Inject(LearningTeacherActionsService)
    private readonly learningTeacherActionsService: LearningTeacherActionsService,
  ) {}

  async getPublishedSectionGraphForStudent(studentId: string, sectionId: string) {
    const graph = await this.contentService.getPublishedSectionGraph(sectionId);
    const snapshots = await this.learningAvailabilityService.recomputeSectionAvailability(
      studentId,
      sectionId,
    );

    return {
      sectionId: graph.sectionId,
      nodes: graph.nodes.map((node) => {
        const snapshot = snapshots.get(node.unitId);
        return {
          ...node,
          status: snapshot?.status ?? StudentUnitStatus.locked,
          completionPercent: snapshot?.completionPercent ?? 0,
          solvedPercent: snapshot?.solvedPercent ?? 0,
        };
      }),
      edges: graph.edges,
    };
  }

  async getPublishedUnitForStudent(
    studentId: string,
    unitId: string,
    options?: { enforceLockedAccess?: boolean },
  ) {
    const enforceLockedAccess = options?.enforceLockedAccess ?? true;
    const unitMeta = await this.prisma.unit.findFirst({
      where: {
        id: unitId,
        status: ContentStatus.published,
        section: {
          status: ContentStatus.published,
          course: { status: ContentStatus.published },
        },
      },
      select: { id: true, sectionId: true },
    });

    if (!unitMeta) {
      throw new NotFoundException({
        code: 'UNIT_NOT_FOUND',
        message: 'Unit not found',
      });
    }

    const sectionSnapshots = await this.learningAvailabilityService.recomputeSectionAvailability(
      studentId,
      unitMeta.sectionId,
    );
    const unitSnapshot = sectionSnapshots.get(unitId);
    if (!unitSnapshot) {
      throw new NotFoundException({
        code: 'UNIT_NOT_FOUND',
        message: 'Unit not found',
      });
    }

    if (enforceLockedAccess && unitSnapshot.status === StudentUnitStatus.locked) {
      throw new ConflictException({ code: 'UNIT_LOCKED', message: 'Unit is locked' });
    }

    const unit = await this.prisma.unit.findFirst({
      where: {
        id: unitId,
        status: ContentStatus.published,
        section: {
          status: ContentStatus.published,
          course: { status: ContentStatus.published },
        },
      },
      include: {
        tasks: {
          where: { status: ContentStatus.published },
          orderBy: { sortOrder: 'asc' },
          include: {
            activeRevision: {
              include: {
                numericParts: true,
                choices: true,
                correctChoices: true,
              },
            },
          },
        },
      },
    });

    if (!unit) {
      throw new NotFoundException({
        code: 'UNIT_NOT_FOUND',
        message: 'Unit not found',
      });
    }

    const missingRevision = unit.tasks.find(
      (task) => !task.activeRevisionId || !task.activeRevision,
    );
    if (missingRevision) {
      throw new ConflictException({
        code: 'TASK_ACTIVE_REVISION_MISSING',
        message: 'Task active revision is missing',
        taskId: missingRevision.id,
      });
    }

    const taskIds = unit.tasks.map((task) => task.id);
    const states = taskIds.length
      ? await this.prisma.studentTaskState.findMany({
          where: { studentId, taskId: { in: taskIds } },
        })
      : [];
    const statesMap = new Map(states.map((state) => [state.taskId, state]));
    const now = new Date();

    return {
      ...unit,
      minOptionalCountedTasksToComplete: unit.minOptionalCountedTasksToComplete,
      unitStatus: unitSnapshot.status,
      countedTasks: unitSnapshot.countedTasks,
      optionalCountedTasks: unitSnapshot.optionalCountedTasks,
      solvedTasks: unitSnapshot.solvedTasks,
      totalTasks: unitSnapshot.totalTasks,
      completionPercent: unitSnapshot.completionPercent,
      solvedPercent: unitSnapshot.solvedPercent,
      tasks: unit.tasks.map((task) => {
        const mapped = this.contentService.mapTaskWithRevision(task as TaskWithActiveRevision);
        const state = statesMap.get(task.id);
        const normalizedState = this.normalizeTaskState(state ?? null, task.activeRevisionId, now);
        const {
          correctAnswerJson,
          statementImageAssetKey,
          solutionLite,
          solutionPdfAssetKey,
          solutionRichLatex,
          numericPartsJson,
          ...rest
        } =
          mapped as Record<string, unknown>;
        const isCredited =
          normalizedState.status === StudentTaskStatus.correct ||
          normalizedState.status === StudentTaskStatus.accepted ||
          normalizedState.status === StudentTaskStatus.credited_without_progress ||
          normalizedState.status === StudentTaskStatus.teacher_credited;
        const safeNumericParts = Array.isArray(numericPartsJson)
          ? numericPartsJson.map((part) => {
              const safePart = part as {
                key: string;
                labelLite?: string | null;
                correctValue?: unknown;
              };

              return {
                key: safePart.key,
                labelLite: safePart.labelLite ?? null,
                ...(isCredited ? { correctValue: safePart.correctValue } : {}),
              };
            })
          : null;
        return {
          ...rest,
          hasStatementImage: Boolean(statementImageAssetKey),
          numericPartsJson: safeNumericParts,
          ...(isCredited
            ? { correctAnswerJson, solutionLite, solutionPdfAssetKey, solutionRichLatex }
            : {}),
          state: normalizedState,
        };
      }),
    };
  }

  async getPublishedUnitPdfAssetKeyForStudent(
    studentId: string,
    unitId: string,
    target: 'theory' | 'method',
  ) {
    const unit = await this.getPublishedUnitForStudent(studentId, unitId);
    return target === 'theory' ? unit.theoryPdfAssetKey : unit.methodPdfAssetKey;
  }

  async getTaskSolutionPdfAssetKeyForStudent(studentId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
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
        activeRevisionId: true,
        activeRevision: {
          select: {
            id: true,
            solutionPdfAssetKey: true,
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

    if (!task) {
      throw new NotFoundException({
        code: 'TASK_NOT_FOUND',
        message: 'Task not found',
      });
    }
    if (!task.activeRevisionId || !task.activeRevision) {
      throw new ConflictException({
        code: 'TASK_ACTIVE_REVISION_MISSING',
        message: 'Task active revision is missing',
      });
    }

    const sectionSnapshots = await this.learningAvailabilityService.recomputeSectionAvailability(
      studentId,
      task.unit.sectionId,
    );
    const unitSnapshot = sectionSnapshots.get(task.unit.id);
    if (!unitSnapshot || unitSnapshot.status === StudentUnitStatus.locked) {
      throw new ConflictException({ code: 'UNIT_LOCKED', message: 'Unit is locked' });
    }

    const state = await this.prisma.studentTaskState.findUnique({
      where: { studentId_taskId: { studentId, taskId: task.id } },
      select: {
        status: true,
        wrongAttempts: true,
        lockedUntil: true,
        requiredSkipped: true,
        activeRevisionId: true,
        creditedRevisionId: true,
      },
    });
    const normalizedState = this.normalizeTaskState(state ?? null, task.activeRevisionId, new Date());
    if (!TASK_SOLUTION_ALLOWED_STATUSES.has(normalizedState.status)) {
      throw new ConflictException({
        code: 'SOLUTION_NOT_AVAILABLE_YET',
        message: 'Task solution is not available yet',
      });
    }

    const key = task.activeRevision.solutionPdfAssetKey;
    if (!key) {
      throw new NotFoundException({
        code: 'SOLUTION_PDF_MISSING',
        message: 'Task solution PDF is not compiled yet',
      });
    }

    return {
      taskId: task.id,
      taskRevisionId: task.activeRevisionId,
      key,
    };
  }

  async getTaskStatementImageAssetKeyForStudent(studentId: string, taskId: string) {
    const task = await this.prisma.task.findFirst({
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
        activeRevisionId: true,
        activeRevision: {
          select: {
            id: true,
            statementImageAssetKey: true,
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

    if (!task) {
      throw new NotFoundException({
        code: 'TASK_NOT_FOUND',
        message: 'Task not found',
      });
    }
    if (!task.activeRevisionId || !task.activeRevision) {
      throw new ConflictException({
        code: 'TASK_ACTIVE_REVISION_MISSING',
        message: 'Task active revision is missing',
      });
    }

    const sectionSnapshots = await this.learningAvailabilityService.recomputeSectionAvailability(
      studentId,
      task.unit.sectionId,
    );
    const unitSnapshot = sectionSnapshots.get(task.unit.id);
    if (!unitSnapshot || unitSnapshot.status === StudentUnitStatus.locked) {
      throw new ConflictException({ code: 'UNIT_LOCKED', message: 'Unit is locked' });
    }

    const key = task.activeRevision.statementImageAssetKey;
    if (!key) {
      throw new NotFoundException({
        code: 'STATEMENT_IMAGE_MISSING',
        message: 'Task statement image is not uploaded yet',
      });
    }

    return {
      taskId: task.id,
      taskRevisionId: task.activeRevisionId,
      key,
    };
  }

  async submitAttempt(studentId: string, taskId: string, body: StudentAttemptRequest) {
    return this.learningAttemptsWriteService.submitAttempt(studentId, taskId, body);
  }

  async listNotifications(teacherId: string, studentId?: string) {
    return this.learningTeacherActionsService.listNotifications(teacherId, studentId);
  }

  async getTeacherUnitPreview(teacherId: string, studentId: string, unitId: string) {
    await this.studentsService.assertTeacherOwnsStudent(teacherId, studentId);
    return this.getPublishedUnitForStudent(studentId, unitId, { enforceLockedAccess: false });
  }

  async overrideOpenUnit(
    teacherId: string,
    studentId: string,
    unitId: string,
    reasonRaw?: string | null,
  ) {
    return this.learningTeacherActionsService.overrideOpenUnit(teacherId, studentId, unitId, reasonRaw);
  }

  async creditTask(teacherId: string, studentId: string, taskId: string) {
    return this.learningTeacherActionsService.creditTask(teacherId, studentId, taskId);
  }

  async creditTaskWithReason(
    teacherId: string,
    studentId: string,
    taskId: string,
    reasonRaw?: string | null,
  ) {
    return this.learningTeacherActionsService.creditTaskWithReason(
      teacherId,
      studentId,
      taskId,
      reasonRaw,
    );
  }

  async unblockTask(
    teacherId: string,
    studentId: string,
    taskId: string,
    reasonRaw?: string | null,
  ) {
    return this.learningTeacherActionsService.unblockTask(teacherId, studentId, taskId, reasonRaw);
  }

  private normalizeTaskState(
    state: {
      status: StudentTaskStatus;
      wrongAttempts: number;
      lockedUntil: Date | null;
      requiredSkipped: boolean;
      activeRevisionId: string;
      creditedRevisionId: string | null;
    } | null,
    activeRevisionId: string | null,
    now: Date,
  ) {
    if (!state || !activeRevisionId) {
      return {
        status: StudentTaskStatus.not_started,
        wrongAttempts: 0,
        blockedUntil: null,
        requiredSkipped: false,
      };
    }

    const creditedStatuses = new Set<StudentTaskStatus>([
      StudentTaskStatus.correct,
      StudentTaskStatus.accepted,
      StudentTaskStatus.credited_without_progress,
      StudentTaskStatus.teacher_credited,
    ]);

    if (!creditedStatuses.has(state.status) && state.activeRevisionId !== activeRevisionId) {
      return {
        status: StudentTaskStatus.not_started,
        wrongAttempts: 0,
        blockedUntil: null,
        requiredSkipped: false,
      };
    }

    const isBlocked = state.lockedUntil && state.lockedUntil > now;
    const status =
      state.status === StudentTaskStatus.blocked && !isBlocked
        ? state.wrongAttempts > 0
          ? StudentTaskStatus.in_progress
          : StudentTaskStatus.not_started
        : state.status;

    return {
      status,
      wrongAttempts: state.wrongAttempts,
      blockedUntil: isBlocked ? state.lockedUntil : null,
      requiredSkipped: state.requiredSkipped,
    };
  }

}
