import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BankWorkspaceFilters from './BankWorkspaceFilters';
import { uploadDateFilter } from './upload-date';

afterEach(cleanup);
const query = { search: '', topic: '', page: 1 };

it('applies date and extra filters together and discards a closed draft', () => {
  const change = vi.fn();
  render(<BankWorkspaceFilters query={query} paths={[]} sources={['Школково']} onChange={change} />);
  fireEvent.click(screen.getByRole('button', { name: 'Фильтры' }));
  fireEvent.change(screen.getByLabelText('Дата загрузки'), { target: { value: '2026-11-13' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Источник' }), { target: { value: 'Школково' } });
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Показать задачи' }));
  expect(change).toHaveBeenCalledWith({ ...uploadDateFilter('2026-11-13'), source: 'Школково', type: undefined, exam: undefined });
  fireEvent.click(screen.getByRole('button', { name: 'Фильтры' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Тип задания' }), { target: { value: 'extended' } });
  fireEvent.click(screen.getByRole('button', { name: 'Закрыть фильтр' }));
  fireEvent.click(screen.getByRole('button', { name: 'Фильтры' }));
  expect(screen.getByRole('combobox', { name: 'Тип задания' })).toHaveValue('');
});

it('clears only the requested topic or date while retaining unrelated filters', () => {
  const change = vi.fn();
  render(<BankWorkspaceFilters query={{ ...query, ...uploadDateFilter('2026-11-13'), topicPath: ['Механика'], source: 'Школково' }} paths={[]} sources={[]} onChange={change} />);
  fireEvent.click(screen.getByRole('button', { name: 'Сбросить Механика' }));
  expect(change).toHaveBeenLastCalledWith({ topicPath: undefined, topic: '' });
  fireEvent.click(screen.getByRole('button', { name: 'Сбросить 13.11.2026' }));
  expect(change).toHaveBeenLastCalledWith(uploadDateFilter(''));
});
