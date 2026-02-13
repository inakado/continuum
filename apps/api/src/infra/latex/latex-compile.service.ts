import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

type CompileResult = {
  pdfBytes: Buffer;
  logSnippet?: string;
};

type CompileAttempt = {
  code: number | null;
  timedOut: boolean;
  logSnippet?: string;
};

const MAX_TEX_LENGTH = 200_000;
const DEFAULT_TIMEOUT_MS = 120_000;
const OUTPUT_SNIPPET_LIMIT = 4_000;

@Injectable()
export class LatexCompileService {
  private readonly logger = new Logger(LatexCompileService.name);

  async compileToPdf(texSource: string): Promise<CompileResult> {
    const tex = this.normalizeTex(texSource);
    const timeoutMs = this.resolveTimeoutMs();
    const tempDir = await fs.mkdtemp(join(tmpdir(), 'continuum-tex-'));
    const texFilePath = join(tempDir, 'main.tex');
    const pdfPath = join(tempDir, 'main.pdf');

    try {
      const texBytes = Buffer.byteLength(tex, 'utf8');
      this.logger.log(`LaTeX compile started (texBytes=${texBytes}, timeoutMs=${timeoutMs})`);
      let workingTex = tex;
      await fs.writeFile(texFilePath, workingTex, 'utf8');

      let attempt = await this.executeCompileAttempt({ cwd: tempDir, timeoutMs });
      let unicodeFallbackApplied = false;
      let xcolorFallbackApplied = false;

      if (!attempt.timedOut && attempt.code !== 0 && this.isT2AMetricError(attempt.logSnippet)) {
        const fallbackTex = this.buildUnicodeCyrillicFallback(workingTex);
        if (fallbackTex !== workingTex) {
          unicodeFallbackApplied = true;
          this.logger.warn(
            'Detected T2A metric font error. Retrying with Unicode font fallback preamble.',
          );
          workingTex = fallbackTex;
          await fs.writeFile(texFilePath, workingTex, 'utf8');
          attempt = await this.executeCompileAttempt({ cwd: tempDir, timeoutMs });
        }
      }

      if (!attempt.timedOut && attempt.code !== 0 && this.isUnknownTikzColorError(attempt.logSnippet)) {
        const fallbackTex = this.buildXcolorNamesFallback(workingTex);
        if (fallbackTex !== workingTex) {
          xcolorFallbackApplied = true;
          this.logger.warn(
            'Detected unknown TikZ color key. Retrying with xcolor named color options.',
          );
          workingTex = fallbackTex;
          await fs.writeFile(texFilePath, fallbackTex, 'utf8');
          attempt = await this.executeCompileAttempt({ cwd: tempDir, timeoutMs });
        }
      }

      if (attempt.timedOut) {
        this.logger.error(
          `LaTeX compile timeout after ${timeoutMs}ms. ${this.formatSnippetForLog(attempt.logSnippet)}`,
        );
        throw new ConflictException({
          code: 'LATEX_COMPILE_TIMEOUT',
          message: `LaTeX compilation exceeded ${timeoutMs}ms`,
          ...(attempt.logSnippet ? { logSnippet: attempt.logSnippet } : null),
        });
      }

      if (attempt.code !== 0) {
        const isLegacyT2aFailure = this.isT2AMetricError(attempt.logSnippet);
        const errorMessage =
          isLegacyT2aFailure && !unicodeFallbackApplied
            ? 'LaTeX compilation failed: legacy T2A fonts are unavailable in runtime. Remove cmap/fontenc/inputenc and use Unicode fontspec preamble.'
            : 'LaTeX compilation failed';

        this.logger.error(
          `LaTeX compile failed with exit code ${attempt.code ?? 'null'}. ${this.formatSnippetForLog(attempt.logSnippet)}`,
        );
        throw new ConflictException({
          code: 'LATEX_COMPILE_FAILED',
          message: errorMessage,
          ...(attempt.logSnippet ? { logSnippet: attempt.logSnippet } : null),
        });
      }

      const pdfBytes = await fs.readFile(pdfPath);
      if (pdfBytes.length === 0) {
        this.logger.error('LaTeX compile produced empty PDF');
        throw new InternalServerErrorException('LaTeX compilation produced an empty PDF');
      }

      if (unicodeFallbackApplied || xcolorFallbackApplied) {
        this.logger.warn('LaTeX compile succeeded after compatibility fallback patch(es).');
      }
      this.logger.log(`LaTeX compile succeeded (pdfBytes=${pdfBytes.length})`);
      return { pdfBytes, ...(attempt.logSnippet ? { logSnippet: attempt.logSnippet } : null) };
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof ConflictException ||
        error instanceof InternalServerErrorException
      ) {
        if (error instanceof BadRequestException) {
          this.logger.warn(`LaTeX request rejected: ${this.errorMessage(error)}`);
        }
        throw error;
      }

      if ((error as { code?: string } | null)?.code === 'ENOENT') {
        this.logger.error('tectonic binary is missing in API runtime');
        throw new InternalServerErrorException(
          'tectonic binary is not available in API runtime environment',
        );
      }

      this.logger.error(`LaTeX compile crashed unexpectedly: ${this.errorMessage(error)}`);
      throw new InternalServerErrorException(
        `LaTeX compilation failed unexpectedly: ${this.errorMessage(error)}`,
      );
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  }

