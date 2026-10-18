import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { AssessmentPackageTaskSchema, AttemptSaveSchema, SolutionPhotoMutationSchema, PublicAssessmentItemSchema } from '../src';

it('accepts the real extended task without server grading or invented criteria', () => {
  const task = JSON.parse(readFileSync(new URL('../../../examples/assessment-package/extended-v1/tasks/shkolkovo-14449/task.json', import.meta.url), 'utf8'));
  expect(AssessmentPackageTaskSchema.parse(task)).toMatchObject({ type: 'extended', maxPoints: 2, source: { externalId: '14449' } });
  expect(AssessmentPackageTaskSchema.safeParse({ ...task, grading: {} }).success).toBe(false);
  expect(AssessmentPackageTaskSchema.safeParse({ ...task, maxPoints: 0 }).success).toBe(false);
});
it('keeps photo answers separate from automatically graded answers and validates revisions', () => {
  expect(AttemptSaveSchema.safeParse({ requestId: crypto.randomUUID(), expectedRevision: 1, answer: { type: 'extended', photos: [] } }).success).toBe(false);
  expect(SolutionPhotoMutationSchema.parse({ revision: '0' })).toEqual({ revision: 0 });
  expect(SolutionPhotoMutationSchema.safeParse({ revision: -1 }).success).toBe(false);
  expect(SolutionPhotoMutationSchema.safeParse({ revision: 0, replaceId: '../other' }).success).toBe(false);
  expect(PublicAssessmentItemSchema.parse({ id: crypto.randomUUID(), title: 'Газ', statement: 'Условие', images: {}, maxPoints: 2, type: 'extended' })).not.toHaveProperty('grading');
});
