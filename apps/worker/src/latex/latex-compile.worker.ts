import { Job } from 'bullmq';
import {
  LATEX_COMPILE_JOB_NAME,
  LatexCompileJobResult,
  LatexCompileQueuePayload,
  TASK_SOLUTION_PDF_TARGET,
  TaskSolutionLatexCompileJobResult,
  TaskSolutionLatexCompileQueuePayload,
  UnitLatexCompileJobResult,
  UnitLatexCompileQueuePayload,
  UnitPdfTarget,
  buildTaskSolutionPdfKey,
  buildUnitPdfKey,
} from './latex-queue.contract';
import { compileLatexToPdf, LatexCompileError } from './latex-compile';
import { applyUnitPdfKeyViaApi } from './latex-apply-client';
import { WorkerObjectStorageService } from '../storage/object-storage';

const ensureUnitTarget = (value: unknown): value is UnitPdfTarget =>
  value === 'theory' || value === 'method';

const parsePayload = (raw: unknown): LatexCompileQueuePayload => {
  if (!raw || typeof raw !== 'object') {
    throw new Error(
      JSON.stringify({
        code: 'LATEX_JOB_PAYLOAD_INVALID',
        message: 'Compile job payload is missing',
      }),
    );
  }

  const payload = raw as Record<string, unknown>;
  const tex = payload.tex;
  const requestedByUserId = payload.requestedByUserId;
  const requestedByRole = payload.requestedByRole;
  const ttlSec = payload.ttlSec;
  const target = payload.target;
  if (
    typeof tex !== 'string' ||
    !tex.trim() ||
    typeof requestedByUserId !== 'string' ||
    requestedByRole !== 'teacher' ||
    typeof ttlSec !== 'number' ||
    !Number.isInteger(ttlSec) ||
    ttlSec <= 0
  ) {
    throw new Error(
      JSON.stringify({
        code: 'LATEX_JOB_PAYLOAD_INVALID',
        message: 'Compile job payload has invalid fields',
      }),
    );
  }

  if (ensureUnitTarget(target)) {
    const unitId = payload.unitId;
    if (typeof unitId !== 'string' || !unitId) {
      throw new Error(
        JSON.stringify({
          code: 'LATEX_JOB_PAYLOAD_INVALID',
          message: 'Compile job payload unitId is invalid',
        }),
      );
    }
    return {
      tex,
      requestedByUserId,
      requestedByRole,
      ttlSec,
      target,
      unitId,
    } as UnitLatexCompileQueuePayload;
  }

  if (target === TASK_SOLUTION_PDF_TARGET) {
    const taskId = payload.taskId;
    const taskRevisionId = payload.taskRevisionId;
    if (
      typeof taskId !== 'string' ||
      !taskId ||
      typeof taskRevisionId !== 'string' ||
      !taskRevisionId
    ) {
      throw new Error(
        JSON.stringify({
          code: 'LATEX_JOB_PAYLOAD_INVALID',
          message: 'Compile job payload task fields are invalid',
        }),
      );
    }
    return {
      tex,
      requestedByUserId,
      requestedByRole,
      ttlSec,
      target,
      taskId,
      taskRevisionId,
    } as TaskSolutionLatexCompileQueuePayload;
  }

  throw new Error(
    JSON.stringify({
      code: 'LATEX_JOB_PAYLOAD_INVALID',
      message: 'Compile job payload target is invalid',
    }),
  );
};

const formatError = (error: unknown): Error => {
  if (error instanceof Error && error.message) {
    try {
      const parsed = JSON.parse(error.message) as { code?: unknown; message?: unknown };
      if (typeof parsed.code === 'string' && typeof parsed.message === 'string') {
        return error;
      }
    } catch {
      // no-op
    }
  }

  if (error instanceof LatexCompileError) {
    return new Error(
      JSON.stringify({
        code: error.code,
        message: error.message,
        ...(error.logSnippet ? { logSnippet: error.logSnippet } : null),
      }),
    );
  }

  if (error instanceof Error) {
    return new Error(
      JSON.stringify({
        code: 'LATEX_COMPILE_FAILED',
        message: error.message,
      }),
    );
  }

  return new Error(
    JSON.stringify({
      code: 'LATEX_COMPILE_FAILED',
      message: 'Unknown compile worker error',
    }),
  );
};

export const createLatexCompileProcessor = (storage: WorkerObjectStorageService) => {
  return async (job: Job): Promise<LatexCompileJobResult> => {
    if (job.name !== LATEX_COMPILE_JOB_NAME) {
      throw new Error(
        JSON.stringify({
          code: 'LATEX_JOB_NAME_INVALID',
          message: `Unsupported job name "${job.name}"`,
        }),
      );
    }

    try {
      const payload = parsePayload(job.data);
      console.log(
        `[worker][latex] start jobId=${job.id} target=${payload.target}${
          'unitId' in payload ? ` unitId=${payload.unitId}` : ` taskId=${payload.taskId}`
        }`,
      );

      const compiled = await compileLatexToPdf(payload.tex);
      const key =
        payload.target === TASK_SOLUTION_PDF_TARGET
          ? buildTaskSolutionPdfKey(payload.taskId, payload.taskRevisionId, new Date())
          : buildUnitPdfKey(payload.unitId, payload.target, new Date());
      await storage.putObject({
        key,
        contentType: 'application/pdf',
        body: compiled.pdfBytes,
        cacheControl: 'no-store',
      });
      const jobId = String(job.id ?? '');
      if (!jobId) {
        throw new Error(
          JSON.stringify({
            code: 'LATEX_APPLY_FAILED',
            message: 'Compile job id is missing',
          }),
        );
      }

      const baseResult = {
        target: payload.target,
        assetKey: key,
        sizeBytes: compiled.pdfBytes.length,
        ...(compiled.logSnippet ? { compileLogSnippet: compiled.logSnippet } : null),
      };
      const result: LatexCompileJobResult =
        payload.target === TASK_SOLUTION_PDF_TARGET
          ? ({
              ...baseResult,
              taskId: payload.taskId,
              taskRevisionId: payload.taskRevisionId,
            } as TaskSolutionLatexCompileJobResult)
          : ({
              ...baseResult,
              unitId: payload.unitId,
            } as UnitLatexCompileJobResult);

      await job.updateProgress({ autoApplyResult: result });
      const applyResult = await applyUnitPdfKeyViaApi(jobId, result);
      if (!applyResult.ok) {
        throw new Error(
          JSON.stringify({
            code: 'LATEX_APPLY_FAILED',
            message: 'Internal apply endpoint returned an invalid response',
          }),
        );
      }
      console.log(
        `[worker][latex] apply jobId=${job.id} target=${payload.target} applied=${String(
          applyResult.applied,
        )}${applyResult.reason ? ` reason=${applyResult.reason}` : ''}${
          'unitId' in payload ? ` unitId=${payload.unitId}` : ` taskId=${payload.taskId}`
        }`,
      );

      console.log(
        `[worker][latex] success jobId=${job.id} target=${payload.target} bytes=${result.sizeBytes}${
          'unitId' in payload ? ` unitId=${payload.unitId}` : ` taskId=${payload.taskId}`
        }`,
      );
      return result;
    } catch (error) {
      const formatted = formatError(error);
      console.error(`[worker][latex] failed jobId=${job.id} error=${formatted.message}`);
      throw formatted;
    }
  };
};
