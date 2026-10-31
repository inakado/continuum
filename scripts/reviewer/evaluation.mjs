import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(new URL('../../packages/shared/package.json', import.meta.url));
const { z } = require('zod');
export const rubricId = 'ege-physics-calculation-2-2026';
const finding = z.strictObject({ state: z.enum(['met', 'not_met', 'uncertain']), evidence: z.string().min(1).max(2000), comment: z.string().min(1).max(2000) });
export const EvaluationSchema = z.strictObject({
  version: z.literal(1), rubricId: z.literal(rubricId), solutionId: z.uuid(), sourceRevision: z.number().int().positive(),
  referenceId: z.string().min(1), statementSha256: z.string().regex(/^[a-f0-9]{64}$/), readable: z.boolean(),
  summary: z.string().min(1).max(2000), transcription: z.string().min(1).max(6000), advice: z.array(z.string().min(1).max(1500)).max(5),
  findings: z.strictObject({ laws: finding, notation: finding, math: finding, answer: finding, relevance: finding, progress: finding }),
});
export const statementHash = text => createHash('sha256').update(text.normalize('NFC').replace(/\r\n/g, '\n').trim()).digest('hex');
export function evaluateReview(value) {
  const review = EvaluationSchema.parse(value), f = review.findings;
  if (!review.readable || Object.values(f).some(item => item.state === 'uncertain')) return { points: null, needsHumanReview: true };
  if (f.laws.state !== 'met') return { points: 0, needsHumanReview: false };
  const full = ['notation', 'math', 'answer', 'relevance'].every(key => f[key].state === 'met');
  // ФИПИ-2026, с. 13: все законы -> ответ -> полнота; при неверном ответе нужен ход решения.
  return { points: full ? 2 : f.answer.state === 'met' || f.progress.state === 'met' ? 1 : 0, needsHumanReview: false };
}
export function bindReview(value, source, references) {
  const review = EvaluationSchema.parse(value);
  const reference = references.find(item => item.id === review.referenceId);
  if (!reference || source.maxPoints !== 2 || reference.maxPoints !== 2 || source.id !== review.solutionId || source.sourceRevision !== review.sourceRevision || statementHash(source.statement) !== review.statementSha256 || reference.statementSha256 !== review.statementSha256 || reference.source !== source.source) throw new Error('Разбор, эталон и полученное условие не совпадают. Перепроверка остановлена.');
  return { review, reference, decision: evaluateReview(review) };
}
