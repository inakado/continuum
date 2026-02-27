import {
  MultiChoiceAttemptRequestSchema,
  NumericAttemptRequestSchema,
  SingleChoiceAttemptRequestSchema,
} from '@continuum/shared';
import { BadRequestException } from '@nestjs/common';

export type NumericAnswerInput = {
  partKey: string;
  value: string;
};

export const parseNumericAttemptPayload = (body: unknown): NumericAnswerInput[] => {
  const parsed = NumericAttemptRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({
      code: 'INVALID_NUMERIC_ANSWERS',
      message: 'Invalid numeric answers',
    });
  }

  return parsed.data.answers.map((item) => ({
    partKey: item.partKey.trim(),
    value: item.value.trim(),
  }));
};

export const parseSingleChoiceAttemptPayload = (body: unknown): string => {
  const parsed = SingleChoiceAttemptRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({
      code: 'INVALID_CHOICE_KEY',
      message: 'Invalid choiceKey',
    });
  }

  return parsed.data.choiceKey.trim();
};

export const parseMultiChoiceAttemptPayload = (body: unknown): string[] => {
  const parsed = MultiChoiceAttemptRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new BadRequestException({
      code: 'INVALID_CHOICE_KEYS',
      message: 'Invalid choiceKeys',
    });
  }

  const normalized = parsed.data.choiceKeys.map((value) => value.trim()).filter(Boolean);
  if (normalized.length === 0) {
    throw new BadRequestException({
      code: 'INVALID_CHOICE_KEYS',
      message: 'Invalid choiceKeys',
    });
  }

  return normalized;
};