  private normalizeTex(texSource: string): string {
    if (typeof texSource !== 'string') {
      throw new BadRequestException({
        code: 'INVALID_LATEX_INPUT',
        message: 'tex must be a string',
      });
    }

    if (!texSource.trim()) {
      throw new BadRequestException({
        code: 'INVALID_LATEX_INPUT',
        message: 'tex must be a non-empty string',
      });
    }

    if (texSource.length > MAX_TEX_LENGTH) {
      throw new BadRequestException({
        code: 'LATEX_TOO_LARGE',
        message: `tex exceeds max length (${MAX_TEX_LENGTH})`,
      });
    }

    return texSource;
  }

  private resolveTimeoutMs(): number {
    const raw = process.env.LATEX_COMPILE_TIMEOUT_MS;
    if (!raw) return DEFAULT_TIMEOUT_MS;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
    return Math.floor(parsed);
  }

  private buildLogSnippet(output: string): string | undefined {
    const normalized = output.replace(/\u001b\[[0-9;]*m/g, '').trim();
    if (!normalized) return undefined;
    if (normalized.length <= OUTPUT_SNIPPET_LIMIT) return normalized;
    return `${normalized.slice(0, OUTPUT_SNIPPET_LIMIT)}...`;
  }

  private async executeCompileAttempt(params: {
    cwd: string;
    timeoutMs: number;
  }): Promise<CompileAttempt> {
    const raw = await this.runTectonic(params);
    return {
      code: raw.code,
      timedOut: raw.timedOut,
      logSnippet: this.buildLogSnippet(raw.combinedOutput),
    };
  }

  private isT2AMetricError(logSnippet?: string): boolean {
    if (!logSnippet) return false;
    return (
      /Font\s+T2A\/.+not loadable/i.test(logSnippet) ||
      /Metric\s+\(TFM\)\s+file\s+or\s+installed\s+font\s+not\s+found/i.test(logSnippet) ||
      /larm\d+\s+at\s+\d+(\.\d+)?pt\s+not\s+loadable/i.test(logSnippet)
    );
  }

  private isUnknownTikzColorError(logSnippet?: string): boolean {
    if (!logSnippet) return false;
    return (
      /Package\s+pgfkeys\s+Error:\s+I\s+do\s+not\s+know\s+the\s+key\s+'\/tikz\/[^']+'/i.test(
        logSnippet,
      ) || /Package\s+xcolor\s+Error:\s+Undefined\s+color/i.test(logSnippet)
    );
  }

  private buildXcolorNamesFallback(tex: string): string {
    const requiredNames = ['dvipsnames', 'svgnames', 'x11names'];
    const passOptionsPattern = /\\PassOptionsToPackage\{([^}]*)\}\{xcolor\}/;
    const existingPassOptions = tex.match(passOptionsPattern);

    if (existingPassOptions) {
      const existing = existingPassOptions[1]
        .split(',')
        .map((option) => option.trim())
        .filter(Boolean);
      const normalized = new Set(existing.map((option) => option.toLowerCase()));
      const missing = requiredNames.filter((option) => !normalized.has(option));
      if (missing.length === 0) return tex;

      const merged = [...existing, ...missing].join(',');
      return tex.replace(passOptionsPattern, `\\PassOptionsToPackage{${merged}}{xcolor}`);
    }

    const line = `\\PassOptionsToPackage{${requiredNames.join(',')}}{xcolor}\n`;
    const documentclassPattern = /(\\documentclass(?:\[[^\]]*])?\{[^}]+\}\s*)/;
    if (documentclassPattern.test(tex)) {
      return tex.replace(documentclassPattern, `$1\n${line}`);
    }
    return `${line}\n${tex}`;
  }

  private buildUnicodeCyrillicFallback(tex: string): string {
    let next = tex;
    let changed = false;

    const encodingPackages = new Set(['cmap', 'fontenc', 'inputenc']);
    const lines = next.split(/\r?\n/);
    const rewritten = lines
      .map((line) => {
        const usepackageMatch = line.match(
          /^(\s*\\usepackage\s*(?:\[[^\]]*])?\s*\{)([^}]+)(\}\s*(?:%.*)?)$/,
        );
        if (!usepackageMatch) return line;

        const [, prefix, packageListRaw, suffix] = usepackageMatch;
        const packages = packageListRaw
          .split(',')
          .map((pkg) => pkg.trim())
          .filter(Boolean);

        const filteredPackages = packages.filter(
          (pkg) => !encodingPackages.has(pkg.toLowerCase()),
        );

        if (filteredPackages.length === packages.length) return line;
        if (filteredPackages.length === 0) return '';
        return `${prefix}${filteredPackages.join(', ')}${suffix}`;
      })
      .filter((line) => line !== '');

    if (rewritten.length !== lines.length || rewritten.join('\n') !== next) {
      next = rewritten.join('\n');
      changed = true;
    }

    const replacedFontEncoding = next.replace(
      /\\fontencoding\s*\{\s*T2A\s*\}/g,
      '\\fontencoding{TU}',
    );
    if (replacedFontEncoding !== next) {
      next = replacedFontEncoding;
      changed = true;
    }

    const hasFontspec = /\\usepackage(?:\[[^\]]*])?\{fontspec\}/.test(next);
    const hasDefaultFontFeatures = /\\defaultfontfeatures(?:\[[^\]]*])?\{/.test(next);
    const hasSetMainFont = /\\setmainfont(?:\[[^\]]*])?\{[^}]+\}/.test(next);

    const injectLines: string[] = [];
    if (!hasFontspec) injectLines.push('\\usepackage{fontspec}');
    if (!hasDefaultFontFeatures) injectLines.push('\\defaultfontfeatures{Ligatures=TeX}');
    if (!hasSetMainFont) injectLines.push('\\setmainfont{DejaVu Serif}');

    if (injectLines.length > 0) {
      const block = `${injectLines.join('\n')}\n`;
      const documentclassPattern = /(\\documentclass(?:\[[^\]]*])?\{[^}]+\}\s*)/;
      if (documentclassPattern.test(next)) {
        next = next.replace(documentclassPattern, `$1\n${block}`);
      } else {
        next = `${block}\n${next}`;
      }
      changed = true;
    }

    return changed ? next : tex;
  }

  private runTectonic(params: {
    cwd: string;
    timeoutMs: number;
  }): Promise<{ code: number | null; combinedOutput: string; timedOut: boolean }> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        'tectonic',
        ['--outdir', params.cwd, '--keep-logs', '--keep-intermediates', 'main.tex'],
        {
          cwd: params.cwd,
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );

      let combinedOutput = '';
      const appendOutput = (chunk: Buffer | string) => {
        if (combinedOutput.length >= OUTPUT_SNIPPET_LIMIT * 2) return;
        combinedOutput += chunk.toString();
      };

      child.stdout.on('data', appendOutput);
      child.stderr.on('data', appendOutput);

      let timedOut = false;
      const timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill('SIGKILL');
      }, params.timeoutMs);

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        reject(error);
      });

      child.on('close', (code) => {
        clearTimeout(timeoutId);
        resolve({ code, combinedOutput, timedOut });
      });
    });
  }

  private errorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    return 'unknown error';
  }

  private formatSnippetForLog(snippet?: string): string {
    if (!snippet) return 'No tectonic output captured.';
    return `Tectonic output:\n${snippet}`;
  }
}
