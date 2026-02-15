import { randomBytes } from 'node:crypto';

export type UnitPdfTarget = 'theory' | 'method';
export type TaskSolutionPdfTarget = 'task_solution';
export type LatexCompileTarget = UnitPdfTarget | TaskSolutionPdfTarget;
export const TASK_SOLUTION_PDF_TARGET: TaskSolutionPdfTarget = 'task_solution';

export const LATEX_COMPILE_QUEUE_NAME = 'latex.compile';
export const LATEX_COMPILE_JOB_NAME = 'unit_pdf_compile';
export const LATEX_MAX_SOURCE_LENGTH = 200_000;

type LatexCompileQueuePayloadBase = {
  tex: string;
  requestedByUserId: string;
  requestedByRole: 'teacher';
  ttlSec: number;
};

export type UnitLatexCompileQueuePayload = LatexCompileQueuePayloadBase & {
  unitId: string;
  target: UnitPdfTarget;
};

export type TaskSolutionLatexCompileQueuePayload = LatexCompileQueuePayloadBase & {
  taskId: string;
  taskRevisionId: string;
  target: TaskSolutionPdfTarget;
};

export type LatexCompileQueuePayload =
  | UnitLatexCompileQueuePayload
  | TaskSolutionLatexCompileQueuePayload;

type LatexCompileJobResultBase = {
  target: LatexCompileTarget;
  assetKey: string;
  sizeBytes: number;
  compileLogSnippet?: string;
};

export type UnitLatexCompileJobResult = LatexCompileJobResultBase & {
  unitId: string;
  target: UnitPdfTarget;
};

export type TaskSolutionLatexCompileJobResult = LatexCompileJobResultBase & {
  taskId: string;
  taskRevisionId: string;
  target: TaskSolutionPdfTarget;
};

export type LatexCompileJobResult = UnitLatexCompileJobResult | TaskSolutionLatexCompileJobResult;

export const buildUnitPdfKey = (unitId: string, target: UnitPdfTarget, at = new Date()): string => {
  const timestampMs = at.getTime();
  const suffix = randomBytes(4).toString('hex');
  return `units/${unitId}/${target}/${timestampMs}-${suffix}.pdf`;
};

export const buildTaskSolutionPdfKey = (
  taskId: string,
  taskRevisionId: string,
  at = new Date(),
): string => {
  const timestampMs = at.getTime();
  const suffix = randomBytes(4).toString('hex');
  return `tasks/${taskId}/revisions/${taskRevisionId}/solution/${timestampMs}-${suffix}.pdf`;
};
