import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLatexCommand, mapMissingBinaryError } from "./command-runner";
import { LatexRuntimeError } from "./errors";
import { buildCompileLog } from "./log-snippet";
import { latexRuntimePolicy, resolveLatexLogTailLimitBytes, resolveLatexTimeoutMs, shouldRunPdflatexThirdPass } from "./policy";
import {
  assertPdflatexCompatible,
  buildXcolorNamesFallback,
  isUnknownTikzColorError,
  normalizeLatexSource,
} from "./pdflatex-compat";
import { ensurePdflatexDocumentEnvelope } from "./pdflatex-template";
import { type LatexCompiledArtifact, type LatexCompileToPdfOptions } from "./types";

type CompileAttempt = {
  code: number | null;
  timedOut: boolean;
  log?: string;
  logSnippet?: string;
  logTruncated: boolean;
  logLimitBytes: number;
};

const executePdflatexCompile = async ({
  cwd,
  timeoutMs,
  logTailLimitBytes,
  outputFormat,
}: {
  cwd: string;
  timeoutMs: number;
  logTailLimitBytes: number;
  outputFormat: "pdf" | "dvi";
}): Promise<CompileAttempt> => {
  const chunks: string[] = [];
  let anyOutputTruncated = false;
  let lastPassLog = "";

  const runPass = async (): Promise<{ code: number | null; timedOut: boolean; log: string }> => {
    const result = await runLatexCommand(
      "pdflatex",
      [
        "-interaction=nonstopmode",
        "-halt-on-error",
        "-file-line-error",
        ...(outputFormat === "dvi" ? ["-output-format=dvi"] : []),
        "-output-directory",
        cwd,
        "main.tex",
      ],
      cwd,
      timeoutMs,
      logTailLimitBytes,
    );
    anyOutputTruncated ||= result.outputTruncated;
    chunks.push(result.output);
    lastPassLog = result.output;
    return {
      code: result.code,
      timedOut: result.timedOut,
      log: result.output,
    };
  };

  const firstPass = await runPass();
  if (firstPass.timedOut || firstPass.code !== 0) {
    const compileLog = buildCompileLog({
      output: chunks.join("\n"),
      outputTruncated: anyOutputTruncated,
      logTailLimitBytes,
    });
    return {
      code: firstPass.code,
      timedOut: firstPass.timedOut,
      log: compileLog.log,
      logSnippet: compileLog.logSnippet,
      logTruncated: compileLog.logTruncated,
      logLimitBytes: compileLog.logLimitBytes,
    };
  }

  if (outputFormat === "dvi") {
    const compileLog = buildCompileLog({
      output: chunks.join("\n"),
      outputTruncated: anyOutputTruncated,
      logTailLimitBytes,
    });
    return {
      code: firstPass.code,
      timedOut: false,
      log: compileLog.log,
      logSnippet: compileLog.logSnippet,
      logTruncated: compileLog.logTruncated,
      logLimitBytes: compileLog.logLimitBytes,
    };
  }

  const secondPass = await runPass();
  if (secondPass.timedOut || secondPass.code !== 0) {
    const compileLog = buildCompileLog({
      output: chunks.join("\n"),
      outputTruncated: anyOutputTruncated,
      logTailLimitBytes,
    });
    return {
      code: secondPass.code,
      timedOut: secondPass.timedOut,
      log: compileLog.log,
      logSnippet: compileLog.logSnippet,
      logTruncated: compileLog.logTruncated,
      logLimitBytes: compileLog.logLimitBytes,
    };
  }

  if (
    latexRuntimePolicy.LATEX_MAX_PDFLATEX_PASSES >= 3 &&
    shouldRunPdflatexThirdPass(lastPassLog)
  ) {
    const thirdPass = await runPass();
    const compileLog = buildCompileLog({
      output: chunks.join("\n"),
      outputTruncated: anyOutputTruncated,
      logTailLimitBytes,
    });
    return {
      code: thirdPass.code,
      timedOut: thirdPass.timedOut,
      log: compileLog.log,
      logSnippet: compileLog.logSnippet,
      logTruncated: compileLog.logTruncated,
      logLimitBytes: compileLog.logLimitBytes,
    };
  }

  const compileLog = buildCompileLog({
    output: chunks.join("\n"),
    outputTruncated: anyOutputTruncated,
    logTailLimitBytes,
  });
  return {
    code: secondPass.code,
    timedOut: false,
    log: compileLog.log,
    logSnippet: compileLog.logSnippet,
    logTruncated: compileLog.logTruncated,
    logLimitBytes: compileLog.logLimitBytes,
  };
};

