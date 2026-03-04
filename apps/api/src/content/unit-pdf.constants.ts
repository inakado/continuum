import { randomBytes } from 'node:crypto';

export type UnitPdfTarget = 'theory' | 'method';
export type TaskSolutionPdfTarget = 'task_solution';
export type DebugPdfTarget = 'debug_pdf';
export type LatexCompileTarget = UnitPdfTarget | TaskSolutionPdfTarget | DebugPdfTarget;
export type DebugPdfScope = UnitPdfTarget;
export type UnitHtmlAssetRef = {
  placeholder: string;
  assetKey: string;
  contentType: 'image/svg+xml';
};

export const UNIT_PDF_TARGETS: UnitPdfTarget[] = ['theory', 'method'];
export const TASK_SOLUTION_PDF_TARGET: TaskSolutionPdfTarget = 'task_solution';
export const DEBUG_PDF_TARGET: DebugPdfTarget = 'debug_pdf';

export const STUDENT_PDF_TTL_DEFAULT_SEC = 180;
export const TEACHER_PDF_TTL_DEFAULT_SEC = 600;
export const PDF_TTL_MAX_SEC = 3600;

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

export type DebugLatexCompileQueuePayload = LatexCompileQueuePayloadBase & {
  target: DebugPdfTarget;
  debugTarget: DebugPdfScope;
};

export type LatexCompileQueuePayload =
  | UnitLatexCompileQueuePayload
  | TaskSolutionLatexCompileQueuePayload
  | DebugLatexCompileQueuePayload;

export type LatexCompileJobError = {
  code: string;
  message: string;
  log?: string;
  logTruncated?: boolean;
  logLimitBytes?: number;
  logSnippet?: string;
};

type LatexCompileJobResultBase = {
  target: LatexCompileTarget;
  assetKey: string;
  sizeBytes: number;
  compileLogSnippet?: string;
};

export type UnitLatexCompileJobResult = LatexCompileJobResultBase & {
  unitId: string;
  target: UnitPdfTarget;
  pdfAssetKey: string;
  htmlAssetKey: string;
  htmlAssets: UnitHtmlAssetRef[];
};

export type TaskSolutionLatexCompileJobResult = LatexCompileJobResultBase & {
  taskId: string;
  taskRevisionId: string;
  target: TaskSolutionPdfTarget;
};

export type DebugLatexCompileJobResult = LatexCompileJobResultBase & {
  target: DebugPdfTarget;
  debugTarget: DebugPdfScope;
};

export type LatexCompileJobResult =
  | UnitLatexCompileJobResult
  | TaskSolutionLatexCompileJobResult
  | DebugLatexCompileJobResult;

export const buildUnitPdfKey = (unitId: string, target: UnitPdfTarget, at = new Date()): string => {
  const timestampMs = at.getTime();
  const suffix = randomBytes(4).toString('hex');
  return `units/${unitId}/${target}/${timestampMs}-${suffix}.pdf`;
};

export const buildUnitHtmlKey = (unitId: string, target: UnitPdfTarget, at = new Date()): string => {
  const timestampMs = at.getTime();
  const suffix = randomBytes(4).toString('hex');
  return `units/${unitId}/${target}/${timestampMs}-${suffix}.html`;
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

export const buildDebugPdfKey = (
  target: DebugPdfScope,
  at = new Date(),
): string => {
  const timestampMs = at.getTime();
  const suffix = randomBytes(4).toString('hex');
  return `units/debug/${target}/${timestampMs}-${suffix}.pdf`;
};

export const extractVersionedAssetKeyTimestampMs = (key: string): number | null => {
  const match = key.match(/\/(\d{13})-[a-f0-9]+\.(pdf|html)$/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

export const shouldApplyIncomingPdfKey = (
  currentKey: string | null | undefined,
  incomingKey: string,
): boolean => {
  const normalizedCurrentKey =
    typeof currentKey === 'string' && currentKey.trim() ? currentKey.trim() : null;
  if (!normalizedCurrentKey) return true;

  const currentTs = extractVersionedAssetKeyTimestampMs(normalizedCurrentKey);
  const incomingTs = extractVersionedAssetKeyTimestampMs(incomingKey);

  if (incomingTs === null) return false;
  if (currentTs === null) return true;
  return incomingTs > currentTs;
};

export const shouldApplyIncomingUnitRender = (
  currentPdfKey: string | null | undefined,
  currentHtmlKey: string | null | undefined,
  incomingPdfKey: string,
  incomingHtmlKey: string,
): boolean => {
  const baseline = currentPdfKey ?? currentHtmlKey ?? null;
  return shouldApplyIncomingPdfKey(baseline, incomingPdfKey)
    && shouldApplyIncomingPdfKey(baseline, incomingHtmlKey);
};
