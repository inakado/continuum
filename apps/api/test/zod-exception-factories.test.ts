import {
  StudentPhotoPresignUploadRequestSchema,
  StudentPhotoPresignViewQuerySchema,
  StudentPhotoSubmitRequestSchema,
  TeacherPhotoInboxQuerySchema,
  TeacherPhotoQueueQuerySchema,
} from '@continuum/shared';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { ZodValidationPipe } from '../src/common/pipes/zod-validation.pipe';
import {
  photoPresignUploadExceptionFactory,
  photoPresignViewExceptionFactory,
  photoSubmitExceptionFactory,
  teacherInboxQueryExceptionFactory,
  teacherQueueQueryExceptionFactory,
} from '../src/common/validation/zod-exception-factories';

const extract = (error: unknown) => {
  const exception = error as BadRequestException | ConflictException;
  const response = exception.getResponse() as Record<string, unknown>;
  return {
    status: exception.getStatus(),
    code: response.code,
    message: response.message,
  };
};

describe('zod exception factories', () => {
  it('maps upload payload issues to legacy file/ttl codes', () => {
    const uploadPipe = new ZodValidationPipe(
      StudentPhotoPresignUploadRequestSchema,
      photoPresignUploadExceptionFactory,
    );

    try {
      uploadPipe.transform({}, { type: 'body' });
      throw new Error('Expected exception was not thrown');
    } catch (error) {
      const data = extract(error);
      expect(data.status).toBe(400);
      expect(data.code).toBe('TOO_MANY_FILES');
    }

    try {
      uploadPipe.transform(
        {
          files: [{ filename: 'a.png', contentType: 'image/png', sizeBytes: 10 }],
          ttlSec: 601,
        },
        { type: 'body' },
      );
      throw new Error('Expected exception was not thrown');
    } catch (error) {
      const data = extract(error);
      expect(data.status).toBe(400);
      expect(data.code).toBe('TTL_TOO_LARGE');
    }
  });

  it('maps submit payload issues to INVALID_ASSET_KEY with 409', () => {
    const submitPipe = new ZodValidationPipe(
      StudentPhotoSubmitRequestSchema,
      photoSubmitExceptionFactory,
    );

    try {
      submitPipe.transform({ assetKeys: [] }, { type: 'body' });
      throw new Error('Expected exception was not thrown');
    } catch (error) {
      const data = extract(error);
      expect(data.status).toBe(409);
      expect(data.code).toBe('INVALID_ASSET_KEY');
      expect(data.message).toBe('assetKeys must be a non-empty array');
    }
  });

  it('maps presign-view query issues to legacy 409/400 codes', () => {
    const pipe = new ZodValidationPipe(
      StudentPhotoPresignViewQuerySchema,
      photoPresignViewExceptionFactory,
    );

    try {
      pipe.transform({ assetKey: '' }, { type: 'query' });
      throw new Error('Expected exception was not thrown');
    } catch (error) {
      const data = extract(error);
      expect(data.status).toBe(409);
      expect(data.code).toBe('INVALID_ASSET_KEY');
      expect(data.message).toBe('assetKey is required');
    }

    try {
      pipe.transform({ assetKey: 'tasks/x/photo/a/b/c.png', ttlSec: '0' }, { type: 'query' });
      throw new Error('Expected exception was not thrown');
    } catch (error) {
      const data = extract(error);
      expect(data.status).toBe(400);
      expect(data.code).toBe('INVALID_TTL');
    }
  });

  it('maps teacher queue/inbox query issues to legacy conflict codes', () => {
    const queuePipe = new ZodValidationPipe(
      TeacherPhotoQueueQuerySchema,
      teacherQueueQueryExceptionFactory,
    );
    const inboxPipe = new ZodValidationPipe(
      TeacherPhotoInboxQuerySchema,
      teacherInboxQueryExceptionFactory,
    );

    try {
      queuePipe.transform({ status: 'pending' }, { type: 'query' });
      throw new Error('Expected exception was not thrown');
    } catch (error) {
      const data = extract(error);
      expect(data.status).toBe(409);
      expect(data.code).toBe('INVALID_QUEUE_STATUS');
    }

    try {
      inboxPipe.transform({ sort: 'latest' }, { type: 'query' });
      throw new Error('Expected exception was not thrown');
    } catch (error) {
      const data = extract(error);
      expect(data.status).toBe(409);
      expect(data.code).toBe('INVALID_SORT');
    }
  });
});
