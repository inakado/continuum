import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma, TaskAnswerType } from '@prisma/client';

export type NumericPart = { key: string; labelLite?: string | null; correctValue: string };
export type Choice = { key: string; textLite: string };
export type CorrectAnswer = { key?: string; keys?: string[] };

export type NormalizedTaskPayload = {
  answerType: TaskAnswerType;
  statementLite: string;
  numericPartsJson: NumericPart[] | null;
  choicesJson: Choice[] | null;
  correctAnswerJson: CorrectAnswer | null;
  statementImageAssetKey: string | null;
  solutionLite: string | null;
  solutionRichLatex: string | null;
  solutionPdfAssetKey: string | null;
};

export type TaskRevisionRecord = {
  id: string;
  answerType: TaskAnswerType;
  statementLite: string;
  statementImageAssetKey: string | null;
  solutionLite: string | null;
  solutionRichLatex: string | null;
  solutionPdfAssetKey: string | null;
  numericParts: { partKey: string; labelLite: string | null; correctValue: string }[];
  choices: { choiceKey: string; contentLite: string }[];
  correctChoices: { choiceKey: string }[];
};

export type TaskWithActiveRevision = {
  id: string;
  unitId: string;
  title: string | null;
  isRequired: boolean;
  status: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  activeRevision: TaskRevisionRecord;
};

