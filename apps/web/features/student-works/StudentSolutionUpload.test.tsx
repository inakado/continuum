import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import type { SolutionAnswer } from '@continuum/shared';
import { solutionsApi } from '@/lib/assessment/solutions.api';
import StudentSolutionUpload from './StudentSolutionUpload';
import { useSolutionPhotos } from './use-solution-photos';

vi.mock('@/lib/assessment/solutions.api', () => ({ solutionsApi: { list: vi.fn(), upload: vi.fn(), remove: vi.fn() } }));
const id = '00000000-0000-4000-8000-000000000001';
const empty: SolutionAnswer = { taskId: id, title: 'Газ', maxPoints: 2, revision: 0, locked: false, photos: [] };
const added: SolutionAnswer = { ...empty, revision: 1, photos: [{ id, contentType: 'image/png', sizeBytes: 3, url: '/assessment-solutions/photo', createdAt: '2026-10-18T00:00:00Z' }] };
function Harness() {
  const controller = useSolutionPhotos(id, true);
  return <><StudentSolutionUpload taskId={id} controller={controller} disabled={false} />
    {controller.error && <button onClick={() => void controller.flush()}>Повторить</button>}
  </>;
}
function show(answer = empty) {
  vi.mocked(solutionsApi.list).mockResolvedValue([answer]);
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Harness /></QueryClientProvider>);
}
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('uploads several pages serially with current revisions and displays only confirmed photos', async () => {
  vi.mocked(solutionsApi.upload).mockResolvedValueOnce([added]).mockResolvedValueOnce([{ ...added, revision: 2, photos: [...added.photos, { ...added.photos[0], id: '00000000-0000-4000-8000-000000000002' }] }]);
  show();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Добавить фото' })).toBeEnabled());
  fireEvent.drop(screen.getByRole('button', { name: 'Добавить фото' }).closest('[aria-busy]')!, { dataTransfer: { files: [new File(['abc'], '1.png', { type: 'image/png' }), new File(['def'], '2.png', { type: 'image/png' })] } });
  await screen.findByRole('button', { name: 'Открыть фото 2' });
  expect(vi.mocked(solutionsApi.upload).mock.calls.map((call) => call[4].revision)).toEqual([0, 1]);
  expect(screen.getByText('Ожидает проверки')).toBeVisible();
});
it('retains the current photo on failed replacement and repeats the same file id', async () => {
  vi.mocked(solutionsApi.upload).mockRejectedValueOnce(new TypeError('offline')).mockResolvedValue([added]);
  show(added);
  await screen.findByRole('button', { name: 'Заменить фото 1' });
  fireEvent.click(screen.getByRole('button', { name: 'Заменить фото 1' }));
  const input = screen.getByLabelText('Выбрать фотографии решения');
  expect(input).not.toHaveAttribute('multiple');
  fireEvent.change(input, { target: { files: [new File(['abc'], 'new.png', { type: 'image/png' })] } });
  fireEvent.click(await screen.findByRole('button', { name: 'Повторить' }));
  await waitFor(() => expect(solutionsApi.upload).toHaveBeenCalledTimes(2));
  const calls = vi.mocked(solutionsApi.upload).mock.calls;
  expect(calls[0][2]).toBe(calls[1][2]);
  expect(calls[0][4]).toMatchObject({ replaceId: id, revision: 1 });
  expect(screen.getByRole('button', { name: 'Открыть фото 1' })).toBeVisible();
});
it('rejects unsupported files and does not offer changes for a locked answer', async () => {
  const first = show();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Добавить фото' })).toBeEnabled());
  fireEvent.change(screen.getByLabelText('Выбрать фотографии решения'), { target: { files: [new File(['x'], 'photo.heic', { type: 'image/heic' })] } });
  expect(screen.getByRole('alert')).toHaveTextContent('JPG, PNG или WebP');
  expect(solutionsApi.upload).not.toHaveBeenCalled();
  first.unmount(); show({ ...added, locked: true });
  await screen.findByText('Проверено');
  expect(screen.queryByRole('button', { name: 'Заменить фото 1' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Добавить фото' })).not.toBeInTheDocument();
});
it('shows a published zero score and PDF only after publication', async () => {
  const first = show({ ...added, publishedReview: null });
  await screen.findByText('Ожидает проверки');
  expect(screen.queryByRole('link', { name: 'Разбор решения · PDF' })).not.toBeInTheDocument();
  first.unmount();
  show({ ...added, locked: true, publishedReview: { points: 0, revision: 1, reportUrl: '/assessment-solutions/report.pdf' } });
  expect(await screen.findByText('0 из 2 баллов')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Разбор решения · PDF' })).toHaveAttribute('href', 'http://localhost:3000/assessment-solutions/report.pdf');
  expect(screen.queryByRole('button', { name: 'Добавить фото' })).not.toBeInTheDocument();
});
it('refreshes a published review on return, but does not refetch over an upload in flight', async () => {
  show(added);
  await screen.findByText('Ожидает проверки');
  let finishUpload!: (value: SolutionAnswer[]) => void;
  vi.mocked(solutionsApi.upload).mockImplementation(() => new Promise((resolve) => { finishUpload = resolve; }));
  fireEvent.change(screen.getByLabelText('Выбрать фотографии решения'), { target: { files: [new File(['abc'], '2.png', { type: 'image/png' })] } });
  await waitFor(() => expect(solutionsApi.upload).toHaveBeenCalledOnce());
  act(() => { focusManager.setFocused(false); focusManager.setFocused(true); });
  expect(solutionsApi.list).toHaveBeenCalledOnce();
  await act(async () => { finishUpload([{ ...added, revision: 2 }]); });
  vi.mocked(solutionsApi.list).mockResolvedValue([{ ...added, revision: 2, locked: true, publishedReview: { points: 1, revision: 1, reportUrl: '/review.pdf' } }]);
  act(() => { focusManager.setFocused(false); focusManager.setFocused(true); });
  expect(await screen.findByText('1 из 2 баллов')).toBeVisible();
  act(() => focusManager.setFocused(undefined));
});
