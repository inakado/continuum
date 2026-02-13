import { randomBytes } from 'node:crypto';

export type UnitPdfTarget = 'theory' | 'method';

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
