import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import TeacherBankScreen from './TeacherBankScreen';

const state = vi.hoisted(() => ({ query: {} as Record<string, unknown> }));
vi.mock('@/components/ContinuumHeader', () => ({ default: () => null }));
vi.mock('@/components/assessment/AssessmentMarkdown', () => ({ default: ({ text }: { text: string }) => <div>{text}</div> }));
vi.mock('./use-teacher-bank', () => {
  const source = { provider: 'Школково', externalId: '11121', taskNumber: 86, sectionCode: '7.05', examYear: 2026, examTaskNumber: 7 };
  const tasks = ['Давление газа', 'Температура'].map((title, index) => ({ id: `task-${index}`, stableId: `sample-${index}`, title, source, version: 1, gradeBand: 'grade_10_11', topicPath: ['МКТ'], type: 'short_number', maxPoints: 1, excerpt: 'Условие задачи' }));
  return {
    useTeacherBank: (query: Record<string, unknown>) => { state.query = query; return { data: { tasks, total: 2, topics: ['МКТ'], pageSize: 50 }, isPending: false }; },
    useTeacherBankTask: (id: string) => ({ data: { id, version: 1, task: { ...tasks[id === 'task-1' ? 1 : 0], type: 'short_number', grading: { answer: '4.83', absoluteTolerance: 0 }, unit: 'Па' }, statement: 'Найдите давление.', solution: null, images: {} } }),
  };
});
afterEach(cleanup);
it('keeps source visible and separates collection, source section and EGE numbers', () => {
  render(<TeacherBankScreen />);
  const list = screen.getByRole('list', { name: 'Задания банка' });
  expect(within(list).getAllByText('Школково · № 11121')).toHaveLength(2);
  fireEvent.click(screen.getByText('Источник и сведения'));
  expect(screen.getByText('Номер в подборке')).toBeVisible();
  expect(screen.getByText('86')).toBeVisible();
  expect(screen.getByText('Раздел источника')).toBeVisible();
  expect(screen.getByText('7.05')).toBeVisible();
  expect(screen.getByText('Номер задания ЕГЭ')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Следующая' }));
  expect(screen.getByRole('heading', { name: 'Температура' })).toBeVisible();
});
it('passes grade and search filters to the server-state layer', () => {
  render(<TeacherBankScreen />);
  fireEvent.click(screen.getByRole('button', { name: '8 класс' }));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '11121' } });
  expect(state.query).toMatchObject({ gradeBand: 'grade_8', search: '11121', page: 1 });
});
it('expands the reading area without losing the selected task', () => {
  render(<TeacherBankScreen />);
  fireEvent.click(screen.getByRole('button', { name: 'Следующая' }));
  fireEvent.click(screen.getByRole('button', { name: 'Развернуть задание' }));
  expect(screen.getByRole('button', { name: 'Вернуть список' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('heading', { name: 'Температура' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Вернуть список' }));
  expect(screen.getByRole('heading', { name: 'Температура' })).toBeVisible();
});
