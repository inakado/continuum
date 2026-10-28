import { useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { SelectionCheckbox } from './BulkActionBar';
import { ApiError } from '@/lib/api/client';
import { useBulkDelete } from './use-bulk-delete';
const items = [{ id: 'a' }, { id: 'b' }];
const remove = vi.fn(), restore = vi.fn();
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function Harness({ scope = 'one' }: { scope?: string }) {
  const bulk = useBulkDelete({ scope, items, queryKey: ['bulk-test'], remove: (items: { id: string }[]) => remove(items) as Promise<{ items: { id: string }[] }>, restore, label: item => item.id, title: 'Удалить выбранные?', description: 'Можно отменить.' });
  return <>{bulk.bar}{items.map(item => <SelectionCheckbox key={item.id} label={item.id} checked={bulk.ids.has(item.id)} onChange={() => bulk.toggle(item.id)} />)}{bulk.notices}{bulk.dialog}</>;
}
function setup() { const client = new QueryClient(); return render(<QueryClientProvider client={client}><Harness /></QueryClientProvider>); }
it('selects, confirms once, keeps selection on failure, and undoes the complete receipt with retry', async () => {
  remove.mockRejectedValueOnce(new ApiError(409, 'Конфликт')).mockResolvedValue({ items });
  restore.mockRejectedValueOnce(new ApiError(503, 'Нет сети')).mockResolvedValue({ items });
  setup(); fireEvent.click(screen.getByLabelText('a', { exact: true }));
  expect(screen.getByRole('checkbox', { name: 'Выбрать все на странице' })).toBePartiallyChecked();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Выбрать все на странице' }));
  fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
  expect(remove).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus());
  fireEvent.click(screen.getByRole('button', { name: 'Удалить (2)' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Конфликт');
  expect(screen.getByLabelText('a', { exact: true })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Удалить (2)' }));
  await screen.findByRole('region', { name: 'Удалено записей: 2' });
  expect(remove).toHaveBeenLastCalledWith(items);
  expect(screen.getByLabelText('a', { exact: true })).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Нет сети');
  fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Удалено записей: 2' })).not.toBeInTheDocument());
  expect(restore).toHaveBeenLastCalledWith({ items });
});
it('clears selection when scope changes and cancelling confirmation never deletes', async () => {
  const client = new QueryClient();
  const view = render(<QueryClientProvider client={client}><Harness /></QueryClientProvider>);
  fireEvent.click(screen.getByLabelText('a', { exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(remove).not.toHaveBeenCalled();
  view.rerender(<QueryClientProvider client={client}><Harness scope="two" /></QueryClientProvider>);
  expect(screen.getByLabelText('a', { exact: true })).not.toBeChecked();
  expect(screen.queryByRole('button', { name: 'Удалить' })).not.toBeInTheDocument();
  view.rerender(<QueryClientProvider client={client}><Harness /></QueryClientProvider>);
  expect(screen.getByLabelText('a', { exact: true })).not.toBeChecked();
});
it('returns focus to search when deletion removes the entire list', async () => {
  function EmptyHarness() {
    const [rows, setRows] = useState(items);
    const bulk = useBulkDelete({ scope: 'empty-test', items: rows, queryKey: ['empty-test'], label: item => item.id, title: 'Удалить выбранные?', description: 'Можно отменить.',
      remove: async targets => { setRows([]); return { items: targets }; }, restore: async receipt => { setRows(receipt.items); },
    });
    return <main><input type="search" aria-label="Поиск" />{rows.length > 0 && bulk.bar}{bulk.notices}{bulk.dialog}</main>;
  }
  render(<QueryClientProvider client={new QueryClient()}><EmptyHarness /></QueryClientProvider>);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Выбрать все на странице' }));
  fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
  fireEvent.click(screen.getByRole('button', { name: 'Удалить (2)' }));
  await screen.findByRole('region', { name: 'Удалено записей: 2' });
  await waitFor(() => expect(screen.getByRole('searchbox', { name: 'Поиск' })).toHaveFocus());
  fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Удалено записей: 2' })).not.toBeInTheDocument());
  expect(screen.getByRole('searchbox', { name: 'Поиск' })).toHaveFocus();
});
