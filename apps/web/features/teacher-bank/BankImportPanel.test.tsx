import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import BankImportPanel from './BankImportPanel';
const api = vi.hoisted(() => ({ upload: vi.fn(), refetch: vi.fn(), confirm: vi.fn(), discard: vi.fn(), checking: false }));
vi.mock('./teacher-bank.api', () => ({ teacherBankApi: { discard: api.discard } }));
vi.mock('./use-teacher-bank', () => ({
  usePreviewBankImport: () => ({ isPending: false, mutateAsync: api.upload }),
  useConfirmBankImport: () => ({ isPending: false, data: null, reset: vi.fn(), mutateAsync: api.confirm }),
  useBankImportTask: () => ({ isPending: false, error: new Error('Ошибка условия'), refetch: api.refetch }),
  useBankDuplicateHints: () => ({ isPending: api.checking, data: { status: 'complete', tasks: [] } }),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); api.checking = false; });
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
