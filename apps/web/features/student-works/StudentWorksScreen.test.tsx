import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import StudentWorksScreen from './StudentWorksScreen';
import { studentWorksApi } from './student-works.api';
import type { StudentWorkListItem } from '@continuum/shared';

vi.mock('@/components/ContinuumHeader', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('./student-works.api', () => ({ studentWorksApi: { list: vi.fn() } }));
const work = { id: 'work', title: 'Термодинамика', versionNumber: 1, taskCount: 5, automaticTaskCount: 2, extendedTaskCount: 3, assignedAt: '2026-10-21T00:00:00Z', revision: 1,
  status: 'completed' as const, answeredCount: 2, startedAt: '2026-10-21T01:00:00Z', completedAt: '2026-10-21T02:00:00Z', result: { correctCount: 1, incorrectCount: 1 },
  progress: { photoTaskCount: 2, publishedReviewTaskCount: 1, resultReady: false } };
function show(item: StudentWorkListItem = work) {
  vi.mocked(studentWorksApi.list).mockResolvedValue([item]);
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><StudentWorksScreen /></QueryClientProvider>);
}
beforeEach(() => vi.resetAllMocks());
it('shows saved points in the list when partial scoring is present', async () => {
  show({ ...work, result: { correctCount: 0, incorrectCount: 0, partialCount: 2, points: 2, maxPoints: 4 } });
  expect(await screen.findByText('Тестовая часть завершена · Баллы 2 из 4')).toBeVisible();
  expect(screen.queryByText(/Верно 0/)).not.toBeInTheDocument();
});
it('shows independent automatic/photo/published progress and opens missing solutions', async () => {
  show();
  expect(await screen.findByText('Фото: 2 из 3 задач · Проверено: 1 из 3')).toBeVisible();
  expect(screen.getByText(/Тестовая часть завершена · Верно 1 из 2/)).toBeVisible();
  expect(screen.getByRole('link', { name: /Добавить решения/ })).toHaveAttribute('href', '/student/works/work?view=solutions');
});
it('keeps all uploaded but partly reviewed work accessible without declaring it finished', async () => {
  show({ ...work, progress: { ...work.progress, photoTaskCount: 3 } });
  expect(await screen.findByRole('link', { name: /Открыть работу/ })).toBeVisible();
  expect(screen.queryByText('Завершено', { exact: true })).not.toBeInTheDocument();
});
it('opens published results and hides the absent automatic part', async () => {
  show({ ...work, automaticTaskCount: 0, taskCount: 3, progress: { photoTaskCount: 3, publishedReviewTaskCount: 3, resultReady: true } });
  expect(await screen.findByRole('link', { name: /Посмотреть результат/ })).toHaveAttribute('href', '/student/works/work?view=result');
  expect(screen.queryByText(/Тестовая часть/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Верно/)).not.toBeInTheDocument();
});
it('does not show photo counters for an automatic-only result', async () => {
  show({ ...work, extendedTaskCount: 0, taskCount: 2, progress: { photoTaskCount: 0, publishedReviewTaskCount: 0, resultReady: true } });
  expect(await screen.findByRole('link', { name: /Посмотреть результат/ })).toBeVisible();
  expect(screen.queryByText(/Фото:/)).not.toBeInTheDocument();
});
