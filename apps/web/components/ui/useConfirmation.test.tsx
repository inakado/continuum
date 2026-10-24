import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useConfirmation } from './useConfirmation';
import { ApiError } from '@/lib/api/client';

afterEach(cleanup);
function Harness({ run, other = vi.fn() }: { run: () => void | Promise<unknown>; other?: () => void }) {
  const confirmation = useConfirmation();
  return <><button onClick={() => confirmation.ask({ title: 'Удалить объект?', description: 'Объект «Первый» будет удалён.', confirmText: 'Удалить', destructive: true }, run)}>Первый</button>
    <button onClick={() => confirmation.ask({ title: 'Другой объект?', description: 'Другой объект.', confirmText: 'Другой' }, other)}>Второй</button>{confirmation.dialog}</>;
}
function open() { const trigger = screen.getByRole('button', { name: 'Первый' }); trigger.focus(); fireEvent.click(trigger); return trigger; }

it('describes the exact action, focuses cancel, and restores focus on Escape without executing', async () => {
  const run = vi.fn(); render(<Harness run={run} />); const trigger = open();
  expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription('Объект «Первый» будет удалён.');
  expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus();
  fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(trigger).toHaveFocus(); expect(run).not.toHaveBeenCalled();
});

it('keeps the captured action, blocks double submit and closing while pending, and closes only on success', async () => {
  let finish!: () => void;
  const run = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; })), other = vi.fn();
  render(<Harness run={run} other={other} />); open();
  fireEvent.click(screen.getByRole('button', { name: 'Второй', hidden: true }));
  const confirm = screen.getByRole('button', { name: 'Удалить' });
  fireEvent.click(confirm); fireEvent.click(confirm);
  expect(run).toHaveBeenCalledOnce(); expect(other).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Отмена' })).toBeDisabled();
  fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
  expect(screen.getByRole('alertdialog')).toBeVisible();
  await act(async () => finish());
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
});

it('retains errors inside the dialog and retries the same action', async () => {
  const run = vi.fn().mockRejectedValueOnce(new ApiError(409, 'Данные изменились')).mockResolvedValue(undefined);
  render(<Harness run={run} />); open();
  fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
  expect(await within(screen.getByRole('alertdialog')).findByRole('alert')).toHaveTextContent('Данные изменились');
  fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  expect(run).toHaveBeenCalledTimes(2);
});
