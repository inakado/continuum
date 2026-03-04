import { ConflictException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { z } from 'zod';
import {
  LATEX_MAX_SOURCE_LENGTH,
  PDF_TTL_MAX_SEC,
  type LatexCompileJobResult,
  type LatexCompileQueuePayload,
  type TaskSolutionLatexCompileJobResult,
  type TaskSolutionLatexCompileQueuePayload,
  TASK_SOLUTION_PDF_TARGET,
  type UnitLatexCompileJobResult,
  type UnitLatexCompileQueuePayload,
  type UnitPdfTarget,
} from './unit-pdf.constants';

export const TeacherUnitLatexCompileRequestSchema = z
  .object({
    target: z.enum(['theory', 'method']),
    tex: z.string().trim().min(1).max(LATEX_MAX_SOURCE_LENGTH),
    ttlSec: z.number().int().positive().max(PDF_TTL_MAX_SEC).optional(),
  })
  .passthrough();

export const TeacherTaskSolutionLatexCompileRequestSchema = z
  .object({
    latex: z.string().trim().min(1).max(LATEX_MAX_SOURCE_LENGTH),
    ttlSec: z.number().int().positive().max(PDF_TTL_MAX_SEC).optional(),
  })
  .passthrough();

export const TeacherLatexTtlQuerySchema = z
  .object({
    ttlSec: z.coerce.number().int().positive().max(PDF_TTL_MAX_SEC).optional(),
  })
  .passthrough();

const LatexCompileQueuePayloadBaseSchema = z.object({
  tex: z.string().trim().min(1),
  requestedByUserId: z.string().min(1),
  requestedByRole: z.literal(Role.teacher),
  ttlSec: z.number().int().positive(),
});

const UnitLatexCompileJobPayloadSchema = LatexCompileQueuePayloadBaseSchema.extend({
  target: z.enum(['theory', 'method']),
  unitId: z.string().min(1),
});

const TaskSolutionLatexCompileJobPayloadSchema = LatexCompileQueuePayloadBaseSchema.extend({
  target: z.literal(TASK_SOLUTION_PDF_TARGET),
  taskId: z.string().min(1),
  taskRevisionId: z.string().min(1),
});

const UnitLatexCompileJobResultSchema = z.object({
  target: z.enum(['theory', 'method']),
  unitId: z.string().min(1),
  assetKey: z.string().min(1),
  pdfAssetKey: z.string().min(1),
  htmlAssetKey: z.string().min(1),
  htmlAssets: z.array(
    z.object({
      placeholder: z.string().min(1),
      assetKey: z.string().min(1),
      contentType: z.literal('image/svg+xml'),
    }),
  ),
  sizeBytes: z.number().positive(),
  compileLogSnippet: z.string().optional(),
});

const TaskSolutionLatexCompileJobResultSchema = z.object({
  target: z.literal(TASK_SOLUTION_PDF_TARGET),
  taskId: z.string().min(1),
  taskRevisionId: z.string().min(1),
  assetKey: z.string().min(1),
  sizeBytes: z.number().positive(),
  compileLogSnippet: z.string().optional(),
});

export type TeacherUnitLatexCompileRequest = z.infer<typeof TeacherUnitLatexCompileRequestSchema>;
export type TeacherTaskSolutionLatexCompileRequest = z.infer<typeof TeacherTaskSolutionLatexCompileRequestSchema>;
export type TeacherLatexTtlQuery = z.infer<typeof TeacherLatexTtlQuerySchema>;

export const isUnitPdfTarget = (value: unknown): value is UnitPdfTarget =>
  value === 'theory' || value === 'method';

export const isUnitLatexCompileJobPayload = (
  payload: LatexCompileQueuePayload,
): payload is UnitLatexCompileQueuePayload => isUnitPdfTarget(payload.target);

export const isTaskSolutionLatexCompileJobPayload = (
  payload: LatexCompileQueuePayload,
): payload is TaskSolutionLatexCompileQueuePayload => payload.target === TASK_SOLUTION_PDF_TARGET;

export const isUnitLatexCompileJobResult = (
  result: LatexCompileJobResult,
): result is UnitLatexCompileJobResult =>
  isUnitPdfTarget(result.target) &&
  'pdfAssetKey' in result &&
  'htmlAssetKey' in result &&
  Array.isArray((result as UnitLatexCompileJobResult).htmlAssets);

export const isTaskSolutionLatexCompileJobResult = (
  result: LatexCompileJobResult,
): result is TaskSolutionLatexCompileJobResult => result.target === TASK_SOLUTION_PDF_TARGET;

const throwLatexJobPayloadInvalid = (message: string): never => {
  throw new ConflictException({
    code: 'LATEX_JOB_PAYLOAD_INVALID',
    message,
  });
};

const throwLatexJobResultInvalid = (message: string): never => {
  throw new ConflictException({
    code: 'LATEX_JOB_RESULT_INVALID',
    message,
  });
};

const firstIssuePath = (error: z.ZodError): Array<PropertyKey> => {
  const issue = error.issues[0];
  return Array.isArray(issue?.path) ? issue.path : [];
};

const mapUnitPayloadParseError = (error: z.ZodError): never => {
  const issuePath = firstIssuePath(error);
  if (issuePath[0] === 'requestedByUserId' || issuePath[0] === 'requestedByRole') {
    return throwLatexJobPayloadInvalid('Job payload is missing required fields');
  }
  if (issuePath[0] === 'ttlSec') {
    return throwLatexJobPayloadInvalid('Job payload ttlSec is invalid');
  }
  if (issuePath[0] === 'tex') {
    return throwLatexJobPayloadInvalid('Job payload tex is invalid');
  }
  if (issuePath[0] === 'unitId') {
    return throwLatexJobPayloadInvalid('Job payload unitId is invalid');
  }
  return throwLatexJobPayloadInvalid('Job payload is missing or malformed');
};

const mapTaskPayloadParseError = (error: z.ZodError): never => {
  const issuePath = firstIssuePath(error);
  if (issuePath[0] === 'requestedByUserId' || issuePath[0] === 'requestedByRole') {
    return throwLatexJobPayloadInvalid('Job payload is missing required fields');
  }
  if (issuePath[0] === 'ttlSec') {
    return throwLatexJobPayloadInvalid('Job payload ttlSec is invalid');
  }
  if (issuePath[0] === 'tex') {
    return throwLatexJobPayloadInvalid('Job payload tex is invalid');
  }
  if (issuePath[0] === 'taskId' || issuePath[0] === 'taskRevisionId') {
    return throwLatexJobPayloadInvalid('Job payload task fields are invalid');
  }
  return throwLatexJobPayloadInvalid('Job payload is missing or malformed');
};

const mapUnitResultParseError = (error: z.ZodError): never => {
  const issuePath = firstIssuePath(error);
  if (issuePath[0] === 'assetKey') {
    return throwLatexJobResultInvalid('Job result is missing required fields');
  }
  if (issuePath[0] === 'sizeBytes') {
    return throwLatexJobResultInvalid('Job result sizeBytes is invalid');
  }
  if (issuePath[0] === 'unitId') {
    return throwLatexJobResultInvalid('Job result unitId is invalid');
  }
  return throwLatexJobResultInvalid('Job result is missing or malformed');
};

const mapTaskResultParseError = (error: z.ZodError): never => {
  const issuePath = firstIssuePath(error);
  if (issuePath[0] === 'assetKey') {
    return throwLatexJobResultInvalid('Job result is missing required fields');
  }
  if (issuePath[0] === 'sizeBytes') {
    return throwLatexJobResultInvalid('Job result sizeBytes is invalid');
  }
  if (issuePath[0] === 'taskId' || issuePath[0] === 'taskRevisionId') {
    return throwLatexJobResultInvalid('Job result task fields are invalid');
  }
  return throwLatexJobResultInvalid('Job result is missing or malformed');
};

export const parseLatexCompileJobPayloadOrThrow = (raw: unknown): LatexCompileQueuePayload => {
  if (!raw || typeof raw !== 'object') {
    return throwLatexJobPayloadInvalid('Job payload is missing or malformed');
  }

  const target = (raw as { target?: unknown }).target;

  if (isUnitPdfTarget(target)) {
    const parsed = UnitLatexCompileJobPayloadSchema.safeParse(raw);
    if (parsed.success) {
      return parsed.data;
    }
    return mapUnitPayloadParseError(parsed.error);
  }

  if (target === TASK_SOLUTION_PDF_TARGET) {
    const parsed = TaskSolutionLatexCompileJobPayloadSchema.safeParse(raw);
    if (parsed.success) {
      return parsed.data;
    }
    return mapTaskPayloadParseError(parsed.error);
  }

  return throwLatexJobPayloadInvalid('Job payload target is invalid');
};

export const parseLatexCompileJobResultOrThrow = (raw: unknown): LatexCompileJobResult => {
  if (!raw || typeof raw !== 'object') {
    return throwLatexJobResultInvalid('Job result is missing or malformed');
  }

  const target = (raw as { target?: unknown }).target;

  if (isUnitPdfTarget(target)) {
    const parsed = UnitLatexCompileJobResultSchema.safeParse(raw);
    if (parsed.success) {
      return parsed.data;
    }
    return mapUnitResultParseError(parsed.error);
  }

  if (target === TASK_SOLUTION_PDF_TARGET) {
    const parsed = TaskSolutionLatexCompileJobResultSchema.safeParse(raw);
    if (parsed.success) {
      return parsed.data;
    }
    return mapTaskResultParseError(parsed.error);
  }

  return throwLatexJobResultInvalid('Job result target is invalid');
};
