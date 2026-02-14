import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AttemptKind,
  AttemptResult,
  ContentStatus,
  EventCategory,
  NotificationType,
  Prisma,
  Role,
  StudentTaskStatus,
  StudentUnitStatus,
  TaskAnswerType,
} from '@prisma/client';
import { ContentService } from '../content/content.service';
import { EventsLogService } from '../events/events-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { LearningAvailabilityService } from './learning-availability.service';

const MAX_ANSWER_LENGTH = 2000;

type NumericAnswerInput = { partKey: string; value: string };

type NumericPartResult = { partKey: string; correct: boolean };

type AttemptEvaluation = {
  result: AttemptResult;
  numericAnswers?: NumericAnswerInput[];
  selectedChoiceKey?: string;
  selectedChoiceKeys?: string[];
  perPart?: NumericPartResult[];
};

@Injectable()
export class LearningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contentService: ContentService,
    private readonly eventsLogService: EventsLogService,
    private readonly learningAvailabilityService: LearningAvailabilityService,
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

    if (!unitMeta) throw new NotFoundException('Unit not found');

    const sectionSnapshots = await this.learningAvailabilityService.recomputeSectionAvailability(
      studentId,
      unitMeta.sectionId,
    );
    const unitSnapshot = sectionSnapshots.get(unitId);
    if (!unitSnapshot) throw new NotFoundException('Unit not found');

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

    if (!unit) throw new NotFoundException('Unit not found');

    const missingRevision = unit.tasks.find(
      (task) => !task.activeRevisionId || !task.activeRevision,
    );
    if (missingRevision) {
      throw new ConflictException({
        message: 'TASK_ACTIVE_REVISION_MISSING',
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
        const mapped = this.contentService.mapTaskWithRevision(task as any);
        const state = statesMap.get(task.id);
        const normalizedState = this.normalizeTaskState(state ?? null, task.activeRevisionId, now);
        const { correctAnswerJson, solutionLite, numericPartsJson, ...rest } =
          mapped as Record<string, unknown>;
        const isCredited =
          normalizedState.status === StudentTaskStatus.correct ||
          normalizedState.status === StudentTaskStatus.accepted ||
          normalizedState.status === StudentTaskStatus.credited_without_progress ||
          normalizedState.status === StudentTaskStatus.teacher_credited;
        const safeNumericParts = Array.isArray(numericPartsJson)
          ? numericPartsJson.map((part: any) => ({
              key: part.key,
              labelLite: part.labelLite ?? null,
              ...(isCredited ? { correctValue: part.correctValue } : {}),
            }))
          : null;
        return {
          ...rest,
          numericPartsJson: safeNumericParts,
          ...(isCredited ? { correctAnswerJson, solutionLite } : {}),
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

  async submitAttempt(studentId: string, taskId: string, body: unknown) {
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
      include: {
        unit: { include: { section: { include: { course: true } } } },
        activeRevision: {
          include: {
            numericParts: true,
            choices: true,
            correctChoices: true,
          },
        },
      },
    });

    if (!task) throw new NotFoundException('Task not found');
    if (!task.activeRevisionId || !task.activeRevision) {
      throw new ConflictException({
        message: 'TASK_ACTIVE_REVISION_MISSING',
        taskId,
      });
    }

    const revision = task.activeRevision;
    if (revision.answerType === TaskAnswerType.photo) {
      throw new ConflictException('Photo tasks are not supported yet');
    }

    const evaluation = this.evaluateAttempt(revision, body);
    const lockMinutes = task.unit.section.course.lockDurationMinutes;
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const profile = await tx.studentProfile.findUnique({
        where: { userId: studentId },
        select: { leadTeacherId: true, userId: true },
      });
      if (!profile) throw new NotFoundException('Student not found');

      let state = await tx.studentTaskState.findUnique({
        where: { studentId_taskId: { studentId, taskId } },
      });

      if (!state) {
        state = await tx.studentTaskState.create({
          data: {
            studentId,
            taskId,
            status: StudentTaskStatus.not_started,
            activeRevisionId: task.activeRevisionId ?? revision.id,
            wrongAttempts: 0,
            lockedUntil: null,
            requiredSkipped: false,
            creditedRevisionId: null,
            creditedAt: null,
            updatedAt: now,
          },
        });
      }

      const creditedStatuses = new Set<StudentTaskStatus>([
        StudentTaskStatus.correct,
        StudentTaskStatus.accepted,
        StudentTaskStatus.credited_without_progress,
        StudentTaskStatus.teacher_credited,
      ]);

      if (!creditedStatuses.has(state.status) && state.activeRevisionId !== task.activeRevisionId) {
        state = await tx.studentTaskState.update({
          where: { studentId_taskId: { studentId, taskId } },
          data: {
            status: StudentTaskStatus.not_started,
            activeRevisionId: task.activeRevisionId ?? revision.id,
            wrongAttempts: 0,
            lockedUntil: null,
            requiredSkipped: false,
            creditedRevisionId: null,
            creditedAt: null,
            updatedAt: now,
          },
        });
      }

      if (creditedStatuses.has(state.status)) {
        throw new ConflictException('Task already credited');
      }

      if (state.lockedUntil && state.lockedUntil > now) {
        throw new ConflictException({
          message: 'Task is blocked',
          blockedUntil: state.lockedUntil,
        });
      }

      const lastAttempt = await tx.attempt.findFirst({
        where: {
          studentId,
          taskRevisionId: task.activeRevisionId ?? revision.id,
        },
        orderBy: { attemptNo: 'desc' },
      });
      const attemptNo = (lastAttempt?.attemptNo ?? 0) + 1;

      let nextStatus = state.status;
      let wrongAttemptsAfter = state.wrongAttempts;
      let blockedUntil: Date | null = null;
      let creditedRevisionId = state.creditedRevisionId;
      let creditedAt = state.creditedAt;
      let requiredSkipped = state.requiredSkipped;

      if (evaluation.result === AttemptResult.correct) {
        nextStatus = StudentTaskStatus.correct;
        creditedRevisionId = task.activeRevisionId ?? revision.id;
        creditedAt = now;
      } else {
        wrongAttemptsAfter = state.wrongAttempts + 1;
        nextStatus =
          state.status === StudentTaskStatus.not_started
            ? StudentTaskStatus.in_progress
            : state.status === StudentTaskStatus.blocked
              ? StudentTaskStatus.in_progress
              : state.status;

        if (wrongAttemptsAfter === 3) {
          nextStatus = StudentTaskStatus.blocked;
          blockedUntil = new Date(now.getTime() + lockMinutes * 60 * 1000);
        }
        if (wrongAttemptsAfter === 6) {
          nextStatus = StudentTaskStatus.credited_without_progress;
          creditedRevisionId = task.activeRevisionId ?? revision.id;
          creditedAt = now;
          requiredSkipped = task.isRequired;
          blockedUntil = null;
        }
      }

      const attempt = await tx.attempt.create({
        data: {
          studentId,
          taskId,
          taskRevisionId: task.activeRevisionId ?? revision.id,
          attemptNo,
          kind: revision.answerType as AttemptKind,
          numericAnswers: evaluation.numericAnswers
            ? (evaluation.numericAnswers as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
          selectedChoiceKey: evaluation.selectedChoiceKey ?? null,
          selectedChoiceKeys: evaluation.selectedChoiceKeys
            ? (evaluation.selectedChoiceKeys as unknown as Prisma.InputJsonValue)
            : Prisma.DbNull,
          result: evaluation.result,
        },
      });

      const updatedState = await tx.studentTaskState.update({
        where: { studentId_taskId: { studentId, taskId } },
        data: {
          status: nextStatus,
          activeRevisionId: task.activeRevisionId ?? revision.id,
          wrongAttempts: wrongAttemptsAfter,
          lockedUntil: blockedUntil,
          requiredSkipped,
          creditedRevisionId,
          creditedAt,
          updatedAt: now,
        },
      });

      if (evaluation.result === AttemptResult.incorrect && wrongAttemptsAfter === 3 && blockedUntil) {
        await tx.notification.create({
          data: {
            recipientUserId: profile.leadTeacherId,
            type: NotificationType.task_locked,
            payload: {
              studentId,
              taskId,
              taskRevisionId: task.activeRevisionId ?? revision.id,
              unitId: task.unitId,
              lockedUntil: blockedUntil,
            },
          },
        });
      }

      if (
        evaluation.result === AttemptResult.incorrect &&
        wrongAttemptsAfter === 6 &&
        task.isRequired
      ) {
        await tx.notification.create({
          data: {
            recipientUserId: profile.leadTeacherId,
            type: NotificationType.required_task_skipped,
            payload: {
              studentId,
              taskId,
              taskRevisionId: task.activeRevisionId ?? revision.id,
              unitId: task.unitId,
            },
          },
        });
      }

      await this.learningAvailabilityService.recomputeSectionAvailability(
        studentId,
        task.unit.sectionId,
        tx,
      );

      return {
        attempt,
        updatedState,
        wrongAttemptsAfter,
        blockedUntil,
        leadTeacherId: profile.leadTeacherId,
        requiredSkipped,
      };
    });

    await this.eventsLogService.append({
      category: EventCategory.learning,
      eventType: 'AttemptSubmitted',
      actorUserId: studentId,
      actorRole: Role.student,
      entityType: 'attempt',
      entityId: result.attempt.id,
      payload: {
        attempt_id: result.attempt.id,
        student_id: studentId,
        task_id: taskId,
        task_revision_id: task.activeRevisionId ?? revision.id,
        kind: revision.answerType,
      },
    });

    if (result.attempt.result === AttemptResult.correct) {
      await this.eventsLogService.append({
        category: EventCategory.learning,
        eventType: 'AttemptEvaluatedCorrect',
        actorUserId: studentId,
        actorRole: Role.student,
        entityType: 'attempt',
        entityId: result.attempt.id,
        payload: {
          attempt_id: result.attempt.id,
          task_id: taskId,
          task_revision_id: task.activeRevisionId ?? revision.id,
        },
      });
    } else {
      await this.eventsLogService.append({
        category: EventCategory.learning,
        eventType: 'AttemptEvaluatedIncorrect',
        actorUserId: studentId,
        actorRole: Role.student,
        entityType: 'attempt',
        entityId: result.attempt.id,
        payload: {
          attempt_id: result.attempt.id,
          task_id: taskId,
          task_revision_id: task.activeRevisionId ?? revision.id,
          wrong_attempts_after: result.wrongAttemptsAfter,
        },
      });
    }

    if (result.attempt.result === AttemptResult.incorrect && result.wrongAttemptsAfter === 3) {
      await this.eventsLogService.append({
        category: EventCategory.system,
        eventType: 'TaskLockedForStudent',
        actorUserId: studentId,
        actorRole: Role.student,
        entityType: 'task',
        entityId: taskId,
        payload: {
          student_id: studentId,
          task_id: taskId,
          task_revision_id: task.activeRevisionId ?? revision.id,
          locked_until: result.blockedUntil,
        },
      });
    }

    if (result.attempt.result === AttemptResult.incorrect && result.wrongAttemptsAfter === 6) {
      await this.eventsLogService.append({
        category: EventCategory.system,
        eventType: 'TaskAutoCreditedWithoutProgress',
        actorUserId: studentId,
        actorRole: Role.student,
        entityType: 'task',
        entityId: taskId,
        payload: {
          student_id: studentId,
          task_id: taskId,
          task_revision_id: task.activeRevisionId ?? revision.id,
          required: task.isRequired,
        },
      });

      if (task.isRequired) {
        await this.eventsLogService.append({
          category: EventCategory.system,
          eventType: 'RequiredTaskSkippedFlagSet',
          actorUserId: studentId,
          actorRole: Role.student,
          entityType: 'task',
          entityId: taskId,
          payload: {
            student_id: studentId,
            task_id: taskId,
            task_revision_id: task.activeRevisionId ?? revision.id,
          },
        });
      }
    }

    return {
      status: result.updatedState.status,
      attemptNo: result.attempt.attemptNo,
      wrongAttempts: result.wrongAttemptsAfter,
      blockedUntil: result.updatedState.lockedUntil,
      perPart: evaluation.perPart,
    };
  }

  async listNotifications(teacherId: string, studentId?: string) {
    if (!studentId) {
      throw new BadRequestException('studentId is required');
    }

    await this.assertTeacherOwnsStudent(teacherId, studentId);

    return this.prisma.notification.findMany({
      where: {
        recipientUserId: teacherId,
        payload: {
          path: ['studentId'],
          equals: studentId,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTeacherUnitPreview(teacherId: string, studentId: string, unitId: string) {
    await this.assertTeacherOwnsStudent(teacherId, studentId);
    return this.getPublishedUnitForStudent(studentId, unitId, { enforceLockedAccess: false });
  }

  async creditTask(teacherId: string, studentId: string, taskId: string) {
    await this.assertTeacherOwnsStudent(teacherId, studentId);

    const { updated, previousStatus } = await this.prisma.$transaction(async (tx) => {
      const state = await tx.studentTaskState.findUnique({
        where: { studentId_taskId: { studentId, taskId } },
      });

      if (!state) {
        throw new NotFoundException('Task state not found');
      }
      if (state.status !== StudentTaskStatus.credited_without_progress) {
        throw new ConflictException('Task is not auto-credited');
      }

      const task = await tx.task.findUnique({
        where: { id: taskId },
        select: { unit: { select: { sectionId: true } } },
      });
      if (!task) throw new NotFoundException('Task not found');

      const updatedState = await tx.studentTaskState.update({
        where: { studentId_taskId: { studentId, taskId } },
        data: {
          status: StudentTaskStatus.teacher_credited,
          creditedAt: new Date(),
          updatedAt: new Date(),
        },
      });

      await this.learningAvailabilityService.recomputeSectionAvailability(
        studentId,
        task.unit.sectionId,
        tx,
      );

      return {
        updated: updatedState,
        previousStatus: state.status,
      };
    });

    await this.eventsLogService.append({
      category: EventCategory.admin,
      eventType: 'TaskTeacherCreditedForStudent',
      actorUserId: teacherId,
      actorRole: Role.teacher,
      entityType: 'task',
      entityId: taskId,
      payload: {
        teacher_id: teacherId,
        student_id: studentId,
        task_id: taskId,
        task_revision_id: updated.creditedRevisionId ?? updated.activeRevisionId,
        from_status: previousStatus,
      },
    });

    return {
      status: updated.status,
      taskId,
      studentId,
    };
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

  private async assertTeacherOwnsStudent(teacherId: string, studentId: string) {
    const profile = await this.prisma.studentProfile.findUnique({
      where: { userId: studentId },
      include: { user: { select: { role: true } } },
    });

    if (!profile || profile.user.role !== Role.student) {
      throw new NotFoundException('Student not found');
    }
    if (profile.leadTeacherId !== teacherId) {
      throw new ForbiddenException('Student is not assigned to this teacher');
    }
  }

  private evaluateAttempt(
    revision: {
      answerType: TaskAnswerType;
      numericParts: { partKey: string; labelLite: string | null; correctValue: string }[];
      choices: { choiceKey: string; contentLite: string }[];
      correctChoices: { choiceKey: string }[];
    },
    body: unknown,
  ) {
    if (revision.answerType === TaskAnswerType.numeric) {
      const payload = body as { answers?: NumericAnswerInput[] };
      if (!payload || !Array.isArray(payload.answers)) {
        throw new BadRequestException('InvalidNumericAnswers');
      }

      const answers: NumericAnswerInput[] = payload.answers.map((item) => {
        if (!item || typeof item !== 'object') throw new BadRequestException('InvalidNumericAnswers');
        const partKey = typeof item.partKey === 'string' ? item.partKey.trim() : '';
        const value = typeof item.value === 'string' ? item.value.trim() : '';
        if (!partKey) throw new BadRequestException('InvalidNumericAnswers');
        if (value.length > MAX_ANSWER_LENGTH) throw new BadRequestException('InvalidNumericAnswers');
        return { partKey, value };
      });

      const answersMap = new Map(answers.map((item) => [item.partKey, item.value]));
      const perPart: NumericPartResult[] = revision.numericParts.map((part) => {
        const value = answersMap.get(part.partKey) ?? '';
        const correct = value.trim() === part.correctValue.trim();
        return { partKey: part.partKey, correct };
      });
      const isCorrect = perPart.length > 0 && perPart.every((part) => part.correct);

      return {
        result: isCorrect ? AttemptResult.correct : AttemptResult.incorrect,
        numericAnswers: answers,
        perPart,
      } as AttemptEvaluation;
    }

    if (revision.answerType === TaskAnswerType.single_choice) {
      const payload = body as { choiceKey?: string };
      const choiceKey = typeof payload?.choiceKey === 'string' ? payload.choiceKey.trim() : '';
      if (!choiceKey) throw new BadRequestException('InvalidChoiceKey');

      const allowedKeys = new Set(revision.choices.map((choice) => choice.choiceKey));
      if (!allowedKeys.has(choiceKey)) throw new BadRequestException('InvalidChoiceKey');

      const correctKey = revision.correctChoices[0]?.choiceKey;
      const isCorrect = Boolean(correctKey) && correctKey === choiceKey;

      return {
        result: isCorrect ? AttemptResult.correct : AttemptResult.incorrect,
        selectedChoiceKey: choiceKey,
      } as AttemptEvaluation;
    }

    if (revision.answerType === TaskAnswerType.multi_choice) {
      const payload = body as { choiceKeys?: string[] };
      if (!payload || !Array.isArray(payload.choiceKeys) || payload.choiceKeys.length === 0) {
        throw new BadRequestException('InvalidChoiceKeys');
      }

      const normalized = payload.choiceKeys.map((value) => (typeof value === 'string' ? value.trim() : '')).filter(Boolean);
      if (normalized.length === 0) throw new BadRequestException('InvalidChoiceKeys');

      const allowedKeys = new Set(revision.choices.map((choice) => choice.choiceKey));
      const uniqueKeys = Array.from(new Set(normalized));
      uniqueKeys.forEach((key) => {
        if (!allowedKeys.has(key)) throw new BadRequestException('InvalidChoiceKeys');
      });

      const correctKeys = revision.correctChoices.map((choice) => choice.choiceKey).sort();
      const selectedKeys = [...uniqueKeys].sort();
      const isCorrect =
        correctKeys.length === selectedKeys.length &&
        correctKeys.every((key, index) => key === selectedKeys[index]);

      return {
        result: isCorrect ? AttemptResult.correct : AttemptResult.incorrect,
        selectedChoiceKeys: selectedKeys,
      } as AttemptEvaluation;
    }

    throw new ConflictException('Answer type not supported');
  }
}
