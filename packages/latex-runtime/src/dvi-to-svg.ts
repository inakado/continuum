import { promises as fs } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runLatexCommand, mapMissingBinaryError } from "./command-runner";
import { LatexRuntimeError } from "./errors";
import { buildCompileLog } from "./log-snippet";
import { resolveLatexLogTailLimitBytes, resolveLatexTimeoutMs } from "./policy";
import { type DviToSvgOptions } from "./types";

export type DviToSvgResult = {
  svg: string;
  log?: string;
  logSnippet?: string;
  logTruncated: boolean;
  logLimitBytes: number;
};

export const convertDviToSvg = async (
  dviBytes: Buffer,
  options?: DviToSvgOptions,
): Promise<DviToSvgResult> => {
  const timeoutMs = options?.timeoutMs ?? resolveLatexTimeoutMs();
  const logTailLimitBytes =
    options?.logTailLimitBytes ?? resolveLatexLogTailLimitBytes();
  const tempDir = await fs.mkdtemp(join(tmpdir(), options?.tempDirPrefix ?? "continuum-dvisvgm-"));
  const dviPath = join(tempDir, "main.dvi");
  const svgPath = join(tempDir, "main.svg");

  try {
    await fs.writeFile(dviPath, dviBytes);
    const result = await runLatexCommand(
      "dvisvgm",
      ["--exact-bbox", "--font-format=woff", "-o", svgPath, dviPath],
      tempDir,
      timeoutMs,
      logTailLimitBytes,
    );
    const compileLog = buildCompileLog({
      output: result.output,
      outputTruncated: result.outputTruncated,
      logTailLimitBytes,
    });

    if (result.timedOut) {
      throw new LatexRuntimeError(
        "LATEX_COMPILE_TIMEOUT",
        `dvisvgm exceeded ${timeoutMs}ms`,
        compileLog.log,
        compileLog.logSnippet,
        compileLog.logTruncated,
        compileLog.logLimitBytes,
      );
    }

    if (result.code !== 0) {
      throw new LatexRuntimeError(
        "LATEX_COMPILE_FAILED",
        "dvisvgm failed",
        compileLog.log,
        compileLog.logSnippet,
        compileLog.logTruncated,
        compileLog.logLimitBytes,
      );
    }

    return {
      svg: await fs.readFile(svgPath, "utf8"),
      ...(compileLog.log ? { log: compileLog.log } : null),
      ...(compileLog.logSnippet ? { logSnippet: compileLog.logSnippet } : null),
      logTruncated: compileLog.logTruncated,
      logLimitBytes: compileLog.logLimitBytes,
    };
  } catch (error) {
    const runtimeMissing = mapMissingBinaryError(error, "dvisvgm");
    if (runtimeMissing) {
      throw runtimeMissing;
    }
    if (error instanceof LatexRuntimeError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new LatexRuntimeError("LATEX_COMPILE_CRASHED", error.message);
    }
    throw new LatexRuntimeError("LATEX_COMPILE_CRASHED", "Unknown dvi conversion error");
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};
