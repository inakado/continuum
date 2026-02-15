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

  const payload = raw as Partial<LatexCompileQueuePayload>;
  if (
    typeof payload.tex !== 'string' ||
    !payload.tex.trim() ||
    typeof payload.requestedByUserId !== 'string' ||
    payload.requestedByRole !== 'teacher' ||
    typeof payload.ttlSec !== 'number' ||
    !Number.isInteger(payload.ttlSec) ||
    payload.ttlSec <= 0
  ) {
    throw new Error(
      JSON.stringify({
        code: 'LATEX_JOB_PAYLOAD_INVALID',
        message: 'Compile job payload has invalid fields',
      }),
    );
  }

  if (ensureUnitTarget(payload.target)) {
    if (typeof payload.unitId !== 'string' || !payload.unitId) {
      throw new Error(
        JSON.stringify({
          code: 'LATEX_JOB_PAYLOAD_INVALID',
          message: 'Compile job payload unitId is invalid',
        }),
      );
    }
    return payload as UnitLatexCompileQueuePayload;
  }

  if (payload.target === TASK_SOLUTION_PDF_TARGET) {
    if (
      typeof payload.taskId !== 'string' ||
      !payload.taskId ||
      typeof payload.taskRevisionId !== 'string' ||
      !payload.taskRevisionId
    ) {
      throw new Error(
        JSON.stringify({
          code: 'LATEX_JOB_PAYLOAD_INVALID',
          message: 'Compile job payload task fields are invalid',
        }),
      );
    }
    return payload as TaskSolutionLatexCompileQueuePayload;
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
