const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_LOG_TAIL_LIMIT_BYTES = 256_000;
const MAX_LOG_TAIL_LIMIT_BYTES = 256_000;
const LATEX_MAX_SOURCE_LENGTH = 200_000;
const OUTPUT_SNIPPET_LIMIT = 12_000;
const LATEX_MAX_PDFLATEX_PASSES = 3;

const PDFLATEX_RERUN_PATTERNS = [
  /Rerun to get cross-references right/i,
  /Label\(s\) may have changed/i,
  /Table widths have changed/i,
];

export const latexRuntimePolicy = {
  DEFAULT_TIMEOUT_MS,
  DEFAULT_LOG_TAIL_LIMIT_BYTES,
  MAX_LOG_TAIL_LIMIT_BYTES,
  LATEX_MAX_SOURCE_LENGTH,
  OUTPUT_SNIPPET_LIMIT,
  LATEX_MAX_PDFLATEX_PASSES,
  PDFLATEX_RERUN_PATTERNS,
} as const;

export const resolveLatexTimeoutMs = (raw = process.env.LATEX_COMPILE_TIMEOUT_MS): number => {
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
  return Math.floor(parsed);
};

export const resolveLatexLogTailLimitBytes = (
  raw = process.env.LATEX_COMPILE_LOG_TAIL_BYTES,
): number => {
  if (!raw) return DEFAULT_LOG_TAIL_LIMIT_BYTES;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_LOG_TAIL_LIMIT_BYTES;
  return Math.min(Math.floor(parsed), MAX_LOG_TAIL_LIMIT_BYTES);
};

export const shouldRunPdflatexThirdPass = (log?: string): boolean => {
  if (!log) return false;
  return PDFLATEX_RERUN_PATTERNS.some((pattern) => pattern.test(log));
};