@Injectable()
export class TaskRevisionPayloadService {
  mapTaskWithRevision(task: TaskWithActiveRevision) {
    if (!task.activeRevision) {
      throw new ConflictException({
        code: 'TASK_ACTIVE_REVISION_MISSING',
        message: 'Task active revision is missing',
        taskId: task.id,
      });
    }
    const revision = task.activeRevision;
    const numericParts = revision.numericParts.map((part) => ({
      key: part.partKey,
      labelLite: part.labelLite,
      correctValue: part.correctValue,
    }));
    const choices = revision.choices.map((choice) => ({
      key: choice.choiceKey,
      textLite: choice.contentLite,
    }));
    const sortedNumericParts = this.sortByKey(numericParts);
    const sortedChoices = this.sortByKey(choices);
    const correctKeys = revision.correctChoices.map((item) => item.choiceKey).sort();
    const correctAnswerJson =
      revision.answerType === TaskAnswerType.single_choice
        ? correctKeys[0]
          ? { key: correctKeys[0] }
          : null
        : revision.answerType === TaskAnswerType.multi_choice
          ? { keys: correctKeys }
          : null;

    return {
      id: task.id,
      unitId: task.unitId,
      title: task.title,
      statementLite: revision.statementLite,
      answerType: revision.answerType,
      numericPartsJson:
        revision.answerType === TaskAnswerType.numeric ? sortedNumericParts : null,
      choicesJson:
        revision.answerType === TaskAnswerType.single_choice ||
        revision.answerType === TaskAnswerType.multi_choice
          ? sortedChoices
          : null,
      correctAnswerJson,
      statementImageAssetKey: revision.statementImageAssetKey,
      solutionLite: revision.solutionLite,
      solutionRichLatex: revision.solutionRichLatex,
      solutionPdfAssetKey: revision.solutionPdfAssetKey,
      isRequired: task.isRequired,
      status: task.status,
      sortOrder: task.sortOrder,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }

  async nextTaskRevisionNo(tx: Prisma.TransactionClient, taskId: string) {
    const last = await tx.taskRevision.aggregate({
      where: { taskId },
      _max: { revisionNo: true },
    });
    return (last._max.revisionNo ?? 0) + 1;
  }

  async createTaskRevision(
    tx: Prisma.TransactionClient,
    taskId: string,
    revisionNo: number,
    normalized: NormalizedTaskPayload,
  ) {
    const revision = await tx.taskRevision.create({
      data: {
        taskId,
        revisionNo,
        answerType: normalized.answerType,
        statementLite: normalized.statementLite,
        statementImageAssetKey: normalized.statementImageAssetKey,
        solutionLite: normalized.solutionLite,
        solutionRichLatex: normalized.solutionRichLatex,
        solutionPdfAssetKey: normalized.solutionPdfAssetKey,
      },
    });

    if (normalized.answerType === TaskAnswerType.numeric && normalized.numericPartsJson) {
      await tx.taskRevisionNumericPart.createMany({
        data: normalized.numericPartsJson.map((part) => ({
          taskRevisionId: revision.id,
          partKey: part.key,
          labelLite: part.labelLite ?? null,
          correctValue: part.correctValue,
        })),
      });
    }

    if (
      (normalized.answerType === TaskAnswerType.single_choice ||
        normalized.answerType === TaskAnswerType.multi_choice) &&
      normalized.choicesJson &&
      normalized.correctAnswerJson
    ) {
      await tx.taskRevisionChoice.createMany({
        data: normalized.choicesJson.map((choice) => ({
          taskRevisionId: revision.id,
          choiceKey: choice.key,
          contentLite: choice.textLite,
        })),
      });

      const correctKeys =
        normalized.answerType === TaskAnswerType.single_choice
          ? normalized.correctAnswerJson.key
            ? [normalized.correctAnswerJson.key]
            : []
          : normalized.correctAnswerJson.keys ?? [];

      if (correctKeys.length > 0) {
        await tx.taskRevisionCorrectChoice.createMany({
          data: correctKeys.map((key) => ({
            taskRevisionId: revision.id,
            choiceKey: key,
          })),
        });
      }
    }

    return revision;
  }

  normalizeTaskPayload(payload: {
    answerType: unknown;
    statementLite: unknown;
    numericPartsJson?: unknown;
    choicesJson?: unknown;
    correctAnswerJson?: unknown;
    statementImageAssetKey?: unknown;
    solutionLite?: unknown;
    solutionRichLatex?: unknown;
    solutionPdfAssetKey?: unknown;
  }): NormalizedTaskPayload {
    const answerType = this.normalizeAnswerType(payload.answerType);
    const statementLite =
      this.sanitizeLiteText(payload.statementLite, {
        required: true,
        maxLength: 20_000,
        errorCode: 'InvalidStatementLite',
      }) ?? '';
    const solutionLite = this.sanitizeLiteText(payload.solutionLite, {
      required: false,
      maxLength: 20_000,
      errorCode: 'InvalidSolutionLite',
    });
    let statementImageAssetKey: string | null = null;
    if (payload.statementImageAssetKey !== undefined && payload.statementImageAssetKey !== null) {
      if (typeof payload.statementImageAssetKey !== 'string') {
        throw new BadRequestException('InvalidStatementImageAssetKey');
      }
      statementImageAssetKey = this.normalizeAssetKey(payload.statementImageAssetKey);
    }
    const solutionRichLatex = this.sanitizeRichText(
      payload.solutionRichLatex as string | null | undefined,
    );
    let solutionPdfAssetKey: string | null = null;
    if (payload.solutionPdfAssetKey !== undefined && payload.solutionPdfAssetKey !== null) {
      if (typeof payload.solutionPdfAssetKey !== 'string') {
        throw new BadRequestException('InvalidSolutionPdfAssetKey');
      }
      solutionPdfAssetKey = this.normalizeAssetKey(payload.solutionPdfAssetKey);
    }

    if (answerType === TaskAnswerType.numeric) {
      const numericParts = this.normalizeNumericParts(payload.numericPartsJson);
      return {
        answerType,
        statementLite,
        numericPartsJson: numericParts,
        choicesJson: null,
        correctAnswerJson: null,
        statementImageAssetKey,
        solutionLite,
        solutionRichLatex,
        solutionPdfAssetKey,
      };
    }

    if (answerType === TaskAnswerType.single_choice || answerType === TaskAnswerType.multi_choice) {
      const choices = this.normalizeChoices(payload.choicesJson);
      const choiceKeys = new Set(choices.map((choice) => choice.key));
      const correctAnswer =
        answerType === TaskAnswerType.single_choice
          ? this.normalizeCorrectAnswerSingle(payload.correctAnswerJson, choiceKeys)
          : this.normalizeCorrectAnswerMulti(payload.correctAnswerJson, choiceKeys);
      return {
        answerType,
        statementLite,
        numericPartsJson: null,
        choicesJson: choices,
        correctAnswerJson: correctAnswer,
        statementImageAssetKey,
        solutionLite,
        solutionRichLatex,
        solutionPdfAssetKey,
      };
    }

    if (payload.numericPartsJson !== null && payload.numericPartsJson !== undefined) {
      throw new BadRequestException('InvalidNumericParts');
    }
    if (payload.choicesJson !== null && payload.choicesJson !== undefined) {
      throw new BadRequestException('InvalidChoices');
    }
    if (payload.correctAnswerJson !== null && payload.correctAnswerJson !== undefined) {
      throw new BadRequestException('InvalidCorrectAnswer');
    }

    return {
      answerType,
      statementLite,
      numericPartsJson: null,
      choicesJson: null,
      correctAnswerJson: null,
      statementImageAssetKey,
      solutionLite,
      solutionRichLatex,
      solutionPdfAssetKey,
    };
  }

  private sortByKey<T extends { key: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => {
      const aNum = Number(a.key);
      const bNum = Number(b.key);
      const aIsNum = Number.isFinite(aNum) && String(aNum) === a.key;
      const bIsNum = Number.isFinite(bNum) && String(bNum) === b.key;
      if (aIsNum && bIsNum) return aNum - bNum;
      return a.key.localeCompare(b.key);
    });
  }

  private sanitizeRichText(value: string | null | undefined): string | null {
    if (value === null) return null;
    if (value === undefined) return null;
    if (typeof value !== 'string') throw new BadRequestException('InvalidRichText');
    const trimmed = value.trim();
    if (trimmed.length > 200_000) throw new BadRequestException('InvalidRichText');
    return trimmed.length === 0 ? null : trimmed;
  }

