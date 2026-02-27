import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  parseMultiChoiceAttemptPayload,
  parseNumericAttemptPayload,
  parseSingleChoiceAttemptPayload,
} from '../src/learning/attempt-validation';

describe('learning attempt parsing helpers', () => {
  it('keeps INVALID_NUMERIC_ANSWERS for invalid numeric payload', () => {
    try {
      parseNumericAttemptPayload({ answers: 'bad' });
      throw new Error('Expected exception was not thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as Record<string, unknown>;
      expect(response.code).toBe('INVALID_NUMERIC_ANSWERS');
    }
  });

  it('keeps INVALID_CHOICE_KEY for invalid single choice payload', () => {
    try {
      parseSingleChoiceAttemptPayload({});
      throw new Error('Expected exception was not thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as Record<string, unknown>;
      expect(response.code).toBe('INVALID_CHOICE_KEY');
    }
  });

  it('keeps INVALID_CHOICE_KEYS for invalid multi choice payload', () => {
    try {
      parseMultiChoiceAttemptPayload({ choiceKeys: [] });
      throw new Error('Expected exception was not thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as Record<string, unknown>;
      expect(response.code).toBe('INVALID_CHOICE_KEYS');
    }
  });

  it('parses valid payloads with trimming', () => {
    expect(parseNumericAttemptPayload({ answers: [{ partKey: ' p1 ', value: ' 42 ' }] })).toEqual([
      { partKey: 'p1', value: '42' },
    ]);
    expect(parseSingleChoiceAttemptPayload({ choiceKey: ' A ' })).toBe('A');
    expect(parseMultiChoiceAttemptPayload({ choiceKeys: [' A ', 'B'] })).toEqual(['A', 'B']);
  });
});
