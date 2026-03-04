import { type LatexCompileLog, type LatexRuntimeErrorCode } from "./types";

export class LatexRuntimeError extends Error {
  constructor(
    readonly code: LatexRuntimeErrorCode,
    message: string,
    readonly log?: string,
    readonly logSnippet?: string,
    readonly logTruncated: boolean = false,
    readonly logLimitBytes?: number,
  ) {
    super(message);
  }
}

export const toLatexCompileLog = (
  error: LatexRuntimeError,
): LatexCompileLog => ({
  ...(error.log ? { log: error.log } : null),
  ...(error.logSnippet ? { logSnippet: error.logSnippet } : null),
  logTruncated: error.logTruncated,
  logLimitBytes: error.logLimitBytes ?? 0,
});
