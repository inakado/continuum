import { BadRequestException, ConflictException } from '@nestjs/common';
import type { ZodError, ZodIssue } from 'zod';
import type { ZodExceptionFactory } from '../pipes/zod-validation.pipe';

type ApiExceptionPayload = {
  code: string;
  message: string;
};

const createBadRequestException = (payload: ApiExceptionPayload) =>
  new BadRequestException({
    code: payload.code,
    message: payload.message,
  });

const createConflictException = (payload: ApiExceptionPayload) =>
  new ConflictException({
    code: payload.code,
    message: payload.message,
  });

const firstIssue = (error: ZodError): ZodIssue | undefined => error.issues[0];

const issueAt = (issue: ZodIssue | undefined, key: string): boolean => issue?.path[0] === key;

const isTooBig = (issue: ZodIssue | undefined): boolean => issue?.code === 'too_big';
const isTtlTooLarge = (issue: ZodIssue | undefined): boolean =>
  issue?.code === 'too_big' || issue?.message === 'ttlSec must be <= 600';

const isArrayCountIssue = (issue: ZodIssue | undefined): boolean =>
  issue?.code === 'too_small' || issue?.code === 'too_big' || issue?.code === 'invalid_type';

const isMissingIssue = (issue: ZodIssue | undefined): boolean =>
  issue?.code === 'invalid_type' || issue?.code === 'too_small';

const hasCustomMessage = (issue: ZodIssue | undefined, message: string): boolean =>
  issue?.message === message;

export const badRequestZodExceptionFactory = (payload: ApiExceptionPayload): ZodExceptionFactory =>
  () => createBadRequestException(payload);

export const conflictZodExceptionFactory = (payload: ApiExceptionPayload): ZodExceptionFactory =>
  () => createConflictException(payload);

export const photoPresignUploadExceptionFactory: ZodExceptionFactory = (error) => {
  const issue = firstIssue(error);
  const issuePath = Array.isArray(issue?.path) ? issue.path : [];

  if (issueAt(issue, 'ttlSec')) {
    if (isTtlTooLarge(issue)) {
      return createBadRequestException({
        code: 'TTL_TOO_LARGE',
        message: 'ttlSec must be <= 600',
      });
    }

    return createBadRequestException({
      code: 'INVALID_TTL',
      message: 'ttlSec must be a positive integer',
    });
  }

  if (issueAt(issue, 'files')) {
    if (issuePath.length <= 1 && isArrayCountIssue(issue)) {
      return createBadRequestException({
        code: 'TOO_MANY_FILES',
        message: 'files count must be between 1 and 5',
      });
    }

    if (issuePath[2] === 'sizeBytes') {
      if (isTooBig(issue)) {
        return createBadRequestException({
          code: 'FILE_TOO_LARGE',
          message: 'max file size is 20971520 bytes',
        });
      }

      return createBadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'sizeBytes must be a positive integer',
      });
    }

    if (issuePath[2] === 'filename') {
      return createBadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: 'filename is required',
      });
    }

    if (issuePath[2] === 'contentType') {
      return createBadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: 'contentType must be one of: image/jpeg, image/png, image/webp',
      });
    }

    if (issuePath.length === 2) {
      return createBadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: 'files[] item is invalid',
      });
    }
  }

  return createBadRequestException({
    code: 'TOO_MANY_FILES',
    message: 'files count must be between 1 and 5',
  });
};

export const photoSubmitExceptionFactory: ZodExceptionFactory = (error) => {
  const issue = firstIssue(error);
  const issuePath = Array.isArray(issue?.path) ? issue.path : [];

  if (hasCustomMessage(issue, 'assetKeys must be unique')) {
    return createConflictException({
      code: 'INVALID_ASSET_KEY',
      message: 'assetKeys must be unique',
    });
  }

  if (issueAt(issue, 'assetKeys') && issuePath.length === 1) {
    return createConflictException({
      code: 'INVALID_ASSET_KEY',
      message: 'assetKeys must be a non-empty array',
    });
  }

  return createConflictException({
    code: 'INVALID_ASSET_KEY',
    message: 'assetKey format is invalid',
  });
};

