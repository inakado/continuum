import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BankFilters from './BankFilters';

afterEach(cleanup);
const paths = [['Механика'], ['Механика', 'Кинематика', 'Баллистика'], ['Механика', 'Кинематика', 'Ускорение', 'Прямолинейное движение', 'Графики'], ['Электродинамика', 'Графики']];
const query = { search: '', topic: '', page: 1 };
it('browses without applying, selects the whole branch, and returns focus', async () => {
  const change = vi.fn(); render(<BankFilters query={query} topicPaths={paths} onChange={change} />);
  const trigger = screen.getByRole('button', { name: 'Все разделы и темы' });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByRole('button', { name: /^Механика/ }));
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: /^Кинематика/ })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Все задачи: Механика' }));
  expect(change).toHaveBeenCalledWith({ topicPath: ['Механика'], topic: '' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await waitFor(() => expect(trigger).toHaveFocus());
});
it('searches paths by several words and preserves identical labels under different parents', () => {
  const change = vi.fn(); render(<BankFilters query={query} topicPaths={paths} onChange={change} />);
  fireEvent.click(screen.getByRole('button', { name: 'Все разделы и темы' }));
  const search = screen.getByRole('searchbox', { name: 'Найти раздел или тему' });
  fireEvent.change(search, { target: { value: 'Графики' } });
  const list = screen.getByRole('list', { name: 'Найденные темы' });
  expect(within(list).getAllByRole('button')).toHaveLength(2);
  fireEvent.change(search, { target: { value: 'Механика графики' } });
  fireEvent.click(within(list).getByRole('button'));
  expect(change).toHaveBeenCalledWith({ topicPath: paths[2], topic: '' });
});
it('applies extra filters together, while closing discards an uncommitted draft', () => {
  const change = vi.fn(); render(<BankFilters query={{ ...query, topicPath: ['Механика'] }} topicPaths={paths} sources={['Школково']} onChange={change} />);
  fireEvent.click(screen.getByRole('button', { name: 'Фильтры' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'ЕГЭ / не ЕГЭ' }), { target: { value: 'ege' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Источник' }), { target: { value: 'Школково' } });
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Показать задачи' }));
  expect(change).toHaveBeenCalledWith({ type: undefined, exam: 'ege', source: 'Школково' });
  fireEvent.click(screen.getByRole('button', { name: 'Фильтры' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Источник' }), { target: { value: 'Школково' } });
  fireEvent.click(screen.getByRole('button', { name: 'Закрыть фильтр' }));
  fireEvent.click(screen.getByRole('button', { name: 'Фильтры' }));
  expect(screen.getByRole('combobox', { name: 'Источник' })).toHaveValue('');
});
