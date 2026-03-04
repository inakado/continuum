export type LatexRuntimeErrorCode =
  | "INVALID_LATEX_INPUT"
  | "LATEX_TOO_LARGE"
  | "LATEX_COMPILE_TIMEOUT"
  | "LATEX_COMPILE_FAILED"
  | "LATEX_RUNTIME_MISSING"
  | "LATEX_COMPILE_CRASHED";

export type LatexCompileLog = {
  log?: string;
  logSnippet?: string;
  logTruncated: boolean;
  logLimitBytes: number;
};

export type LatexCommandResult = {
  code: number | null;
  timedOut: boolean;
  output: string;
  outputTruncated: boolean;
};

export type LatexBinaryName = "pdflatex" | "dvisvgm" | "pandoc";

export type LatexCompiledArtifact = LatexCompileLog & {
  bytes: Buffer;
};

export type LatexCompileToPdfOptions = {
  timeoutMs?: number;
  logTailLimitBytes?: number;
  tempDirPrefix?: string;
};

export type LatexCompileToDviOptions = LatexCompileToPdfOptions;

export type DviToSvgOptions = {
  timeoutMs?: number;
  logTailLimitBytes?: number;
  tempDirPrefix?: string;
};

export type PdflatexIncompatibility = {
  kind: "package" | "command" | "toolchain";
  token: string;
  message: string;
};
