import { expect, it } from 'vitest';
import { AssessmentDuplicateHintsSchema } from '../src/contracts/assessment-bank';
const match = { target: { location: 'package', stableId: 'other', title: 'Другая задача', version: 1, source: { provider: 'Авторское' } }, reasons: ['statement'] };
it('validates bounded advisory matches with a typed comparison target', () => {
  const response = { status: 'complete', tasks: [{ stableId: 'incoming', matches: [match], hasMore: false }] };
  expect(AssessmentDuplicateHintsSchema.parse(response)).toEqual(response);
  expect(AssessmentDuplicateHintsSchema.safeParse({ ...response, tasks: [{ ...response.tasks[0], matches: Array(6).fill(match) }] }).success).toBe(false);
  expect(AssessmentDuplicateHintsSchema.safeParse({ ...response, tasks: [{ ...response.tasks[0], matches: [{ ...match, reasons: [] }] }] }).success).toBe(false);
  expect(AssessmentDuplicateHintsSchema.safeParse({ ...response, tasks: [{ ...response.tasks[0], matches: [{ ...match, target: { ...match.target, location: 'bank' } }] }] }).success).toBe(false);
  expect(AssessmentDuplicateHintsSchema.parse({ status: 'unavailable', tasks: [] }).status).toBe('unavailable');
});
