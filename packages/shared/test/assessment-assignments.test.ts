import { expect, it } from 'vitest';
import { AssignmentCreateSchema, AssignmentRevokeSchema, PublicAssessmentItemSchema, AttemptSaveSchema, WorkProgressSchema } from '../src/contracts/assessment-assignments';

const uuid = '00000000-0000-4000-8000-000000000001';
it('requires explicit progress rather than silently converting missing counters into zeros', () => {
  expect(WorkProgressSchema.parse({ photoTaskCount: 0, publishedReviewTaskCount: 0, resultReady: false })).toEqual({ photoTaskCount: 0, publishedReviewTaskCount: 0, resultReady: false });
  for (const input of [{}, { photoTaskCount: 1, resultReady: true }, { photoTaskCount: -1, publishedReviewTaskCount: 0, resultReady: false }]) expect(WorkProgressSchema.safeParse(input).success).toBe(false);
});
it('requires an exact recipient snapshot and rejects broad or client-selected deletion scopes', () => {
  expect(AssignmentRevokeSchema.parse({ expectedRecipientsHash: 'a'.repeat(64) })).toEqual({ expectedRecipientsHash: 'a'.repeat(64) });
  for (const input of [{}, { expectedRecipientsHash: 'wrong' }, { expectedRecipientsHash: 'a'.repeat(64), deleteAll: true }, { expectedRecipientsHash: 'a'.repeat(64), classId: uuid }]) expect(AssignmentRevokeSchema.safeParse(input).success).toBe(false);
});
it('validates distinct class selections and freezes only a named draft revision or saved version', () => {
  const input = { requestId: uuid, selection: { kind: 'draft', expectedRevision: 3 }, classes: [{ id: uuid, rosterHash: 'a'.repeat(64) }] };
  expect(AssignmentCreateSchema.parse(input)).toEqual(input);
  expect(AssignmentCreateSchema.safeParse({ ...input, classes: [...input.classes, ...input.classes] }).success).toBe(false);
  expect(AssignmentCreateSchema.safeParse({ ...input, selection: { kind: 'version', number: 0 } }).success).toBe(false);
  expect(AssignmentCreateSchema.safeParse({ ...input, deadline: '2026-10-18' }).success).toBe(false);
});
it('does not accept keys, source metadata or solutions in a public task', () => {
  const item = { id: uuid, title: 'Температура', type: 'short_number', statement: 'Условие', maxPoints: 1, images: {}, unit: 'К' };
  expect(PublicAssessmentItemSchema.parse(item)).toEqual(item);
  for (const extra of [{ grading: { answer: '42' } }, { source: { provider: 'Закрытый источник' } }, { solution: '42' }]) {
    expect(PublicAssessmentItemSchema.safeParse({ ...item, ...extra }).success).toBe(false);
  }
});
it('accepts partial saved responses without allowing a client-supplied score', () => {
  const input = { requestId: uuid, expectedRevision: 1, answer: { type: 'matching', matches: { a: 'x' } } };
  expect(AttemptSaveSchema.parse(input)).toEqual(input);
  expect(AttemptSaveSchema.safeParse({ ...input, points: 2 }).success).toBe(false);
  expect(AttemptSaveSchema.safeParse({ ...input, answer: { type: 'multiple_choice', optionIds: ['a', 'a'] } }).success).toBe(false);
});

it('rejects answer keys before completion and exposes only a minimal canonical answer afterwards', async () => {
  const { StudentAttemptStateSchema, StudentAnswerKeySchema } = await import('../src/contracts/assessment-assignments');
  const state = { revision: 2, status: 'in_progress', answeredCount: 1, startedAt: '2026-10-31T00:00:00Z', completedAt: null, result: null };
  const keys = [{type:'short_number',value:'-12'}, {type:'short_text',value:'сила'}, {type:'single_choice',optionId:'a'}, {type:'multiple_choice',optionIds:['a','b']}, {type:'matching',matches:{a:'one'}}];
  for (const key of keys) {
    expect(StudentAnswerKeySchema.parse(key)).toEqual(key);
    expect(StudentAttemptStateSchema.safeParse({...state,answerKeys:{[uuid]:key}}).success).toBe(false);
    expect(StudentAttemptStateSchema.parse({...state,status:'completed',completedAt:'2026-10-31T00:01:00Z',answerKeys:{[uuid]:key}}).answerKeys?.[uuid]).toEqual(key);
  }
  expect(StudentAnswerKeySchema.safeParse({type:'short_text',value:'сила',acceptedAnswers:['сила'],solution:'private'}).success).toBe(false);
});
