import {
  BadRequestException,
  ConflictException,
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

@Injectable()
export class LearningAttemptsWriteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly learningAuditLogService: LearningAuditLogService,
    private readonly learningAvailabilityService: LearningAvailabilityService,
  ) {}

  async submitAttempt(studentId: string, taskId: string, body: StudentAttemptRequest) {
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

    const revision = task.activeRevision;
    if (revision.answerType === TaskAnswerType.photo) {
      throw new ConflictException({
        code: 'TASK_NOT_AUTO_CHECK',
        message: 'Photo tasks are not supported by auto-check submit endpoint',
      });
    }

    const evaluation = this.evaluateAttempt(revision, body);
    const lockMinutes = task.unit.section.course.lockDurationMinutes;
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
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
      await this.assertUnitAvailableForStudent(studentId, task.unit.sectionId, task.unit.id, tx);

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

    await this.learningAuditLogService.appendStudentLearningEvent({
      eventType: 'AttemptSubmitted',
      studentId,
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
      await this.learningAuditLogService.appendStudentLearningEvent({
        eventType: 'AttemptEvaluatedCorrect',
        studentId,
        entityType: 'attempt',
        entityId: result.attempt.id,
        payload: {
          attempt_id: result.attempt.id,
          task_id: taskId,
          task_revision_id: task.activeRevisionId ?? revision.id,
        },
      });
    } else {
      await this.learningAuditLogService.appendStudentLearningEvent({
        eventType: 'AttemptEvaluatedIncorrect',
        studentId,
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
      await this.learningAuditLogService.appendStudentSystemEvent({
        eventType: 'TaskLockedForStudent',
        studentId,
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
      await this.learningAuditLogService.appendStudentSystemEvent({
        eventType: 'TaskAutoCreditedWithoutProgress',
        studentId,
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
        await this.learningAuditLogService.appendStudentSystemEvent({
          eventType: 'RequiredTaskSkippedFlagSet',
          studentId,
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
