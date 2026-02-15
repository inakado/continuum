type ApplyCompileResultResponse = {
  ok: boolean;
  applied: boolean;
  reason?: string;
};

type ApplyResultUnitRequestBody = {
  unitId: string;
  target: 'theory' | 'method';
  assetKey: string;
  sizeBytes: number;
  compileLogSnippet?: string;
};

type ApplyResultTaskRequestBody = {
  taskId: string;
  taskRevisionId: string;
  target: 'task_solution';
  assetKey: string;
  sizeBytes: number;
  compileLogSnippet?: string;
};

type ApplyResultRequestBody = ApplyResultUnitRequestBody | ApplyResultTaskRequestBody;

const APPLY_ERROR_SNIPPET_LIMIT = 1200;
const APPLY_RETRY_COUNT = 8;
const APPLY_RETRY_DELAY_MS = 250;

const trimSnippet = (value: string): string =>
  value.length > APPLY_ERROR_SNIPPET_LIMIT ? `${value.slice(0, APPLY_ERROR_SNIPPET_LIMIT)}...` : value;

const normalizeBaseUrl = (value: string): string => value.replace(/\/+$/, '');

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const shouldRetryApply = (status: number, rawBody: string): boolean => {
  if (status !== 409) return false;
  if (!rawBody) return false;
  try {
    const parsed = JSON.parse(rawBody) as { code?: unknown };
    return parsed.code === 'LATEX_JOB_RESULT_INVALID';
  } catch {
    return false;
  }
};

export const applyUnitPdfKeyViaApi = async (
  jobId: string,
  result: ApplyResultRequestBody,
): Promise<ApplyCompileResultResponse> => {
  const apiBaseUrl = normalizeBaseUrl(process.env.API_INTERNAL_URL || 'http://api:3000');
  const internalToken = process.env.WORKER_INTERNAL_TOKEN || 'continuum-internal-dev';

  for (let attempt = 0; attempt <= APPLY_RETRY_COUNT; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${apiBaseUrl}/internal/latex/jobs/${encodeURIComponent(jobId)}/apply`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-internal-token': internalToken,
        },
        body: JSON.stringify(result),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Internal apply request failed';
      throw new Error(
        JSON.stringify({
          code: 'LATEX_APPLY_FAILED',
          message,
        }),
      );
    }

    const rawBody = await response.text();
    if (!response.ok) {
      if (attempt < APPLY_RETRY_COUNT && shouldRetryApply(response.status, rawBody)) {
        await sleep(APPLY_RETRY_DELAY_MS);
        continue;
      }

      throw new Error(
        JSON.stringify({
          code: 'LATEX_APPLY_FAILED',
          message: `Internal apply endpoint returned ${response.status}`,
          ...(rawBody ? { logSnippet: trimSnippet(rawBody) } : null),
        }),
      );
    }

    if (!rawBody) {
      return { ok: true, applied: true };
    }

    try {
      const parsed = JSON.parse(rawBody) as Partial<ApplyCompileResultResponse>;
      return {
        ok: parsed.ok === true,
        applied: parsed.applied === true,
        ...(typeof parsed.reason === 'string' && parsed.reason ? { reason: parsed.reason } : null),
      };
    } catch {
      return { ok: true, applied: true };
    }
  }

  throw new Error(
    JSON.stringify({
      code: 'LATEX_APPLY_FAILED',
      message: 'Internal apply retries exhausted',
    }),
  );
};
