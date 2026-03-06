import { type Job } from 'bullmq';
import {
  DEBUG_PDF_TARGET,
  LATEX_COMPILE_JOB_NAME,
  type DebugLatexCompileJobResult,
  type DebugLatexCompileQueuePayload,
  type LatexCompileJobResult,
  type LatexCompileQueuePayload,
  TASK_SOLUTION_PDF_TARGET,
  type TaskSolutionLatexCompileJobResult,
  type TaskSolutionLatexCompileQueuePayload,
  type UnitLatexCompileJobResult,
  type UnitLatexCompileQueuePayload,
  type UnitPdfTarget,
  buildUnitHtmlKey,
  buildDebugPdfKey,
  buildTaskSolutionHtmlKey,
  buildUnitPdfKey,
} from './latex-queue.contract';
import { compileLatexToPdf, LatexCompileError } from './latex-compile';
import { applyUnitPdfKeyViaApi } from './latex-apply-client';
import { type WorkerObjectStorageService } from '../storage/object-storage';
import { renderLatexToHtml } from '../latex-html/render-latex-to-html';

const ensureUnitTarget = (value: unknown): value is UnitPdfTarget =>
  value === 'theory' || value === 'method';

const describePayloadScope = (payload: LatexCompileQueuePayload): string => {
  if ('unitId' in payload) {
    return `unitId=${payload.unitId}`;
  }
  if ('taskId' in payload) {
    return `taskId=${payload.taskId}`;
  }
  return `debugTarget=${payload.debugTarget}`;
};

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

  if (target === DEBUG_PDF_TARGET) {
    const debugTarget = payload.debugTarget;
    if (!ensureUnitTarget(debugTarget)) {
      throw new Error(
        JSON.stringify({
          code: 'LATEX_JOB_PAYLOAD_INVALID',
          message: 'Compile job payload debugTarget is invalid',
        }),
      );
    }
    return {
      tex,
      requestedByUserId,
      requestedByRole,
      ttlSec,
      target,
      debugTarget,
    } as DebugLatexCompileQueuePayload;
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
        ...(error.log ? { log: error.log } : null),
        ...(error.logSnippet ? { logSnippet: error.logSnippet } : null),
        ...(error.logTruncated ? { logTruncated: true } : null),
        ...(typeof error.logLimitBytes === 'number' && error.logLimitBytes > 0
          ? { logLimitBytes: error.logLimitBytes }
          : null),
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
    const uploadedVersionedKeys: string[] = [];
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
      console.log(`[worker][latex] start jobId=${job.id} target=${payload.target} ${describePayloadScope(payload)}`);

      const shouldCompilePdf = payload.target !== TASK_SOLUTION_PDF_TARGET;
      const compiled = shouldCompilePdf ? await compileLatexToPdf(payload.tex) : null;
      const renderedHtml =
        payload.target === DEBUG_PDF_TARGET
          ? null
          : await renderLatexToHtml(payload.tex, storage);

      const renderAt = new Date();
      const pdfKey =
        payload.target === TASK_SOLUTION_PDF_TARGET
          ? null
          : payload.target === DEBUG_PDF_TARGET
            ? buildDebugPdfKey(payload.debugTarget, renderAt)
            : buildUnitPdfKey(payload.unitId, payload.target, renderAt);
      if (compiled && pdfKey) {
        await storage.putObject({
          key: pdfKey,
          contentType: 'application/pdf',
          body: compiled.pdfBytes,
          cacheControl: 'no-store',
        });
        uploadedVersionedKeys.push(pdfKey);
      }

      const htmlKey =
        payload.target === DEBUG_PDF_TARGET
          ? null
          : payload.target === TASK_SOLUTION_PDF_TARGET
            ? buildTaskSolutionHtmlKey(payload.taskId, payload.taskRevisionId, renderAt)
            : buildUnitHtmlKey(payload.unitId, payload.target, renderAt);
      if (htmlKey && renderedHtml) {
        await storage.putObject({
          key: htmlKey,
          contentType: 'text/html; charset=utf-8',
          body: renderedHtml.html,
          cacheControl: 'no-store',
        });
        uploadedVersionedKeys.push(htmlKey);
      }
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
        assetKey: payload.target === TASK_SOLUTION_PDF_TARGET ? (htmlKey ?? '') : (pdfKey ?? ''),
        sizeBytes:
          payload.target === TASK_SOLUTION_PDF_TARGET
            ? Math.max(1, Buffer.byteLength(renderedHtml?.html ?? '', 'utf8'))
            : Math.max(1, compiled?.pdfBytes.length ?? 0),
        ...((compiled?.logSnippet || renderedHtml?.logSnippet)
          ? {
              compileLogSnippet: [compiled?.logSnippet, renderedHtml?.logSnippet]
                .filter((item) => typeof item === 'string' && item.length > 0)
                .join('\n'),
            }
          : null),
      };
      const result: LatexCompileJobResult =
        payload.target === TASK_SOLUTION_PDF_TARGET
          ? ({
              ...baseResult,
              taskId: payload.taskId,
              taskRevisionId: payload.taskRevisionId,
              htmlAssets: renderedHtml?.assetRefs ?? [],
            } as TaskSolutionLatexCompileJobResult)
          : payload.target === DEBUG_PDF_TARGET
            ? ({
                ...baseResult,
                debugTarget: payload.debugTarget,
              } as DebugLatexCompileJobResult)
          : ({
              ...baseResult,
              unitId: payload.unitId,
              pdfAssetKey: pdfKey,
              htmlAssetKey: htmlKey ?? '',
              htmlAssets: renderedHtml?.assetRefs ?? [],
            } as UnitLatexCompileJobResult);

      if (payload.target !== DEBUG_PDF_TARGET) {
        const autoApplyResult = result as Exclude<LatexCompileJobResult, DebugLatexCompileJobResult>;
        await job.updateProgress({ autoApplyResult });
        const applyResult = await applyUnitPdfKeyViaApi(jobId, autoApplyResult);
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
          )}${applyResult.reason ? ` reason=${applyResult.reason}` : ''} ${describePayloadScope(payload)}`,
        );
      }

      console.log(
        `[worker][latex] success jobId=${job.id} target=${payload.target} bytes=${result.sizeBytes} ${describePayloadScope(payload)}`,
      );
      return result;
    } catch (error) {
      await Promise.all(
        uploadedVersionedKeys.map(async (key) => {
          try {
            await storage.deleteObject(key);
          } catch {
            // best-effort cleanup for partially uploaded versioned render artifacts
          }
        }),
      );
      const formatted = formatError(error);
      console.error(`[worker][latex] failed jobId=${job.id} error=${formatted.message}`);
      throw formatted;
    }
  };
};
