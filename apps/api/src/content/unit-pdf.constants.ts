import { randomBytes } from 'node:crypto';

export type UnitPdfTarget = 'theory' | 'method';

export const UNIT_PDF_TARGETS: UnitPdfTarget[] = ['theory', 'method'];

export const STUDENT_PDF_TTL_DEFAULT_SEC = 180;
export const TEACHER_PDF_TTL_DEFAULT_SEC = 600;
export const PDF_TTL_MAX_SEC = 3600;

export const LATEX_COMPILE_QUEUE_NAME = 'latex.compile';
export const LATEX_COMPILE_JOB_NAME = 'unit_pdf_compile';
export const LATEX_MAX_SOURCE_LENGTH = 200_000;

export type LatexCompileQueuePayload = {
  unitId: string;
  target: UnitPdfTarget;
  tex: string;
  requestedByUserId: string;
  requestedByRole: 'teacher';
  ttlSec: number;
};

export type LatexCompileJobResult = {
  unitId: string;
  target: UnitPdfTarget;
  assetKey: string;
  sizeBytes: number;
  compileLogSnippet?: string;
};

export const buildUnitPdfKey = (unitId: string, target: UnitPdfTarget, at = new Date()): string => {
  const timestampMs = at.getTime();
  const suffix = randomBytes(4).toString('hex');
  return `units/${unitId}/${target}/${timestampMs}-${suffix}.pdf`;
};

export const extractUnitPdfKeyTimestampMs = (key: string): number | null => {
  const match = key.match(/\/(\d{13})-[a-f0-9]+\.pdf$/i);
  if (!match) return null;
  const parsed = Number(match[1]);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

export const shouldApplyIncomingUnitPdfKey = (
  currentKey: string | null,
  incomingKey: string,
): boolean => {
  if (!currentKey) return true;

  const currentTs = extractUnitPdfKeyTimestampMs(currentKey);
  const incomingTs = extractUnitPdfKeyTimestampMs(incomingKey);

  if (incomingTs === null) return false;
  if (currentTs === null) return true;
  return incomingTs > currentTs;
};
