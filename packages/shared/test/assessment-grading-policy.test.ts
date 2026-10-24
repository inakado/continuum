import { expect, it } from 'vitest';
import { AssessmentPackageTaskSchema } from '../src/contracts/assessment-package';

const base = { id: 'rules', title: 'Оценивание', gradeBand: 'grade_10_11', topicPath: ['Магнитное поле'], source: { provider: 'Авторское' }, maxPoints: 2 };
const options = ['1', '2', '3', '4', '5'].map((id) => ({ id, content: id }));
const matching = { ...base, type: 'matching', rows: options.slice(0, 2), options, grading: { matches: { 1: '2', 2: '2' } } };
const multiple = { ...base, type: 'multiple_choice', options, grading: { correctOptionIds: ['1', '2'] } };
it('preserves absent legacy policy without inserting defaults or changing stored grading', () => {
  expect(AssessmentPackageTaskSchema.parse(matching)).toEqual(matching);
  expect(AssessmentPackageTaskSchema.parse(multiple)).toEqual(multiple);
  expect(Object.hasOwn(AssessmentPackageTaskSchema.parse(matching).grading!, 'policy')).toBe(false);
});
it('accepts explicit exact or type-specific EGE policies and rejects incompatible bounds and rules', () => {
  for (const [item, policy] of [[matching, 'ege_physics_matching_v1'], [multiple, 'ege_physics_multiple_choice_v1']] as const) {
    const input = { ...item, grading: { ...item.grading, policy } };
    expect(AssessmentPackageTaskSchema.safeParse(input).success).toBe(true);
    expect(AssessmentPackageTaskSchema.safeParse({ ...item, grading: { ...item.grading, policy: 'exact' } }).success).toBe(true);
    expect(AssessmentPackageTaskSchema.safeParse({ ...input, maxPoints: 1 }).success).toBe(false);
    expect(AssessmentPackageTaskSchema.safeParse({ ...input, maxPoints: 3 }).success).toBe(false);
    expect(AssessmentPackageTaskSchema.safeParse({ ...input, grading: { ...item.grading, policy: 'unknown' } }).success).toBe(false);
  }
  expect(AssessmentPackageTaskSchema.safeParse({ ...matching, grading: { ...matching.grading, policy: 'ege_physics_multiple_choice_v1' } }).success).toBe(false);
  expect(AssessmentPackageTaskSchema.safeParse({ ...multiple, grading: { ...multiple.grading, policy: 'ege_physics_matching_v1' } }).success).toBe(false);
  expect(AssessmentPackageTaskSchema.safeParse({ ...matching, rows: options.slice(0, 3), grading: { policy: 'ege_physics_matching_v1', matches: { 1: '2', 2: '2', 3: '2' } } }).success).toBe(false);
  for (const correctOptionIds of [['1'], ['1', '2', '3', '4']]) expect(AssessmentPackageTaskSchema.safeParse({ ...multiple, grading: { policy: 'ege_physics_multiple_choice_v1', correctOptionIds } }).success).toBe(false);
});
