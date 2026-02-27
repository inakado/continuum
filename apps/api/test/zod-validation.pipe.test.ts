import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { describe, expect, it } from 'vitest';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';

describe('ZodValidationPipe', () => {
  it('returns parsed payload on success', () => {
    const pipe = new ZodValidationPipe(
      z.object({
        value: z.string().trim().min(1),
      }),
    );

    const result = pipe.transform({ value: '  ok  ' }, { type: 'body' });

    expect(result).toEqual({ value: 'ok' });
  });

  it('throws BadRequestException with default payload on schema mismatch', () => {
    const pipe = new ZodValidationPipe(
      z.object({
        value: z.string(),
      }),
    );

    expect(() => pipe.transform({ value: 123 }, { type: 'body' })).toThrow(BadRequestException);

    try {
      pipe.transform({ value: 123 }, { type: 'body' });
      throw new Error('Expected exception was not thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as Record<string, unknown>;
      expect(response.code).toBe('VALIDATION_FAILED');
      expect(response.message).toBe('Validation failed');
    }
  });
});