export const photoPresignViewExceptionFactory: ZodExceptionFactory = (error) => {
  const issue = firstIssue(error);

  if (issueAt(issue, 'ttlSec')) {
    if (isTtlTooLarge(issue)) {
      return createBadRequestException({
        code: 'TTL_TOO_LARGE',
        message: 'ttlSec must be <= 600',
      });
    }

    return createBadRequestException({
      code: 'INVALID_TTL',
      message: 'ttlSec must be a positive integer',
    });
  }

  if (issueAt(issue, 'assetKey')) {
    if (isMissingIssue(issue)) {
      return createConflictException({
        code: 'INVALID_ASSET_KEY',
        message: 'assetKey is required',
      });
    }

    return createConflictException({
      code: 'INVALID_ASSET_KEY',
      message: 'assetKey format is invalid',
    });
  }

  return createConflictException({
    code: 'INVALID_ASSET_KEY',
    message: 'assetKey format is invalid',
  });
};

export const teacherQueueQueryExceptionFactory: ZodExceptionFactory = (error) => {
  const issue = firstIssue(error);

  if (issueAt(issue, 'status')) {
    return createConflictException({
      code: 'INVALID_QUEUE_STATUS',
      message: 'status must be one of: submitted, accepted, rejected',
    });
  }

  if (issueAt(issue, 'limit')) {
    return createConflictException({
      code: 'INVALID_LIMIT',
      message: 'limit must be a positive integer',
    });
  }

  if (issueAt(issue, 'offset')) {
    return createConflictException({
      code: 'INVALID_OFFSET',
      message: 'offset must be a non-negative integer',
    });
  }

  return createConflictException({
    code: 'INVALID_QUEUE_STATUS',
    message: 'status must be one of: submitted, accepted, rejected',
  });
};

export const teacherInboxQueryExceptionFactory: ZodExceptionFactory = (error) => {
  const issue = firstIssue(error);

  if (issueAt(issue, 'status')) {
    return createConflictException({
      code: 'INVALID_QUEUE_STATUS',
      message: 'status must be one of: pending_review, accepted, rejected',
    });
  }

  if (issueAt(issue, 'sort')) {
    return createConflictException({
      code: 'INVALID_SORT',
      message: 'sort must be one of: oldest, newest',
    });
  }

  if (issueAt(issue, 'limit')) {
    return createConflictException({
      code: 'INVALID_LIMIT',
      message: 'limit must be a positive integer',
    });
  }

  if (issueAt(issue, 'offset')) {
    return createConflictException({
      code: 'INVALID_OFFSET',
      message: 'offset must be a non-negative integer',
    });
  }

  return createConflictException({
    code: 'INVALID_QUEUE_STATUS',
    message: 'status must be one of: pending_review, accepted, rejected',
  });
};

export const taskStatementImageUploadExceptionFactory: ZodExceptionFactory = (error) => {
  const issue = firstIssue(error);
  const issuePath = Array.isArray(issue?.path) ? issue.path : [];

  if (issueAt(issue, 'ttlSec')) {
    if (isTtlTooLarge(issue)) {
      return createBadRequestException({
        code: 'TTL_TOO_LARGE',
        message: 'ttlSec must be <= 600',
      });
    }

    return createBadRequestException({
      code: 'INVALID_TTL',
      message: 'ttlSec must be a positive integer',
    });
  }

  if (issueAt(issue, 'file')) {
    if (issuePath[1] === 'filename') {
      return createBadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: 'filename is required',
      });
    }

    if (issuePath[1] === 'contentType') {
      return createBadRequestException({
        code: 'INVALID_FILE_TYPE',
        message: 'contentType must be one of: image/jpeg, image/png, image/webp',
      });
    }

    if (issuePath[1] === 'sizeBytes') {
      if (isTooBig(issue)) {
        return createBadRequestException({
          code: 'FILE_TOO_LARGE',
          message: 'max file size is 20971520 bytes',
        });
      }

      return createBadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'sizeBytes must be a positive integer',
      });
    }

    return createBadRequestException({
      code: 'INVALID_FILE_TYPE',
      message: 'file payload is invalid',
    });
  }

  return createBadRequestException({
    code: 'INVALID_FILE_TYPE',
    message: 'file payload is invalid',
  });
};

