import { BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { compileLatexToPdfMock } = vi.hoisted(() => ({
  compileLatexToPdfMock: vi.fn(),
}));

vi.mock('@continuum/latex-runtime', async () => {
  const actual = await vi.importActual<typeof import('@continuum/latex-runtime')>(
    '@continuum/latex-runtime',
  );
  return {
    ...actual,
    compileLatexToPdf: compileLatexToPdfMock,
  };
});

import { LatexRuntimeError } from '@continuum/latex-runtime';
import { LatexCompileService } from '../src/infra/latex/latex-compile.service';

describe('LatexCompileService', () => {
  const service = new LatexCompileService();

  beforeEach(() => {
    vi.restoreAllMocks();
    compileLatexToPdfMock.mockReset();
  });

  it('returns compiled pdf bytes and log snippet on success', async () => {
    compileLatexToPdfMock.mockResolvedValue({
      bytes: Buffer.from('%PDF-1.4'),
      logSnippet: 'compile ok',
      logTruncated: false,
      logLimitBytes: 256_000,
    });

    await expect(
      service.compileToPdf('\\documentclass{article}\\begin{document}ok\\end{document}'),
    ).resolves.toEqual({
      pdfBytes: Buffer.from('%PDF-1.4'),
      logSnippet: 'compile ok',
    });
  });

  it('maps invalid input to BadRequestException', async () => {
    compileLatexToPdfMock.mockRejectedValue(
      new LatexRuntimeError('INVALID_LATEX_INPUT', 'tex must be a non-empty string'),
    );

    await expect(service.compileToPdf('   ')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps unsupported pdflatex source to ConflictException', async () => {
    compileLatexToPdfMock.mockRejectedValue(
      new LatexRuntimeError(
        'LATEX_COMPILE_FAILED',
        'LaTeX source is not compatible with pdflatex runtime policy: package "fontspec" is unsupported in pdflatex runtime',
        undefined,
        'package "fontspec" is unsupported',
      ),
    );

    await expect(
      service.compileToPdf(
        '\\documentclass{article}\n\\usepackage{fontspec}\n\\begin{document}ok\\end{document}',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'LATEX_COMPILE_FAILED',
        message:
          'LaTeX source is not compatible with pdflatex runtime policy: package "fontspec" is unsupported in pdflatex runtime',
      }),
    });
  });

  it('maps timeout to ConflictException preserving log snippet', async () => {
    compileLatexToPdfMock.mockRejectedValue(
      new LatexRuntimeError(
        'LATEX_COMPILE_TIMEOUT',
        'LaTeX compilation exceeded 1500ms',
        undefined,
        'still compiling...',
      ),
    );

    await expect(
      service.compileToPdf('\\documentclass{article}\n\\begin{document}slow\\end{document}'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'LATEX_COMPILE_TIMEOUT',
        message: 'LaTeX compilation exceeded 1500ms',
        logSnippet: 'still compiling...',
      }),
    });
  });

  it('maps missing runtime binary to InternalServerErrorException', async () => {
    compileLatexToPdfMock.mockRejectedValue(
      new LatexRuntimeError(
        'LATEX_RUNTIME_MISSING',
        'pdflatex binary is not available in runtime environment',
      ),
    );

    await expect(
      service.compileToPdf('\\documentclass{article}\n\\begin{document}ok\\end{document}'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });

  it('keeps unexpected crashes as InternalServerErrorException', async () => {
    compileLatexToPdfMock.mockRejectedValue(new Error('unexpected crash'));

    await expect(
      service.compileToPdf('\\documentclass{article}\n\\begin{document}ok\\end{document}'),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
