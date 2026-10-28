import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { AssessmentBankQuery } from '@continuum/shared';
import WorkBankPicker from './WorkBankPicker';
import WorkBankFilters from './WorkBankFilters';
import BankFilters from '@/features/teacher-bank/BankFilters';
const fixture = vi.hoisted(() => ({ query: {} as AssessmentBankQuery }));
vi.mock('@/features/teacher-bank/BankTaskPreview', () => ({ default: () => <p>Условие</p> }));
vi.mock('@/features/teacher-bank/teacher-bank.api', () => ({ teacherBankApi: { view: vi.fn(async (id, version) => ({ id, version })) } }));
vi.mock('@/features/teacher-bank/use-teacher-bank', () => ({
  useTeacherBank: (query: AssessmentBankQuery) => {
    fixture.query = query;
    return { data: { tasks: query.exam === 'none' ? [] : [{ id: 'a', version: 2, title: 'Задача', topicPath: ['МКТ'], source: { provider: 'Школково' }, maxPoints: 1 }], total: query.exam === 'none' ? 0 : 51, topics: ['МКТ'], sources: ['Школково'] }, isPending: false };
  }, useTeacherBankTask: () => ({ data: {}, isPending: false }),
}));
afterEach(cleanup);
it.each([{ Filters: WorkBankFilters, topicLabel: 'Раздел или тема' }, { Filters: BankFilters, topicLabel: 'Раздел или тема' }])('keeps selected topic/source visible while facet options are reloading', ({ Filters }) => {
  const query: AssessmentBankQuery = { search: '', topic: 'Очень длинная тема для проверки отображения', source: 'Школково', page: 1 };
  render(<Filters query={query} topicPaths={[]} sources={[]} onChange={vi.fn()} />);
  expect(screen.getByRole('button', { name: query.topic })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Фильтры/ }));
  expect(screen.getByRole('combobox', { name: 'Источник' })).toHaveValue('Школково');
});
it('passes exam/source to bank queries, resets page and clears the source on a grade change', () => {
  render(<WorkBankPicker existing={[]} grade="grade_10_11" onClose={vi.fn()} onAdd={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
  expect(fixture.query.page).toBe(2);
  fireEvent.click(screen.getByRole('button', { name: /Фильтры/ }));
  fireEvent.change(screen.getByRole('combobox', { name: 'ЕГЭ / не ЕГЭ' }), { target: { value: 'ege' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Источник' }), { target: { value: 'Школково' } });
  fireEvent.click(screen.getByRole('button', { name: 'Показать задачи' }));
  expect(fixture.query).toMatchObject({ page: 1, exam: 'ege', source: 'Школково' });
  fireEvent.change(screen.getByRole('combobox', { name: 'Параллель' }), { target: { value: 'grade_8' } });
  expect(fixture.query).toMatchObject({ gradeBand: 'grade_8', exam: 'ege', source: undefined, topic: '' });
});
it('resets empty filters but keeps the chosen grade and pinned selection', async () => {
  const add = vi.fn();
  render(<WorkBankPicker existing={[]} grade="grade_8" onClose={vi.fn()} onAdd={add} />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Выбрать: Задача' }));
  fireEvent.click(screen.getByRole('button', { name: /Фильтры/ }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Источник' }), { target: { value: 'Школково' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'ЕГЭ / не ЕГЭ' }), { target: { value: 'none' } });
  fireEvent.click(screen.getByRole('button', { name: 'Показать задачи' }));
  fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
  expect(fixture.query).toEqual({ gradeBand: 'grade_8', search: '', topic: '', page: 1 });
  expect(screen.getByRole('checkbox', { name: 'Выбрать: Задача' })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Добавить в работу' }));
  await waitFor(() => expect(add).toHaveBeenCalledWith([{ id: 'a', version: 2 }]));
});
