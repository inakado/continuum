import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BankImportPanel from './BankImportPanel';
const api = vi.hoisted(() => ({ upload: vi.fn(), refetch: vi.fn(), confirm: vi.fn(), discard: vi.fn(), checking: false, readable: false }));
vi.mock('./BankTaskPreview', () => ({ default: ({ data }: { data: { task: { title: string } } }) => <h2>{data.task.title}</h2> }));
vi.mock('./teacher-bank.api', () => ({ teacherBankApi: { discard: api.discard } }));
vi.mock('./use-teacher-bank', () => ({
  usePreviewBankImport: () => ({ isPending: false, mutateAsync: api.upload }),
  useConfirmBankImport: () => ({ isPending: false, data: null, reset: vi.fn(), mutateAsync: api.confirm }),
  useBankImportTask: (_id: string, selected: string) => api.readable
    ? { isPending: false, data: { task: { title: `Условие ${selected}` } }, refetch: api.refetch }
    : { isPending: false, error: new Error('Ошибка условия'), refetch: api.refetch },
  useBankDuplicateHints: () => ({ isPending: api.checking, data: { status: 'complete', tasks: [] } }),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); api.checking = false; api.readable = false; });
it('retries the preview condition without uploading or confirming the ZIP again', async () => {
  api.upload.mockResolvedValue({ id: 'preview', title: 'Пакет', issues: [], items: [{ stableId: 'sample', title: 'Задача', source: { provider: 'Авторское' }, status: 'new', version: 1 }] });
  const view = render(<BankImportPanel onClose={vi.fn()} />);
  const input = view.container.querySelector('input[type="file"]')!;
  fireEvent.change(input, { target: { files: [new File(['zip'], 'tasks.zip', { type: 'application/zip' })] } });
  const retry = await screen.findByRole('button', { name: 'Повторить загрузку условия' });
  fireEvent.click(retry);
  await waitFor(() => expect(api.refetch).toHaveBeenCalledTimes(1));
  expect(api.upload).toHaveBeenCalledTimes(1);
  expect(api.confirm).not.toHaveBeenCalled(); expect(api.discard).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: /Задача/ })).toHaveAttribute('aria-pressed', 'true');
});
it('allows confirming while duplicate hints are still loading', async () => {
  api.checking = true;
  api.upload.mockResolvedValue({ id: 'preview', title: 'Пакет', issues: [], items: [{ stableId: 'sample', title: 'Задача', source: { provider: 'Авторское' }, status: 'new', version: 1 }] });
  const view = render(<BankImportPanel onClose={vi.fn()} />);
  fireEvent.change(view.container.querySelector('input[type="file"]')!, { target: { files: [new File(['zip'], 'tasks.zip')] } });
  const add = await screen.findByRole('button', { name: 'Добавить в банк' });
  expect(add).toBeEnabled();
  fireEvent.click(add);
  await waitFor(() => expect(api.confirm).toHaveBeenCalledWith('preview'));
});
it('preserves the list position and resets only the condition when another task is selected', async () => {
  api.readable = true;
  api.upload.mockResolvedValue({ id: 'preview', title: 'Пакет', issues: [], items: ['one', 'two'].map((stableId) => ({ stableId, title: `Задача ${stableId}`, source: { provider: 'Авторское' }, status: 'new', version: 1 })) });
  const view = render(<BankImportPanel onClose={vi.fn()} />);
  fireEvent.change(view.container.querySelector('input[type="file"]')!, { target: { files: [new File(['zip'], 'tasks.zip')] } });
  await screen.findByRole('heading', { name: 'Условие one' });
  const list = screen.getByRole('list', { name: 'Задания пакета' });
  const condition = screen.getByRole('region', { name: 'Условие выбранного задания' });
  list.scrollTop = 200;
  condition.scrollTop = 120;
  fireEvent.click(screen.getByRole('button', { name: /Задача two/ }));
  await screen.findByRole('heading', { name: 'Условие two' });
  expect(screen.getByRole('list', { name: 'Задания пакета' })).toBe(list);
  expect(list.scrollTop).toBe(200);
  expect(screen.getByRole('region', { name: 'Условие выбранного задания' }).scrollTop).toBe(0);
  expect(api.upload).toHaveBeenCalledTimes(1);
  expect(api.confirm).not.toHaveBeenCalled();
});

it('can confirm an entirely unchanged package to use all its tasks in a work', async () => {
  api.upload.mockResolvedValue({ id: 'preview', title: 'Пакет', issues: [], items: [{ stableId: 'sample', title: 'Задача', source: { provider: 'Авторское' }, status: 'unchanged', version: 2 }] });
  const view = render(<BankImportPanel onClose={vi.fn()} />);
  fireEvent.change(view.container.querySelector('input[type="file"]')!, { target: { files: [new File(['zip'], 'tasks.zip')] } });
  const next = await screen.findByRole('button', { name: 'Продолжить' });
  expect(next).toBeEnabled();
  fireEvent.click(next);
  await waitFor(() => expect(api.confirm).toHaveBeenCalledWith('preview'));
});
