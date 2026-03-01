import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type AttemptKind,
  AttemptResult,
  ContentStatus,
  NotificationType,
  Prisma,
  StudentTaskStatus,
  StudentUnitStatus,
  TaskAnswerType,
} from '@prisma/client';
import { type StudentAttemptRequest } from '@continuum/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  parseMultiChoiceAttemptPayload,
  parseNumericAttemptPayload,
  parseSingleChoiceAttemptPayload,
  type NumericAnswerInput,
} from './attempt-validation';
import { LearningAuditLogService } from './learning-audit-log.service';
import { LearningAvailabilityService } from './learning-availability.service';

type NumericPartResult = { partKey: string; correct: boolean };

type AttemptEvaluation = {
  result: AttemptResult;
  numericAnswers?: NumericAnswerInput[];
  selectedChoiceKey?: string;
  selectedChoiceKeys?: string[];
  perPart?: NumericPartResult[];
};

const publishedTaskAttemptInclude = {
  unit: { include: { section: { include: { course: true } } } },
  activeRevision: {
    include: {
      numericParts: true,
      choices: true,
      correctChoices: true,
    },
  },
} satisfies Prisma.TaskInclude;

const creditedStatuses = new Set<StudentTaskStatus>([
  StudentTaskStatus.correct,
  StudentTaskStatus.accepted,
  StudentTaskStatus.credited_without_progress,
  StudentTaskStatus.teacher_credited,
]);

type PublishedTask = Prisma.TaskGetPayload<{ include: typeof publishedTaskAttemptInclude }>;
type PublishedTaskRevision = NonNullable<PublishedTask['activeRevision']>;

type LoadedAttemptTask = {
  task: PublishedTask;
  revision: PublishedTaskRevision;
  activeRevisionId: string;
};

type StudentProfileRecord = {
  userId: string;
  leadTeacherId: string;
};

type StudentTaskStateRecord = {
  studentId: string;
  taskId: string;
  status: StudentTaskStatus;
  activeRevisionId: string | null;
  wrongAttempts: number;
  lockedUntil: Date | null;
  requiredSkipped: boolean;
  creditedRevisionId: string | null;
  creditedAt: Date | null;
  updatedAt: Date;
};

type AttemptRecord = {
  id: string;
  attemptNo: number;
  result: AttemptResult;
};

type AttemptStateTransition = {
  status: StudentTaskStatus;
  wrongAttempts: number;
  lockedUntil: Date | null;
  requiredSkipped: boolean;
  creditedRevisionId: string | null;
  creditedAt: Date | null;
};

type SubmitAttemptTransactionResult = {
  attempt: AttemptRecord;
  updatedState: StudentTaskStateRecord;
  wrongAttemptsAfter: number;
  blockedUntil: Date | null;
  leadTeacherId: string;
};

