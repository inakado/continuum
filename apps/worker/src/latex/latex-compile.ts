import {
  compileLatexToPdf as compileLatexToPdfWithRuntime,
  LatexRuntimeError,
} from '@continuum/latex-runtime';

export type LatexCompileResult = {
  pdfBytes: Buffer;
  logSnippet?: string;
};

export class LatexCompileError extends Error {
  constructor(
    readonly code:
      | 'INVALID_LATEX_INPUT'
      | 'LATEX_TOO_LARGE'
      | 'LATEX_COMPILE_TIMEOUT'
      | 'LATEX_COMPILE_FAILED'
      | 'LATEX_RUNTIME_MISSING'
      | 'LATEX_COMPILE_CRASHED',
    message: string,
    readonly log?: string,
    readonly logSnippet?: string,
    readonly logTruncated: boolean = false,
    readonly logLimitBytes?: number,
  ) {
    super(message);
  }
}

export const compileLatexToPdf = async (texSource: string): Promise<LatexCompileResult> => {
  try {
    const result = await compileLatexToPdfWithRuntime(texSource);
    return {
      pdfBytes: result.bytes,
      ...(result.logSnippet ? { logSnippet: result.logSnippet } : null),
    };
  } catch (error) {
    if (error instanceof LatexRuntimeError) {
      throw new LatexCompileError(
        error.code,
        error.message,
        error.log,
        error.logSnippet,
        error.logTruncated,
        error.logLimitBytes,
      );
    }

    if (error instanceof Error) {
      throw new LatexCompileError('LATEX_COMPILE_CRASHED', error.message);
    }

    throw new LatexCompileError('LATEX_COMPILE_CRASHED', 'Unknown compile error');
  }
};
