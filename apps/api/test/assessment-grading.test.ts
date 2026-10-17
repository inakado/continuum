import { expect, it } from 'vitest';
import type { AssessmentPackageTask } from '@continuum/shared';
import { gradeAssessmentAnswer } from '../src/assessment-assignments/assessment-grading';

const common = { id: 'test', title: 'Задание', gradeBand: 'grade_10_11' as const, topicPath: ['МКТ'], source: { provider: 'Авторское' }, maxPoints: 2 };
it('compares decimals exactly, accepts a comma/exponent, and applies the declared absolute tolerance', () => {
  const task: AssessmentPackageTask = { ...common, type: 'short_number', grading: { answer: '9007199254740993', absoluteTolerance: 0 } };
  expect(gradeAssessmentAnswer(task, { type: 'short_number', value: '9007199254740992' })).toBe(0);
  expect(gradeAssessmentAnswer(task, { type: 'short_number', value: '9007199254740993' })).toBe(2);
  const decimal: AssessmentPackageTask = { ...common, type: 'short_number', grading: { answer: '0.3', absoluteTolerance: 0.1 } };
  expect(gradeAssessmentAnswer(decimal, { type: 'short_number', value: '4e-1' })).toBe(2);
  expect(gradeAssessmentAnswer(decimal, { type: 'short_number', value: '0,40000000000000001' })).toBe(0);
  expect(gradeAssessmentAnswer(decimal, { type: 'short_number', value: 'Infinity' })).toBe(0);
});
it('normalizes text using NFC, edge whitespace and the declared case policy, without merging е and ё', () => {
  const task: AssessmentPackageTask = { ...common, type: 'short_text', grading: { acceptedAnswers: ['Ёлка'], caseSensitive: false } };
  expect(gradeAssessmentAnswer(task, { type: 'short_text', value: '  Е\u0308ЛКА ' })).toBe(2);
  expect(gradeAssessmentAnswer(task, { type: 'short_text', value: 'елка' })).toBe(0);
  expect(gradeAssessmentAnswer({ ...task, grading: { ...task.grading, caseSensitive: true } }, { type: 'short_text', value: 'ёлка' })).toBe(0);
});
it('awards all points only for the complete choice set and matching, with repeated matching options allowed', () => {
  const options = [{ id: 'x', content: 'Первый' }, { id: 'y', content: 'Второй' }];
  const multiple: AssessmentPackageTask = { ...common, type: 'multiple_choice', options, grading: { correctOptionIds: ['x', 'y'] } };
  expect(gradeAssessmentAnswer(multiple, { type: 'multiple_choice', optionIds: ['y', 'x'] })).toBe(2);
  expect(gradeAssessmentAnswer(multiple, { type: 'multiple_choice', optionIds: ['x'] })).toBe(0);
  const matching: AssessmentPackageTask = { ...common, type: 'matching', rows: options, options, grading: { matches: { x: 'y', y: 'y' } } };
  expect(gradeAssessmentAnswer(matching, { type: 'matching', matches: { x: 'y', y: 'y' } })).toBe(2);
  expect(gradeAssessmentAnswer(matching, { type: 'matching', matches: { x: 'y' } })).toBe(0);
  expect(gradeAssessmentAnswer(matching, null)).toBe(0);
  expect(gradeAssessmentAnswer({ ...common, type: 'single_choice', options, grading: { correctOptionId: 'x' } }, { type: 'single_choice', optionId: 'x' })).toBe(2);
});
