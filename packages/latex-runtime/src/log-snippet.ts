import { latexRuntimePolicy } from "./policy";
import { type LatexCompileLog } from "./types";

export const stripAnsi = (value: string): string =>
  value.replace(/\u001b\[[0-9;]*m/g, "");

export const buildCompileLog = ({
  output,
  outputTruncated,
  logTailLimitBytes,
}: {
  output: string;
  outputTruncated: boolean;
  logTailLimitBytes: number;
}): LatexCompileLog => {
  const normalized = stripAnsi(output).trim();
  if (!normalized) {
    return {
      logTruncated: outputTruncated,
      logLimitBytes: logTailLimitBytes,
    };
  }

  const fullLog =
    normalized.length > logTailLimitBytes
      ? normalized.slice(-logTailLimitBytes)
      : normalized;
  const snippetLimit = Math.min(
    latexRuntimePolicy.OUTPUT_SNIPPET_LIMIT,
    logTailLimitBytes,
  );
  const logSnippet =
    fullLog.length <= snippetLimit ? fullLog : `...${fullLog.slice(-snippetLimit)}`;

  return {
    log: fullLog,
    logSnippet,
    logTruncated: outputTruncated || normalized.length > logTailLimitBytes,
    logLimitBytes: logTailLimitBytes,
  };
};

export const summarizeLatexOutput = (chunks: string[]): string | undefined => {
  const normalized = chunks.map((chunk) => stripAnsi(chunk).trim()).filter(Boolean).join("\n");
  if (!normalized) return undefined;
  return normalized.length <= latexRuntimePolicy.OUTPUT_SNIPPET_LIMIT
    ? normalized
    : `...${normalized.slice(-latexRuntimePolicy.OUTPUT_SNIPPET_LIMIT)}`;
};
