import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import type { AssessmentPackageTask } from '@continuum/shared';
import BankTaskPreview from './BankTaskPreview';
import { taskSourceDetails } from './task-source';

const base = { id: 'ege-test', title: 'Пример', gradeBand: 'grade_10_11' as const, topicPath: ['Магнитное поле'], source: { provider: 'Авторское' }, maxPoints: 2 };
const options = [{ id: 'one', content: 'Первый' }, { id: 'two', content: 'Второй' }];
const tasks: [AssessmentPackageTask, string, string][] = [
  [{ ...base, type: 'matching', rows: options, options, grading: { policy: 'ege_physics_matching_v1', matches: { one: 'one', two: 'two' } } }, 'Соответствие', 'ЕГЭ: соответствие · 0–2 балла'],
  [{ ...base, type: 'multiple_choice', options, grading: { policy: 'ege_physics_multiple_choice_v1', correctOptionIds: ['one', 'two'] } }, 'Несколько вариантов', 'ЕГЭ: выбор утверждений · 0–2 балла'],
];
afterEach(cleanup);
it('distinguishes explicit non-exam sources from unclassified legacy records', () => {
  expect(taskSourceDetails({ provider: 'Авторское', kind: 'original', exam: 'none' })).toEqual(expect.arrayContaining([['Классификация', 'Не ЕГЭ'], ['Вид источника', 'Авторское']]));
  expect(taskSourceDetails({ provider: 'Автор' })).toContainEqual(['Классификация', 'Не указана']);
  expect(taskSourceDetails({ provider: 'Школково', examYear: 2026, examTaskNumber: 7 })).toContainEqual(['Классификация', 'ЕГЭ']);
  expect(taskSourceDetails({ provider: 'Школково', examYear: 2026 })).toContainEqual(['Классификация', 'Не указана']);
});
it('shows book classification, title and number in existing source details', () => {
  const task: AssessmentPackageTask = { ...base, type: 'matching', rows: options, options, source: { provider: 'Автор сборника', kind: 'taskbook', exam: 'none', collection: 'Сборник задач по физике', externalId: '123' }, grading: { matches: { one: 'one', two: 'two' } } };
  render(<BankTaskPreview data={{ id: 'task', version: 1, task, statement: 'Условие.', images: {}, solution: null }} />);
  fireEvent.click(screen.getByText('Источник и сведения'));
  const details = screen.getByText('Источник и сведения').parentElement!;
  for (const text of ['Не ЕГЭ', 'Задачник', 'Название задачника', 'Автор сборника', 'Сборник задач по физике', '123']) expect(within(details).getByText(text)).toBeVisible();
});
it.each(tasks)('shows the task type and grading policy in existing metadata', (task, type, policy) => {
  const data = { id: 'task', version: 2, task, statement: 'Условие.', images: {}, solution: null };
  const view = render(<BankTaskPreview data={data} />);
  fireEvent.click(screen.getByText('Источник и сведения'));
  const details = screen.getByText('Источник и сведения').parentElement!;
  expect(within(details).getByText(type)).toBeVisible();
  expect(within(details).getByText(policy)).toBeVisible();
  view.rerender(<BankTaskPreview data={data} hideAnswers />);
  expect(screen.queryByText('Источник и сведения')).not.toBeInTheDocument();
  expect(screen.queryByText(policy)).not.toBeInTheDocument();
});
