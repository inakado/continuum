import { createRef, useState, type RefObject } from 'react';
import userEvent from '@testing-library/user-event';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AssessmentTaskView } from '@continuum/shared';
import { teacherBankApi } from './teacher-bank.api';
import BankTaskCorrection from './BankTaskCorrection';
import BankTaskActions from './BankTaskActions';

vi.mock('./teacher-bank.api', () => ({ teacherBankApi: { preview: vi.fn(), previewTask: vi.fn(), correct: vi.fn(), discard: vi.fn(), exportTask: vi.fn() } }));
const task: AssessmentTaskView = { id: '00000000-0000-4000-8000-000000000001', version: 1, statement: 'Старое условие', solution: null, images: {},
  task: { id: 'source-1', title: 'Координата', gradeBand: 'grade_10_11', topicPath: ['Механика'], type: 'short_number', source: { provider: 'Автор' }, maxPoints: 1, grading: { answer: '-12', absoluteTolerance: 0 } } };
const preview = { id: '00000000-0000-4000-8000-000000000002', title: 'Исправление', expiresAt: '2026-10-29T00:00:00Z', issues: [], items: [{ stableId: 'source-1', title: 'Координата', source: { provider: 'Автор' }, status: 'changed' as const, version: 2 }] };
const result = { added: 0, updated: 1, unchanged: 0, taskIds: [task.id], correction: { taskId: task.id, sourceVersion: 1 } };
beforeEach(() => {
  vi.resetAllMocks(); vi.mocked(teacherBankApi.preview).mockResolvedValue(preview);
  vi.mocked(teacherBankApi.previewTask).mockResolvedValue({ ...task, statement: 'Исправленное условие' });
  vi.mocked(teacherBankApi.correct).mockResolvedValue(result);
});
afterEach(cleanup);
it('returns keyboard focus to the bank menu after dismissing the correction', async () => {
  function Harness() {
    const [selection, setSelection] = useState<{ task: AssessmentTaskView; trigger: RefObject<HTMLButtonElement | null> } | null>(null);
    return <><BankTaskActions task={{ ...task, lifecycleRevision: 1 }} query="" onDeleted={vi.fn()} onCorrect={(task, trigger) => setSelection({ task, trigger })} />
      {selection && <BankTaskCorrection {...selection} onClose={() => setSelection(null)} />}</>;
  }
  render(<QueryClientProvider client={new QueryClient()}><Harness /></QueryClientProvider>);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Действия с заданием' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Исправить условие' }));
  await screen.findByRole('dialog');
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole('button', { name: 'Действия с заданием' })).toHaveFocus());
});
function setup() {
  const close = vi.fn();
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><BankTaskCorrection task={task} onClose={close} trigger={createRef()} /></QueryClientProvider>);
  return close;
}
async function upload() {
  fireEvent.change(screen.getByLabelText('Выбрать ZIP'), { target: { files: [new File(['zip'], 'fix.zip', { type: 'application/zip' })] } });
  await screen.findByText('Исправленное условие');
}
it('previews, requires unchanged meaning, applies once and closes after cleanup', async () => {
  const close = setup();
  expect(screen.queryByRole('button', { name: 'Сохранить в банке и работах' })).not.toBeInTheDocument();
  await upload();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByText('Источник и сведения')).not.toBeInTheDocument();
  expect(screen.queryByText('Ответ и проверка')).not.toBeInTheDocument();
  const button = screen.getByRole('button', { name: 'Сохранить в банке и работах' });
  expect(button).toBeDisabled(); expect(teacherBankApi.correct).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(button); fireEvent.click(button);
  await screen.findByRole('heading', { name: 'Условие исправлено' });
  expect(teacherBankApi.correct).toHaveBeenCalledExactlyOnceWith(task.id, { importId: preview.id, expectedVersion: 1 });
  fireEvent.click(screen.getByRole('button', { name: 'Готово' }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(teacherBankApi.discard).toHaveBeenCalledWith(preview.id);
});
it('rejects a ZIP containing several tasks without applying it', async () => {
  vi.mocked(teacherBankApi.preview).mockResolvedValue({ ...preview, items: [...preview.items, { ...preview.items[0], stableId: 'other' }] });
  setup(); fireEvent.change(screen.getByLabelText('Выбрать ZIP'), { target: { files: [new File(['zip'], 'fix.zip')] } });
  expect(await screen.findByRole('alert')).toHaveTextContent('только задача source-1');
  expect(screen.queryByRole('button', { name: 'Сохранить в банке и работах' })).not.toBeInTheDocument();
  expect(teacherBankApi.correct).not.toHaveBeenCalled();
});
it('retries exactly the same correction after a timeout', async () => {
  vi.mocked(teacherBankApi.correct).mockRejectedValueOnce(new Error('Соединение прервано')).mockResolvedValueOnce(result);
  setup(); await upload(); fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Сохранить в банке и работах' }));
  fireEvent.click(await screen.findByRole('button', { name: 'Повторить сохранение' }));
  await screen.findByRole('heading', { name: 'Условие исправлено' });
  expect(vi.mocked(teacherBankApi.correct).mock.calls[1]).toEqual(vi.mocked(teacherBankApi.correct).mock.calls[0]);
});
it('downloads one task and cancels without applying', async () => {
  const close = setup(); fireEvent.click(screen.getByRole('button', { name: 'Скачать эту задачу' }));
  await waitFor(() => expect(teacherBankApi.exportTask).toHaveBeenCalledExactlyOnceWith(task.id));
  await upload(); fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce()); expect(teacherBankApi.correct).not.toHaveBeenCalled();
});
