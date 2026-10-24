import { expect, it } from 'vitest';
import { AssessmentPackageTaskSchema, AssessmentTaskSourceSchema } from '../src/contracts/assessment-package';
import { AssessmentTaskSummarySchema } from '../src/contracts/assessment-bank';

it('preserves legacy source JSON and classified metadata in bank/import summaries', () => {
  const legacy = { provider: 'Школково', examYear: 2026, examTaskNumber: 7 };
  expect(AssessmentTaskSourceSchema.parse(legacy)).toEqual(legacy);
  expect(AssessmentTaskSourceSchema.parse({ provider: 'Авторское' })).toEqual({ provider: 'Авторское' });
  const source = { ...legacy, exam: 'ege', kind: 'platform' };
  expect(AssessmentTaskSummarySchema.shape.source.parse(source)).toEqual(source);
});

it('validates explicit exam and source classification without guessing it from grading', () => {
  const valid = [
    { provider: 'Школково', kind: 'platform', exam: 'ege', examYear: 2026, examTaskNumber: 7 },
    { provider: 'Авторское', kind: 'original', exam: 'none' },
    { provider: 'Автор сборника', kind: 'taskbook', collection: 'Сборник задач', externalId: '123', exam: 'none' },
  ];
  for (const source of valid) expect(AssessmentTaskSourceSchema.parse(source)).toEqual(source);
  for (const source of [
    { provider: 'Авторское', exam: 'ege' },
    { provider: 'Школково', exam: 'ege', examYear: 2026 },
    { provider: 'Школково', exam: 'ege', examTaskNumber: 7 },
    { provider: 'Авторское', exam: 'none', examYear: 2026 },
    { provider: 'Авторское', exam: 'none', examTaskNumber: 7 },
    { provider: 'Автор', kind: 'taskbook' },
    { provider: 'Автор', kind: 'unknown' },
    { provider: 'Автор', exam: 'oge' },
  ]) expect(AssessmentTaskSourceSchema.safeParse(source).success).toBe(false);
  const task = { id: 'classified', title: 'Проверка', gradeBand: 'grade_10_11', topicPath: ['Физика'], maxPoints: 2, source: valid[1], type: 'multiple_choice', options: [{ id: 'a', content: 'А' }, { id: 'b', content: 'Б' }], grading: { correctOptionIds: ['a', 'b'], policy: 'ege_physics_multiple_choice_v1' } };
  expect(AssessmentPackageTaskSchema.safeParse(task).success).toBe(false);
  expect(AssessmentPackageTaskSchema.safeParse({ ...task, grading: { ...task.grading, policy: 'exact' } }).success).toBe(true);
  expect(AssessmentPackageTaskSchema.safeParse({ ...task, source: valid[0] }).success).toBe(true);
});
