import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import BankDeletionNotice from './BankDeletionNotice';
import { teacherBankApi } from './teacher-bank.api';

vi.mock('./teacher-bank.api', () => ({ teacherBankApi: { restore: vi.fn() } }));
const deletion = { id: 'task-id', version: 3, deletionRevision: 8, title: 'Температура газа', query: 'search=газ' };
const onRestored = vi.fn(), onDismiss = vi.fn();
function setup() {
  const cache = new QueryClient();
  const invalidate = vi.spyOn(cache, 'invalidateQueries');
  render(<QueryClientProvider client={cache}><BankDeletionNotice deletion={deletion} onRestored={onRestored} onDismiss={onDismiss} /></QueryClientProvider>);
  return invalidate;
}
beforeEach(() => vi.resetAllMocks());
it('keeps the notification until dismissal and does not issue a restore on dismissal', () => {
  setup();
  expect(screen.getByRole('status')).toHaveTextContent('«Температура газа» — задание удалено');
  fireEvent.click(screen.getByRole('button', { name: /Закрыть уведомление/ }));
  expect(onDismiss).toHaveBeenCalledOnce();
  expect(teacherBankApi.restore).not.toHaveBeenCalled();
});
it('restores the exact deletion, refreshes the bank before returning and blocks duplicate clicks', async () => {
  const pending = Promise.withResolvers<{ id: string }>();
  vi.mocked(teacherBankApi.restore).mockReturnValue(pending.promise);
  const invalidate = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Возвращаем…' })).toBeDisabled());
  expect(screen.getByRole('button', { name: /Закрыть уведомление/ })).toBeDisabled();
  expect(onRestored).not.toHaveBeenCalled();
  expect(teacherBankApi.restore).toHaveBeenCalledWith('task-id', { expectedVersion: 3, expectedDeletionRevision: 8 });
  pending.resolve({ id: deletion.id });
  await waitFor(() => expect(onRestored).toHaveBeenCalledOnce());
  expect(invalidate).toHaveBeenCalledOnce();
  expect(invalidate.mock.invocationCallOrder[0]).toBeLessThan(onRestored.mock.invocationCallOrder[0]);
});
it('preserves the receipt on failure and retries the same request explicitly', async () => {
  vi.mocked(teacherBankApi.restore).mockRejectedValueOnce(new Error('Нет сети')).mockResolvedValue({ id: deletion.id });
  setup(); fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Повторите попытку');
  expect(onRestored).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
  await waitFor(() => expect(onRestored).toHaveBeenCalledOnce());
  expect(vi.mocked(teacherBankApi.restore).mock.calls[0]).toEqual(vi.mocked(teacherBankApi.restore).mock.calls[1]);
});