export const taskStatementImageApplyExceptionFactory: ZodExceptionFactory = (error) => {
  const issue = firstIssue(error);

  if (issueAt(issue, 'assetKey')) {
    if (isMissingIssue(issue)) {
      return createConflictException({
        code: 'INVALID_ASSET_KEY',
        message: 'assetKey is required',
      });
    }

    return createConflictException({
      code: 'INVALID_ASSET_KEY',
      message: 'assetKey format is invalid',
    });
  }

  return createConflictException({
    code: 'INVALID_ASSET_KEY',
    message: 'assetKey format is invalid',
  });
};

export const taskStatementImageViewExceptionFactory: ZodExceptionFactory = (error) => {
  const issue = firstIssue(error);

  if (issueAt(issue, 'ttlSec')) {
    if (isTtlTooLarge(issue)) {
      return createBadRequestException({
        code: 'TTL_TOO_LARGE',
        message: 'ttlSec must be <= 600',
      });
    }

    return createBadRequestException({
      code: 'INVALID_TTL',
      message: 'ttlSec must be a positive integer',
    });
  }

  return createBadRequestException({
    code: 'INVALID_TTL',
    message: 'ttlSec must be a positive integer',
  });
};

export const teacherUnitLatexCompileExceptionFactory: ZodExceptionFactory = (error) => {
  const issue = firstIssue(error);

  if (issueAt(issue, 'target')) {
    return createBadRequestException({
      code: 'INVALID_PDF_TARGET',
      message: 'target must be one of: theory | method',
    });
  }

  if (issueAt(issue, 'tex')) {
    if (isTooBig(issue)) {
      return createBadRequestException({
        code: 'LATEX_TOO_LARGE',
        message: 'tex exceeds max length (200000)',
      });
    }

    return createBadRequestException({
      code: 'INVALID_LATEX_INPUT',
      message: 'tex must be a non-empty string',
    });
  }

  if (issueAt(issue, 'ttlSec')) {
    if (isTtlTooLarge(issue)) {
      return createBadRequestException({
        code: 'TTL_TOO_LARGE',
        message: 'ttlSec must be <= 3600',
      });
    }

    return createBadRequestException({
      code: 'INVALID_TTL',
      message: 'ttlSec must be a positive integer',
    });
  }

  return createBadRequestException({
    code: 'INVALID_PDF_TARGET',
    message: 'target must be one of: theory | method',
  });
};

export const teacherTaskSolutionLatexCompileExceptionFactory: ZodExceptionFactory = (error) => {
  const issue = firstIssue(error);

  if (issueAt(issue, 'latex')) {
    if (isTooBig(issue)) {
      return createBadRequestException({
        code: 'LATEX_TOO_LARGE',
        message: 'latex exceeds max length (200000)',
      });
    }

    return createBadRequestException({
      code: 'INVALID_LATEX_INPUT',
      message: 'latex must be a non-empty string',
    });
  }

  if (issueAt(issue, 'ttlSec')) {
    if (isTtlTooLarge(issue)) {
      return createBadRequestException({
        code: 'TTL_TOO_LARGE',
        message: 'ttlSec must be <= 3600',
      });
    }

    return createBadRequestException({
      code: 'INVALID_TTL',
      message: 'ttlSec must be a positive integer',
    });
  }

  return createBadRequestException({
    code: 'INVALID_LATEX_INPUT',
    message: 'latex must be a non-empty string',
  });
};

export const teacherLatexTtlQueryExceptionFactory: ZodExceptionFactory = (error) => {
  const issue = firstIssue(error);

  if (issueAt(issue, 'ttlSec') && isTtlTooLarge(issue)) {
    return createBadRequestException({
      code: 'TTL_TOO_LARGE',
      message: 'ttlSec must be <= 3600',
    });
  }

  return createBadRequestException({
    code: 'INVALID_TTL',
    message: 'ttlSec must be a positive integer',
  });
};