const compileLatexArtifact = async ({
  texSource,
  outputFormat,
  timeoutMs = resolveLatexTimeoutMs(),
  logTailLimitBytes = resolveLatexLogTailLimitBytes(),
  tempDirPrefix = outputFormat === "pdf"
    ? "continuum-pdflatex-"
    : "continuum-dvi-",
}: {
  texSource: string;
  outputFormat: "pdf" | "dvi";
  timeoutMs?: number;
  logTailLimitBytes?: number;
  tempDirPrefix?: string;
}): Promise<LatexCompiledArtifact> => {
  const normalized = normalizeLatexSource(texSource);
  const wrapped = ensurePdflatexDocumentEnvelope(normalized);
  assertPdflatexCompatible(wrapped);

  const tempDir = await fs.mkdtemp(join(tmpdir(), tempDirPrefix));
  const texFilePath = join(tempDir, "main.tex");
  const outputPath = join(tempDir, `main.${outputFormat}`);

  try {
    let workingTex = wrapped;
    await fs.writeFile(texFilePath, workingTex, "utf8");

    let attempt = await executePdflatexCompile({
      cwd: tempDir,
      timeoutMs,
      logTailLimitBytes,
      outputFormat,
    });

    if (!attempt.timedOut && attempt.code !== 0 && isUnknownTikzColorError(attempt.log)) {
      const fallbackTex = buildXcolorNamesFallback(workingTex);
      if (fallbackTex !== workingTex) {
        workingTex = fallbackTex;
        await fs.writeFile(texFilePath, workingTex, "utf8");
        attempt = await executePdflatexCompile({
          cwd: tempDir,
          timeoutMs,
          logTailLimitBytes,
          outputFormat,
        });
      }
    }

    if (attempt.timedOut) {
      throw new LatexRuntimeError(
        "LATEX_COMPILE_TIMEOUT",
        `LaTeX compilation exceeded ${timeoutMs}ms`,
        attempt.log,
        attempt.logSnippet,
        attempt.logTruncated,
        attempt.logLimitBytes,
      );
    }

    if (attempt.code !== 0) {
      throw new LatexRuntimeError(
        "LATEX_COMPILE_FAILED",
        "LaTeX compilation failed",
        attempt.log,
        attempt.logSnippet,
        attempt.logTruncated,
        attempt.logLimitBytes,
      );
    }

    const bytes = await fs.readFile(outputPath);
    if (bytes.length === 0) {
      throw new LatexRuntimeError(
        "LATEX_COMPILE_FAILED",
        `LaTeX compilation produced an empty ${outputFormat.toUpperCase()}`,
      );
    }

    return {
      bytes,
      ...(attempt.log ? { log: attempt.log } : null),
      ...(attempt.logSnippet ? { logSnippet: attempt.logSnippet } : null),
      logTruncated: attempt.logTruncated,
      logLimitBytes: attempt.logLimitBytes,
    };
  } catch (error) {
    const runtimeMissing = mapMissingBinaryError(error, "pdflatex");
    if (runtimeMissing) {
      throw runtimeMissing;
    }
    if (error instanceof LatexRuntimeError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new LatexRuntimeError("LATEX_COMPILE_CRASHED", error.message);
    }
    throw new LatexRuntimeError("LATEX_COMPILE_CRASHED", "Unknown compile error");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

export const compileLatexToPdf = async (
  texSource: string,
  options?: LatexCompileToPdfOptions,
): Promise<LatexCompiledArtifact> =>
  compileLatexArtifact({
    texSource,
    outputFormat: "pdf",
    timeoutMs: options?.timeoutMs,
    logTailLimitBytes: options?.logTailLimitBytes,
    tempDirPrefix: options?.tempDirPrefix,
  });

export const compileLatexToDvi = async (
  texSource: string,
  options?: LatexCompileToPdfOptions,
): Promise<LatexCompiledArtifact> =>
  compileLatexArtifact({
    texSource,
    outputFormat: "dvi",
    timeoutMs: options?.timeoutMs,
    logTailLimitBytes: options?.logTailLimitBytes,
    tempDirPrefix: options?.tempDirPrefix,
  });
