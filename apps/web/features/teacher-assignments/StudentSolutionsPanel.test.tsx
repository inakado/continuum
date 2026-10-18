import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { solutionsApi } from '@/lib/assessment/solutions.api';
import StudentSolutionsPanel from './StudentSolutionsPanel';
vi.mock('@/lib/assessment/solutions.api', () => ({ solutionsApi: { list: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('shows a published per-task score and PDF, without treating a zero score as missing', async () => {
  vi.mocked(solutionsApi.list).mockResolvedValue([{ taskId: 'task', title: 'Газ', maxPoints: 2, revision: 1, locked: true, photos: [], publishedReview: { points: 0, revision: 1, reportUrl: '/assessment-solutions/report.pdf' } }]);
  render(<QueryClientProvider client={new QueryClient()}><StudentSolutionsPanel id="recipient" name="Ученик" close={() => undefined} /></QueryClientProvider>);
  expect(await screen.findByText('Проверено · 0 из 2 баллов')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Разбор решения · PDF' })).toHaveAttribute('href', 'http://localhost:3000/assessment-solutions/report.pdf');
});
