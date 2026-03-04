import { spawn } from "node:child_process";
import { LatexRuntimeError } from "./errors";
import { type LatexBinaryName, type LatexCommandResult } from "./types";

export const runLatexCommand = (
  command: LatexBinaryName,
  args: string[],
  cwd: string,
  timeoutMs: number,
  outputCaptureLimit: number,
): Promise<LatexCommandResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    let outputTruncated = false;
    const appendOutput = (chunk: Buffer | string) => {
      output += chunk.toString();
      if (output.length > outputCaptureLimit) {
        output = output.slice(-outputCaptureLimit);
        outputTruncated = true;
      }
    };

    child.stdout.on("data", appendOutput);
    child.stderr.on("data", appendOutput);

    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timeoutId);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeoutId);
      resolve({ code, timedOut, output, outputTruncated });
    });
  });

export const mapMissingBinaryError = (
  error: unknown,
  binaryName: LatexBinaryName,
): LatexRuntimeError | null => {
  if ((error as { code?: string } | null)?.code !== "ENOENT") {
    return null;
  }

  return new LatexRuntimeError(
    "LATEX_RUNTIME_MISSING",
    `${binaryName} binary is not available in runtime environment`,
  );
};
