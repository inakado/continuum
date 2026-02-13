import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LATEX_MAX_SOURCE_LENGTH } from './latex-queue.contract';

const DEFAULT_TIMEOUT_MS = 120_000;
const OUTPUT_SNIPPET_LIMIT = 12_000;
const OUTPUT_CAPTURE_LIMIT = 48_000;

type CompileAttempt = {
  code: number | null;
  timedOut: boolean;
  logSnippet?: string;
};

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
    readonly logSnippet?: string,
  ) {
    super(message);
  }
}

export const compileLatexToPdf = async (texSource: string): Promise<LatexCompileResult> => {
  const tex = normalizeTex(texSource);
  const timeoutMs = resolveTimeoutMs();
  const tempDir = await fs.mkdtemp(join(tmpdir(), 'continuum-tex-worker-'));
  const texFilePath = join(tempDir, 'main.tex');
  const pdfPath = join(tempDir, 'main.pdf');

  try {
    let workingTex = tex;
    await fs.writeFile(texFilePath, workingTex, 'utf8');

    let attempt = await executeCompileAttempt({ cwd: tempDir, timeoutMs });
    if (!attempt.timedOut && attempt.code !== 0 && isT2AMetricError(attempt.logSnippet)) {
      const fallbackTex = buildUnicodeCyrillicFallback(workingTex);
      if (fallbackTex !== workingTex) {
        console.warn('[worker][latex] T2A metric font error detected; retrying with Unicode fallback');
        workingTex = fallbackTex;
        await fs.writeFile(texFilePath, workingTex, 'utf8');
        attempt = await executeCompileAttempt({ cwd: tempDir, timeoutMs });
      }
    }

    if (!attempt.timedOut && attempt.code !== 0 && isUnknownTikzColorError(attempt.logSnippet)) {
      const fallbackTex = buildXcolorNamesFallback(workingTex);
      if (fallbackTex !== workingTex) {
        console.warn('[worker][latex] Unknown TikZ color detected; retrying with xcolor fallback');
        workingTex = fallbackTex;
        await fs.writeFile(texFilePath, workingTex, 'utf8');
        attempt = await executeCompileAttempt({ cwd: tempDir, timeoutMs });
      }
    }

    if (attempt.timedOut) {
      throw new LatexCompileError(
        'LATEX_COMPILE_TIMEOUT',
        `LaTeX compilation exceeded ${timeoutMs}ms`,
        attempt.logSnippet,
      );
    }

    if (attempt.code !== 0) {
      throw new LatexCompileError('LATEX_COMPILE_FAILED', 'LaTeX compilation failed', attempt.logSnippet);
    }

    const pdfBytes = await fs.readFile(pdfPath);
    if (pdfBytes.length === 0) {
      throw new LatexCompileError('LATEX_COMPILE_FAILED', 'LaTeX compilation produced an empty PDF');
    }

    return { pdfBytes, ...(attempt.logSnippet ? { logSnippet: attempt.logSnippet } : null) };
  } catch (error) {
    if (error instanceof LatexCompileError) {
      throw error;
    }

    if ((error as { code?: string } | null)?.code === 'ENOENT') {
      throw new LatexCompileError(
        'LATEX_RUNTIME_MISSING',
        'tectonic binary is not available in worker runtime environment',
      );
    }

    if (error instanceof Error) {
      throw new LatexCompileError('LATEX_COMPILE_CRASHED', error.message);
    }

    throw new LatexCompileError('LATEX_COMPILE_CRASHED', 'Unknown compile error');
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

const normalizeTex = (texSource: string): string => {
  if (typeof texSource !== 'string' || !texSource.trim()) {
    throw new LatexCompileError('INVALID_LATEX_INPUT', 'tex must be a non-empty string');
  }

  if (texSource.length > LATEX_MAX_SOURCE_LENGTH) {
    throw new LatexCompileError(
      'LATEX_TOO_LARGE',
      `tex exceeds max length (${LATEX_MAX_SOURCE_LENGTH})`,
    );
  }

  return texSource;
};

const resolveTimeoutMs = (): number => {
  const raw = process.env.LATEX_COMPILE_TIMEOUT_MS;
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.floor(parsed);
};

const buildLogSnippet = (output: string): string | undefined => {
  const normalized = output.replace(/\u001b\[[0-9;]*m/g, '').trim();
  if (!normalized) return undefined;
  if (normalized.length <= OUTPUT_SNIPPET_LIMIT) return normalized;
  return `...${normalized.slice(-OUTPUT_SNIPPET_LIMIT)}`;
};

const executeCompileAttempt = async (params: {
  cwd: string;
  timeoutMs: number;
}): Promise<CompileAttempt> => {
  const raw = await runTectonic(params);
  return {
    code: raw.code,
    timedOut: raw.timedOut,
    logSnippet: buildLogSnippet(raw.combinedOutput),
  };
};

const runTectonic = (params: {
  cwd: string;
  timeoutMs: number;
}): Promise<{ code: number | null; combinedOutput: string; timedOut: boolean }> =>
  new Promise((resolve, reject) => {
    const child = spawn('tectonic', ['--outdir', params.cwd, '--keep-logs', '--keep-intermediates', 'main.tex'], {
      cwd: params.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let combinedOutput = '';
    const appendOutput = (chunk: Buffer | string) => {
      combinedOutput += chunk.toString();
      if (combinedOutput.length > OUTPUT_CAPTURE_LIMIT) {
        combinedOutput = combinedOutput.slice(-OUTPUT_CAPTURE_LIMIT);
      }
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

const isT2AMetricError = (logSnippet?: string): boolean => {
  if (!logSnippet) return false;
  return (
    /Font\s+T2A\/.+not loadable/i.test(logSnippet) ||
    /Metric\s+\(TFM\)\s+file\s+or\s+installed\s+font\s+not\s+found/i.test(logSnippet) ||
    /larm\d+\s+at\s+\d+(\.\d+)?pt\s+not\s+loadable/i.test(logSnippet)
  );
};

const isUnknownTikzColorError = (logSnippet?: string): boolean => {
  if (!logSnippet) return false;
  return (
    /Package\s+pgfkeys\s+Error:\s+I\s+do\s+not\s+know\s+the\s+key\s+'\/tikz\/[^']+'/i.test(logSnippet) ||
    /Package\s+xcolor\s+Error:\s+Undefined\s+color/i.test(logSnippet)
  );
};

const buildXcolorNamesFallback = (tex: string): string => {
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
};

const buildUnicodeCyrillicFallback = (tex: string): string => {
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
      const filteredPackages = packages.filter((pkg) => !encodingPackages.has(pkg.toLowerCase()));
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
};
