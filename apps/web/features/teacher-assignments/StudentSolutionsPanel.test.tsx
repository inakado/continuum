import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { focusManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import type { SolutionAnswer } from '@continuum/shared';
import { solutionsApi } from '@/lib/assessment/solutions.api';
import StudentSolutionsPanel from './StudentSolutionsPanel';

vi.mock('@/lib/assessment/solutions.api', () => ({ solutionsApi: { list: vi.fn() } }));
const answer: SolutionAnswer = { taskId: 'task', title: 'Решение задачи', maxPoints: 2, revision: 0, locked: false, photos: [] };
const received: SolutionAnswer = { ...answer, revision: 1, photos: [{ id: 'photo', contentType: 'image/png', sizeBytes: 3, url: '/photo.png', createdAt: '2026-10-28T00:00:00Z' }] };
async function tick(ms = 50) { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); }
function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const view = render(<QueryClientProvider client={client}><StudentSolutionsPanel id="recipient" name="Ученик" close={vi.fn()} /></QueryClientProvider>);
  return { ...view, client };
}
afterEach(() => { cleanup(); focusManager.setFocused(undefined); vi.useRealTimers(); vi.resetAllMocks(); });

it('refreshes an open panel, preserves the photo viewer and stops polling when unmounted', async () => {
  vi.useFakeTimers(); focusManager.setFocused(true);
  vi.mocked(solutionsApi.list).mockResolvedValueOnce([answer]).mockResolvedValue([received]);
  const view = show(); await tick();
  expect(screen.getByText(/Решение не добавлено/)).toBeVisible();
  const heading = screen.getByRole('heading', { name: 'Ученик · Решения' });
  expect(heading).toHaveFocus();
  await tick(10050); await tick();
  fireEvent.click(screen.getByRole('button', { name: 'Открыть фото 1' }));
  expect(screen.getByRole('dialog')).toBeVisible();
  await tick(10050); await tick();
  expect(screen.getByRole('dialog')).toBeVisible();
  view.unmount(); const count = vi.mocked(solutionsApi.list).mock.calls.length;
  await tick(20000);
  expect(solutionsApi.list).toHaveBeenCalledTimes(count);
  view.client.clear();
});

it('pauses background polling, refreshes on return, and keeps accepted photos through a refresh failure', async () => {
  vi.useFakeTimers(); focusManager.setFocused(true);
  vi.mocked(solutionsApi.list).mockResolvedValue([received]);
  const view = show(); await tick();
  expect(screen.getByRole('button', { name: 'Открыть фото 1' })).toBeVisible();
  act(() => focusManager.setFocused(false));
  await tick(20000);
  expect(solutionsApi.list).toHaveBeenCalledOnce();
  vi.mocked(solutionsApi.list).mockRejectedValueOnce(new TypeError('offline'));
  act(() => focusManager.setFocused(true)); await tick();
  expect(screen.getByRole('alert')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Открыть фото 1' })).toBeVisible();
  screen.getByRole('button', { name: 'Обновить решения' }).focus();
  fireEvent.click(screen.getByRole('button', { name: 'Обновить решения' })); await tick();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Обновить решения' })).toHaveFocus();
  view.client.clear();
});

it('shows a published per-task score and PDF, without treating a zero score as missing', async () => {
  vi.mocked(solutionsApi.list).mockResolvedValue([{ taskId: 'task', title: 'Газ', maxPoints: 2, revision: 1, locked: true, photos: [], publishedReview: { points: 0, revision: 1, reportUrl: '/assessment-solutions/report.pdf' } }]);
  render(<QueryClientProvider client={new QueryClient()}><StudentSolutionsPanel id="recipient" name="Ученик" close={() => undefined} /></QueryClientProvider>);
  expect(await screen.findByText('Проверено · 0 из 2 баллов')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Разбор решения · PDF' })).toHaveAttribute('href', 'http://localhost:3000/assessment-solutions/report.pdf');
});
