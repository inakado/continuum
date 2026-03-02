import { BadRequestException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fsMock } = vi.hoisted(() => ({
  fsMock: {
    mkdtemp: vi.fn(),
    writeFile: vi.fn(),
    readFile: vi.fn(),
    rm: vi.fn(),
  },
}));

vi.mock('node:fs', () => ({
  promises: fsMock,
}));

import { LatexCompileService } from '../src/infra/latex/latex-compile.service';

describe('LatexCompileService', () => {
  const service = new LatexCompileService();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();

    fsMock.mkdtemp.mockReset();
    fsMock.writeFile.mockReset();
    fsMock.readFile.mockReset();
    fsMock.rm.mockReset();

    fsMock.mkdtemp.mockResolvedValue('/tmp/continuum-tex-123');
    fsMock.writeFile.mockResolvedValue(undefined);
    fsMock.readFile.mockResolvedValue(Buffer.from('%PDF-1.4'));
    fsMock.rm.mockResolvedValue(undefined);
  });

  it('retries with Unicode fallback after T2A metric error and succeeds', async () => {
    const executeCompileAttempt = vi
      .spyOn(service as never, 'executeCompileAttempt')
      .mockResolvedValueOnce({
        code: 1,
        timedOut: false,
        logSnippet: 'Font T2A/lmr/m/n not loadable',
      })
      .mockResolvedValueOnce({
        code: 0,
        timedOut: false,
        logSnippet: 'fallback compile ok',
      });

    const result = await service.compileToPdf(
      '\\documentclass{article}\n\\usepackage[T2A]{fontenc}\n\\begin{document}Привет\\end{document}',
    );

    expect(result).toMatchObject({
      pdfBytes: Buffer.from('%PDF-1.4'),
      logSnippet: 'fallback compile ok',
    });
    expect(executeCompileAttempt).toHaveBeenCalledTimes(2);
    expect(fsMock.writeFile).toHaveBeenNthCalledWith(
      2,
      '/tmp/continuum-tex-123/main.tex',
      expect.stringContaining('\\usepackage{fontspec}'),
      'utf8',
    );
    expect(fsMock.rm).toHaveBeenCalledWith('/tmp/continuum-tex-123', {
      recursive: true,
      force: true,
    });
  });

  it('retries with xcolor names fallback after unknown TikZ color error and succeeds', async () => {
    vi.spyOn(service as never, 'executeCompileAttempt')
      .mockResolvedValueOnce({
        code: 1,
        timedOut: false,
        logSnippet: "Package pgfkeys Error: I do not know the key '/tikz/FooBar'",
      })
      .mockResolvedValueOnce({
        code: 0,
        timedOut: false,
        logSnippet: 'xcolor fallback compile ok',
      });

    const result = await service.compileToPdf(
      '\\documentclass{article}\n\\begin{document}ok\\end{document}',
    );

    expect(result.logSnippet).toBe('xcolor fallback compile ok');
    expect(fsMock.writeFile).toHaveBeenNthCalledWith(
      2,
      '/tmp/continuum-tex-123/main.tex',
      expect.stringContaining('\\PassOptionsToPackage{dvipsnames,svgnames,x11names}{xcolor}'),
      'utf8',
    );
  });

  it('returns LATEX_COMPILE_TIMEOUT with log snippet when tectonic exceeds timeout', async () => {
    vi.stubEnv('LATEX_COMPILE_TIMEOUT_MS', '1500');
    vi.spyOn(service as never, 'executeCompileAttempt').mockResolvedValue({
      code: null,
      timedOut: true,
      logSnippet: 'still compiling...',
    });

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

  it('keeps legacy T2A failure message when fallback does not change source', async () => {
    vi.spyOn(service as never, 'executeCompileAttempt').mockResolvedValue({
      code: 1,
      timedOut: false,
      logSnippet: 'Metric (TFM) file or installed font not found',
    });

    await expect(
      service.compileToPdf(
        '\\documentclass{article}\n\\usepackage{fontspec}\n\\defaultfontfeatures{Ligatures=TeX}\n\\setmainfont{Noto Serif}\n\\begin{document}ok\\end{document}',
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'LATEX_COMPILE_FAILED',
        message:
          'LaTeX compilation failed: legacy T2A fonts are unavailable in runtime. Remove cmap/fontenc/inputenc and use Unicode fontspec preamble.',
      }),
    });
  });

  it('rejects empty tex input before touching filesystem', async () => {
    await expect(service.compileToPdf('   ')).rejects.toBeInstanceOf(BadRequestException);
    expect(fsMock.mkdtemp).not.toHaveBeenCalled();
  });
});