@Injectable()
export class LearningAttemptsWriteService {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
    @Inject(LearningAuditLogService)
    private readonly learningAuditLogService: LearningAuditLogService,
    @Inject(LearningAvailabilityService)
    private readonly learningAvailabilityService: LearningAvailabilityService,
  ) {}

  async submitAttempt(studentId: string, taskId: string, body: StudentAttemptRequest) {
    const loadedTask = await this.loadPublishedTaskOrThrow(taskId);
    const { task, revision, activeRevisionId } = loadedTask;
    const evaluation = this.evaluateAttempt(revision, body);
    const now = new Date();
    const result = await this.prisma.$transaction((tx) =>
      this.submitAttemptInTransaction({
        tx,
        studentId,
        taskId,
        task,
        revision,
        activeRevisionId,
        evaluation,
        now,
      }),
    );

    await this.appendAttemptAuditEvents({
      studentId,
      taskId,
      task,
      revision,
      activeRevisionId,
      result,
    });

    return {
      status: result.updatedState.status,
      attemptNo: result.attempt.attemptNo,
      wrongAttempts: result.wrongAttemptsAfter,
      blockedUntil: result.updatedState.lockedUntil,
      perPart: evaluation.perPart,
    };
  }

  private async loadPublishedTaskOrThrow(taskId: string): Promise<LoadedAttemptTask> {
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
      include: publishedTaskAttemptInclude,
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
        taskId,
      });
    }

    if (task.activeRevision.answerType === TaskAnswerType.photo) {
      throw new ConflictException({
        code: 'TASK_NOT_AUTO_CHECK',
        message: 'Photo tasks are not supported by auto-check submit endpoint',
      });
    }

    return {
      task,
      revision: task.activeRevision,
      activeRevisionId: task.activeRevisionId,
    };
  }

  private async submitAttemptInTransaction(args: {
    tx: Prisma.TransactionClient;
    studentId: string;
    taskId: string;
    task: PublishedTask;
    revision: PublishedTaskRevision;
    activeRevisionId: string;
    evaluation: AttemptEvaluation;
    now: Date;
  }): Promise<SubmitAttemptTransactionResult> {
    const { tx, studentId, taskId, task, revision, activeRevisionId, evaluation, now } = args;
    const profile = await this.loadStudentProfileOrThrow(tx, studentId);
    await this.assertUnitAvailableForStudent(studentId, task.unit.sectionId, task.unit.id, tx);

    let state = await this.loadOrCreateTaskState(tx, {
      studentId,
      taskId,
      activeRevisionId,
      now,
    });
    state = await this.resetTaskStateForNewRevisionIfNeeded(tx, {
      studentId,
      taskId,
      state,
      activeRevisionId,
      now,
    });
    this.assertAttemptAllowed(state, now);

    const attemptNo = await this.getNextAttemptNo(tx, studentId, activeRevisionId);
    const transition = this.resolveAttemptStateTransition({
      state,
      evaluation,
      activeRevisionId,
      isRequired: task.isRequired,
      lockMinutes: task.unit.section.course.lockDurationMinutes,
      now,
    });

    const attempt = await this.createAttemptRecord(tx, {
      studentId,
      taskId,
      activeRevisionId,
      attemptNo,
      answerType: revision.answerType,
      evaluation,
    });
    const updatedState = await this.persistTaskState(tx, {
      studentId,
      taskId,
      activeRevisionId,
      transition,
      now,
    });

    await this.createAttemptNotifications(tx, {
      studentId,
      taskId,
      task,
      activeRevisionId,
      evaluation,
      wrongAttemptsAfter: transition.wrongAttempts,
      blockedUntil: transition.lockedUntil,
      leadTeacherId: profile.leadTeacherId,
    });

    await this.learningAvailabilityService.recomputeSectionAvailability(
      studentId,
      task.unit.sectionId,
      tx,
    );

    return {
      attempt,
      updatedState,
      wrongAttemptsAfter: transition.wrongAttempts,
      blockedUntil: transition.lockedUntil,
      leadTeacherId: profile.leadTeacherId,
    };
  }

  private async loadStudentProfileOrThrow(
    tx: Prisma.TransactionClient,
    studentId: string,
  ): Promise<StudentProfileRecord> {
    const profile = await tx.studentProfile.findUnique({
      where: { userId: studentId },
      select: { leadTeacherId: true, userId: true },
    });

    if (!profile) {
      throw new NotFoundException({
        code: 'STUDENT_NOT_FOUND',
        message: 'Student not found',
      });
    }

    return profile;
  }

  private async loadOrCreateTaskState(
    tx: Prisma.TransactionClient,
    args: {
      studentId: string;
      taskId: string;
      activeRevisionId: string;
      now: Date;
    },
  ): Promise<StudentTaskStateRecord> {
    const { studentId, taskId, activeRevisionId, now } = args;
    const existingState = await tx.studentTaskState.findUnique({
      where: { studentId_taskId: { studentId, taskId } },
    });

    if (existingState) {
      return existingState;
    }

    return tx.studentTaskState.create({
      data: {
        studentId,
        taskId,
        ...this.buildResetTaskState(activeRevisionId, now),
      },
    });
  }

  private async resetTaskStateForNewRevisionIfNeeded(
    tx: Prisma.TransactionClient,
    args: {
      studentId: string;
      taskId: string;
      state: StudentTaskStateRecord;
      activeRevisionId: string;
      now: Date;
    },
  ): Promise<StudentTaskStateRecord> {
    const { studentId, taskId, state, activeRevisionId, now } = args;

    if (creditedStatuses.has(state.status) || state.activeRevisionId === activeRevisionId) {
      return state;
    }

    return tx.studentTaskState.update({
      where: { studentId_taskId: { studentId, taskId } },
      data: this.buildResetTaskState(activeRevisionId, now),
    });
  }

  private buildResetTaskState(activeRevisionId: string, now: Date) {
    return {
      status: StudentTaskStatus.not_started,
      activeRevisionId,
      wrongAttempts: 0,
      lockedUntil: null,
      requiredSkipped: false,
      creditedRevisionId: null,
      creditedAt: null,
      updatedAt: now,
    };
  }

  private assertAttemptAllowed(state: StudentTaskStateRecord, now: Date) {
    if (creditedStatuses.has(state.status)) {
      throw new ConflictException({
        code: 'TASK_ALREADY_CREDITED',
        message: 'Task already credited',
      });
    }

    if (state.lockedUntil && state.lockedUntil > now) {
      throw new ConflictException({
        code: 'TASK_BLOCKED',
        message: 'Task is blocked',
        blockedUntil: state.lockedUntil,
      });
    }
  }

  private async getNextAttemptNo(
    tx: Prisma.TransactionClient,
    studentId: string,
    activeRevisionId: string,
  ) {
    const lastAttempt = await tx.attempt.findFirst({
      where: {
        studentId,
        taskRevisionId: activeRevisionId,
      },
      orderBy: { attemptNo: 'desc' },
    });

    return (lastAttempt?.attemptNo ?? 0) + 1;
  }

  private resolveAttemptStateTransition(args: {
    state: StudentTaskStateRecord;
    evaluation: AttemptEvaluation;
    activeRevisionId: string;
    isRequired: boolean;
    lockMinutes: number;
    now: Date;
  }): AttemptStateTransition {
    const { state, evaluation, activeRevisionId, isRequired, lockMinutes, now } = args;

    if (evaluation.result === AttemptResult.correct) {
      return {
        status: StudentTaskStatus.correct,
        wrongAttempts: state.wrongAttempts,
        lockedUntil: null,
        requiredSkipped: state.requiredSkipped,
        creditedRevisionId: activeRevisionId,
        creditedAt: now,
      };
    }

    const wrongAttempts = state.wrongAttempts + 1;
    let status: StudentTaskStatus =
      state.status === StudentTaskStatus.not_started || state.status === StudentTaskStatus.blocked
        ? StudentTaskStatus.in_progress
        : state.status;
    let lockedUntil: Date | null = null;
    let creditedRevisionId = state.creditedRevisionId;
    let creditedAt = state.creditedAt;
    let requiredSkipped = state.requiredSkipped;

    if (wrongAttempts === 3) {
      status = StudentTaskStatus.blocked;
      lockedUntil = new Date(now.getTime() + lockMinutes * 60 * 1000);
    }

    if (wrongAttempts === 6) {
      status = StudentTaskStatus.credited_without_progress;
      lockedUntil = null;
      creditedRevisionId = activeRevisionId;
      creditedAt = now;
      requiredSkipped = isRequired;
    }

    return {
      status,
      wrongAttempts,
      lockedUntil,
      requiredSkipped,
      creditedRevisionId,
      creditedAt,
    };
  }

  private async createAttemptRecord(
    tx: Prisma.TransactionClient,
    args: {
      studentId: string;
      taskId: string;
      activeRevisionId: string;
      attemptNo: number;
      answerType: TaskAnswerType;
      evaluation: AttemptEvaluation;
    },
  ): Promise<AttemptRecord> {
    const { studentId, taskId, activeRevisionId, attemptNo, answerType, evaluation } = args;

    return tx.attempt.create({
      data: {
        studentId,
        taskId,
        taskRevisionId: activeRevisionId,
        attemptNo,
        kind: answerType as AttemptKind,
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
  }

  private async persistTaskState(
    tx: Prisma.TransactionClient,
    args: {
      studentId: string;
      taskId: string;
      activeRevisionId: string;
      transition: AttemptStateTransition;
      now: Date;
    },
  ): Promise<StudentTaskStateRecord> {
    const { studentId, taskId, activeRevisionId, transition, now } = args;

    return tx.studentTaskState.update({
      where: { studentId_taskId: { studentId, taskId } },
      data: {
        status: transition.status,
        activeRevisionId,
        wrongAttempts: transition.wrongAttempts,
        lockedUntil: transition.lockedUntil,
        requiredSkipped: transition.requiredSkipped,
        creditedRevisionId: transition.creditedRevisionId,
        creditedAt: transition.creditedAt,
        updatedAt: now,
      },
    });
  }

  private async createAttemptNotifications(
    tx: Prisma.TransactionClient,
    args: {
      studentId: string;
      taskId: string;
      task: PublishedTask;
      activeRevisionId: string;
      evaluation: AttemptEvaluation;
      wrongAttemptsAfter: number;
      blockedUntil: Date | null;
      leadTeacherId: string;
    },
  ) {
    const {
      studentId,
      taskId,
      task,
      activeRevisionId,
      evaluation,
      wrongAttemptsAfter,
      blockedUntil,
      leadTeacherId,
    } = args;

    if (evaluation.result === AttemptResult.incorrect && wrongAttemptsAfter === 3 && blockedUntil) {
      await tx.notification.create({
        data: {
          recipientUserId: leadTeacherId,
          type: NotificationType.task_locked,
          payload: {
            studentId,
            taskId,
            taskRevisionId: activeRevisionId,
            unitId: task.unitId,
            lockedUntil: blockedUntil,
          },
        },
      });
    }

    if (evaluation.result === AttemptResult.incorrect && wrongAttemptsAfter === 6 && task.isRequired) {
      await tx.notification.create({
        data: {
          recipientUserId: leadTeacherId,
          type: NotificationType.required_task_skipped,
          payload: {
            studentId,
            taskId,
            taskRevisionId: activeRevisionId,
            unitId: task.unitId,
          },
        },
      });
    }
  }

  private async appendAttemptAuditEvents(args: {
    studentId: string;
    taskId: string;
    task: PublishedTask;
    revision: PublishedTaskRevision;
    activeRevisionId: string;
    result: SubmitAttemptTransactionResult;
  }) {
    const { studentId, taskId, task, revision, activeRevisionId, result } = args;

    await this.learningAuditLogService.appendStudentLearningEvent({
      eventType: 'AttemptSubmitted',
      studentId,
      entityType: 'attempt',
      entityId: result.attempt.id,
      payload: {
        attempt_id: result.attempt.id,
        student_id: studentId,
        task_id: taskId,
        task_revision_id: activeRevisionId,
        kind: revision.answerType,
      },
    });

    if (result.attempt.result === AttemptResult.correct) {
      await this.learningAuditLogService.appendStudentLearningEvent({
        eventType: 'AttemptEvaluatedCorrect',
        studentId,
        entityType: 'attempt',
        entityId: result.attempt.id,
        payload: {
          attempt_id: result.attempt.id,
          task_id: taskId,
          task_revision_id: activeRevisionId,
        },
      });
      return;
    }

    await this.learningAuditLogService.appendStudentLearningEvent({
      eventType: 'AttemptEvaluatedIncorrect',
      studentId,
      entityType: 'attempt',
      entityId: result.attempt.id,
      payload: {
        attempt_id: result.attempt.id,
        task_id: taskId,
        task_revision_id: activeRevisionId,
        wrong_attempts_after: result.wrongAttemptsAfter,
      },
    });

    if (result.wrongAttemptsAfter === 3) {
      await this.learningAuditLogService.appendStudentSystemEvent({
        eventType: 'TaskLockedForStudent',
        studentId,
        entityType: 'task',
        entityId: taskId,
        payload: {
          student_id: studentId,
          task_id: taskId,
          task_revision_id: activeRevisionId,
          locked_until: result.blockedUntil,
        },
      });
    }

    if (result.wrongAttemptsAfter !== 6) {
      return;
    }

    await this.learningAuditLogService.appendStudentSystemEvent({
      eventType: 'TaskAutoCreditedWithoutProgress',
      studentId,
      entityType: 'task',
      entityId: taskId,
      payload: {
        student_id: studentId,
        task_id: taskId,
        task_revision_id: activeRevisionId,
        required: task.isRequired,
      },
    });

    if (task.isRequired) {
      await this.learningAuditLogService.appendStudentSystemEvent({
        eventType: 'RequiredTaskSkippedFlagSet',
        studentId,
        entityType: 'task',
        entityId: taskId,
        payload: {
          student_id: studentId,
          task_id: taskId,
          task_revision_id: activeRevisionId,
        },
      });
    }
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

  private evaluateAttempt(
    revision: {
      answerType: TaskAnswerType;
      numericParts: { partKey: string; labelLite: string | null; correctValue: string }[];
      choices: { choiceKey: string; contentLite: string }[];
      correctChoices: { choiceKey: string }[];
    },
    body: StudentAttemptRequest,
  ) {
    if (revision.answerType === TaskAnswerType.numeric) {
      const answers = parseNumericAttemptPayload(body);

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
      const choiceKey = parseSingleChoiceAttemptPayload(body);

      const allowedKeys = new Set(revision.choices.map((choice) => choice.choiceKey));
      if (!allowedKeys.has(choiceKey)) {
        throw new BadRequestException({
          code: 'INVALID_CHOICE_KEY',
          message: 'Invalid choiceKey',
        });
      }

      const correctKey = revision.correctChoices[0]?.choiceKey;
      const isCorrect = Boolean(correctKey) && correctKey === choiceKey;

      return {
        result: isCorrect ? AttemptResult.correct : AttemptResult.incorrect,
        selectedChoiceKey: choiceKey,
      } as AttemptEvaluation;
    }

    if (revision.answerType === TaskAnswerType.multi_choice) {
      const normalized = parseMultiChoiceAttemptPayload(body);

      const allowedKeys = new Set(revision.choices.map((choice) => choice.choiceKey));
      const uniqueKeys = Array.from(new Set(normalized));
      uniqueKeys.forEach((key) => {
        if (!allowedKeys.has(key)) {
          throw new BadRequestException({
            code: 'INVALID_CHOICE_KEYS',
            message: 'Invalid choiceKeys',
          });
        }
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

    throw new ConflictException({
      code: 'ANSWER_TYPE_NOT_SUPPORTED',
      message: 'Answer type not supported',
    });
  }
}