  private normalizeAssetKey(value: string | null): string | null {
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private sanitizeLiteText(
    value: unknown,
    options: { required: boolean; maxLength?: number; errorCode: string },
  ): string | null {
    const maxLength = options.maxLength ?? 20_000;
    if (value === null || value === undefined) {
      if (options.required) throw new BadRequestException(options.errorCode);
      return null;
    }
    if (typeof value !== 'string') throw new BadRequestException(options.errorCode);
    const trimmed = value.trim();
    if (options.required && trimmed.length === 0) throw new BadRequestException(options.errorCode);
    if (trimmed.length > maxLength) throw new BadRequestException(options.errorCode);
    return trimmed.length === 0 ? null : trimmed;
  }

  private normalizeAnswerType(value: unknown): TaskAnswerType {
    if (
      value !== TaskAnswerType.numeric &&
      value !== TaskAnswerType.single_choice &&
      value !== TaskAnswerType.multi_choice &&
      value !== TaskAnswerType.photo
    ) {
      throw new BadRequestException('InvalidAnswerType');
    }
    return value as TaskAnswerType;
  }

  private normalizeKey(value: unknown, errorCode: string): string {
    if (typeof value !== 'string') throw new BadRequestException(errorCode);
    const trimmed = value.trim();
    if (!trimmed) throw new BadRequestException(errorCode);
    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) throw new BadRequestException(errorCode);
    return trimmed;
  }

  private normalizeNumericParts(value: unknown): NumericPart[] {
    if (!Array.isArray(value) || value.length === 0) {
      throw new BadRequestException('InvalidNumericParts');
    }

    const keys = new Set<string>();
    return value.map((item, index) => {
      if (!item || typeof item !== 'object') throw new BadRequestException('InvalidNumericParts');
      const part = item as Record<string, unknown>;
      const rawKey = typeof part.key === 'string' ? part.key : '';
      const normalizedKey = rawKey.trim() || String(index + 1);
      const key = this.normalizeKey(normalizedKey, 'InvalidNumericParts');
      if (keys.has(key)) throw new BadRequestException('InvalidNumericParts');
      keys.add(key);

      const labelLite = this.sanitizeLiteText(part.labelLite, {
        required: false,
        maxLength: 2000,
        errorCode: 'InvalidNumericParts',
      });
      const correctValue = this.sanitizeLiteText(part.correctValue, {
        required: true,
        maxLength: 2000,
        errorCode: 'InvalidNumericParts',
      });

      return { key, labelLite: labelLite ?? null, correctValue: correctValue ?? '' };
    });
  }

  private normalizeChoices(value: unknown): Choice[] {
    if (!Array.isArray(value) || value.length < 2) {
      throw new BadRequestException('InvalidChoices');
    }

    const keys = new Set<string>();
    return value.map((item, index) => {
      if (!item || typeof item !== 'object') throw new BadRequestException('InvalidChoices');
      const choice = item as Record<string, unknown>;
      const rawKey = typeof choice.key === 'string' ? choice.key : '';
      const normalizedKey = rawKey.trim() || String(index + 1);
      const key = this.normalizeKey(normalizedKey, 'InvalidChoices');
      if (keys.has(key)) throw new BadRequestException('InvalidChoices');
      keys.add(key);

      const textLite = this.sanitizeLiteText(choice.textLite, {
        required: true,
        maxLength: 2000,
        errorCode: 'InvalidChoices',
      });

      return { key, textLite: textLite ?? '' };
    });
  }

  private normalizeCorrectAnswerSingle(value: unknown, choiceKeys: Set<string>): CorrectAnswer {
    if (!value || typeof value !== 'object') throw new BadRequestException('InvalidCorrectAnswer');
    const v = value as Record<string, unknown>;
    const key = this.normalizeKey(v.key, 'InvalidCorrectAnswer');
    if (!choiceKeys.has(key)) throw new BadRequestException('InvalidCorrectAnswer');
    return { key };
  }

  private normalizeCorrectAnswerMulti(value: unknown, choiceKeys: Set<string>): CorrectAnswer {
    if (!value || typeof value !== 'object') throw new BadRequestException('InvalidCorrectAnswer');
    const v = value as Record<string, unknown>;
    if (!Array.isArray(v.keys) || v.keys.length === 0) {
      throw new BadRequestException('InvalidCorrectAnswer');
    }
    const unique = new Set<string>();
    const keys = v.keys.map((item) => {
      const key = this.normalizeKey(item, 'InvalidCorrectAnswer');
      if (!choiceKeys.has(key)) throw new BadRequestException('InvalidCorrectAnswer');
      unique.add(key);
      return key;
    });
    if (unique.size === 0) throw new BadRequestException('InvalidCorrectAnswer');
    return { keys: Array.from(unique) };
  }
}
