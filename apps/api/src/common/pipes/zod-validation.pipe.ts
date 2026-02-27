import { type ArgumentMetadata, BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodError, ZodType } from 'zod';

export type ZodExceptionFactory = (error: ZodError, metadata: ArgumentMetadata) => Error;

const defaultZodExceptionFactory: ZodExceptionFactory = () =>
  new BadRequestException({
    code: 'VALIDATION_FAILED',
    message: 'Validation failed',
  });

@Injectable()
export class ZodValidationPipe<TOutput = unknown> implements PipeTransform<unknown, TOutput> {
  constructor(
    private readonly schema: ZodType<TOutput>,
    private readonly exceptionFactory: ZodExceptionFactory = defaultZodExceptionFactory,
  ) {}

  transform(value: unknown, metadata: ArgumentMetadata): TOutput {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw this.exceptionFactory(parsed.error, metadata);
    }

    return parsed.data;
  }
}
