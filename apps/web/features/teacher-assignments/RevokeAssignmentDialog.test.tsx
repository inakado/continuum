import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import RevokeAssignmentDialog from './RevokeAssignmentDialog';
import { teacherAssignmentsApi } from './teacher-assignments.api';
import { assignmentQueryKeys } from '@/lib/query/keys';
import { ApiError } from '@/lib/api/client';

vi.mock('./teacher-assignments.api', () => ({ teacherAssignmentsApi: { revocation: vi.fn(), revoke: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const id = '00000000-0000-4000-8000-000000000001', workId = '00000000-0000-4000-8000-000000000002', versionId = '00000000-0000-4000-8000-000000000003';
const preview = { id, workId, versionId, title: 'Термодинамика', classTitle: '11Б', academicYear: 2026, studentCount: 20, startedCount: 4, completedCount: 2, recipientsHash: 'a'.repeat(64) };
function show() {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const close = vi.fn(), onRemoved = vi.fn(), returnFocus = vi.fn();
  render(<QueryClientProvider client={cache}><RevokeAssignmentDialog id={id} close={close} onRemoved={onRemoved} returnFocus={returnFocus} /></QueryClientProvider>);
  return { cache, close, onRemoved };
}
it('loads the exact class, warns about irreversibility and focuses cancel without making a write', async () => {
  vi.mocked(teacherAssignmentsApi.revocation).mockResolvedValue(preview);
  const { close } = show();
  expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus();
  expect(await screen.findByText(/Учеников: 20/)).toBeVisible();
  expect(screen.getByRole('dialog')).toHaveAccessibleDescription(/11Б.*Восстановить их нельзя/);
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(close).toHaveBeenCalledOnce();
  expect(teacherAssignmentsApi.revoke).not.toHaveBeenCalled();
});
it('retains the confirmed membership hash through a background refresh and shows a conflict without closing', async () => {
  vi.mocked(teacherAssignmentsApi.revocation).mockResolvedValue(preview);
  vi.mocked(teacherAssignmentsApi.revoke).mockRejectedValue(new ApiError(409, 'Список получателей изменился.'));
  const { cache, close } = show();
  await screen.findByText(/Учеников: 20/);
  cache.setQueryData(assignmentQueryKeys.revocation(id), { ...preview, studentCount: 21, recipientsHash: 'b'.repeat(64) });
  fireEvent.click(screen.getByRole('button', { name: 'Удалить назначение' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Список получателей изменился.');
  expect(teacherAssignmentsApi.revoke).toHaveBeenCalledWith({ id, input: { expectedRecipientsHash: preview.recipientsHash } }, expect.anything());
  expect(close).not.toHaveBeenCalled();
});
it('blocks double submit and closing while pending, then completes with a single request', async () => {
  vi.mocked(teacherAssignmentsApi.revocation).mockResolvedValue(preview);
  let resolve!: (value: { id: string; workId: string; versionId: string }) => void;
  vi.mocked(teacherAssignmentsApi.revoke).mockImplementation(() => new Promise((done) => { resolve = done; }));
  const { close, onRemoved } = show();
  await screen.findByText(/Учеников: 20/);
  const submit = screen.getByRole('button', { name: 'Удалить назначение' });
  fireEvent.click(submit); fireEvent.click(submit);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Отмена' })).toBeDisabled());
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(close).not.toHaveBeenCalled();
  expect(teacherAssignmentsApi.revoke).toHaveBeenCalledOnce();
  resolve({ id, workId, versionId });
  await waitFor(() => expect(onRemoved).toHaveBeenCalledOnce());
});
