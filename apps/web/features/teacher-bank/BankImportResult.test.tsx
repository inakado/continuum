import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AssessmentImportResult, AssessmentWorkDetail } from '@continuum/shared';
import { teacherWorkQueryKeys } from '@/lib/query/keys';
import { teacherWorksApi } from '@/features/teacher-works/teacher-works.api';
import { teacherBankApi } from './teacher-bank.api';
import BankImportResult from './BankImportResult';

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
vi.mock('@/features/teacher-works/teacher-works.api', () => ({ teacherWorksApi: { create: vi.fn() } }));
vi.mock('./teacher-bank.api', () => ({ teacherBankApi: { discard: vi.fn(), confirm: vi.fn() } }));
const result: AssessmentImportResult = { added: 1, updated: 1, unchanged: 1, taskIds: [1, 2, 3].map(n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`),
  items: [1, 2, 3].map(n => ({ taskId: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`, version: n })), gradeBands: ['grade_10_11'] };
const work: AssessmentWorkDetail = { id: '00000000-0000-4000-8000-000000000009', title: 'Кинематика', gradeBand: 'grade_10_11', instructions: '', items: [], revision: 1, maxPoints: 6, taskCount: 3, updatedAt: '2026-10-28T00:00:00Z' };
beforeEach(() => { vi.resetAllMocks(); vi.mocked(teacherBankApi.discard).mockResolvedValue(undefined); });
afterEach(cleanup);
function setup(receipt = result) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const close = vi.fn();
  render(<QueryClientProvider client={client}><BankImportResult importId="preview" title="Кинематика" result={receipt} busy={false} onClose={close} /></QueryClientProvider>);
  return { client, close };
}
it('offers creation without creating anything until explicitly clicked; returning is independent', () => {
  const { close } = setup();
  expect(screen.getByRole('button', { name: 'Создать работу из 3 заданий' })).toBeEnabled();
  expect(teacherWorksApi.create).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'В банк заданий' }));
  expect(close).toHaveBeenCalledTimes(1);
  expect(teacherWorksApi.create).not.toHaveBeenCalled();
});
it('seeds every pinned reference once, primes cache, and navigates even when preview cleanup fails', async () => {
  let finish!: (value: AssessmentWorkDetail) => void;
  vi.mocked(teacherWorksApi.create).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  vi.mocked(teacherBankApi.discard).mockRejectedValue(new Error('temporary cleanup failure'));
  const { client } = setup();
  const button = screen.getByRole('button', { name: 'Создать работу из 3 заданий' });
  fireEvent.click(button); fireEvent.click(button);
  await waitFor(() => expect(teacherWorksApi.create).toHaveBeenCalledTimes(1));
  expect(vi.mocked(teacherWorksApi.create).mock.calls[0][0]).toEqual({ id: expect.any(String), title: 'Кинематика', gradeBand: 'grade_10_11', items: result.items });
  expect(screen.getByRole('button', { name: 'В банк заданий' })).toBeDisabled();
  finish(work);
  await waitFor(() => expect(navigation.push).toHaveBeenCalledWith(`/teacher/works/${work.id}?from=import`));
  expect(client.getQueryData(teacherWorkQueryKeys.detail(work.id))).toEqual(work);
  expect(teacherBankApi.discard).toHaveBeenCalledWith('preview');
  expect(teacherBankApi.confirm).not.toHaveBeenCalled();
});
it('retries the same creation request after an uncertain failure without reimporting', async () => {
  vi.mocked(teacherWorksApi.create).mockRejectedValueOnce(new Error('network timeout')).mockResolvedValueOnce(work);
  setup({ ...result, added: 0, updated: 0, unchanged: 3 });
  expect(screen.getByRole('heading', { name: 'Пакет обработан' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Создать работу из 3 заданий' }));
  const retry = await screen.findByRole('button', { name: 'Повторить создание работы' });
  expect(screen.getByRole('alert')).toHaveTextContent('Задачи сохранены в банке');
  expect(screen.getByRole('button', { name: 'В банк заданий' })).toBeEnabled();
  fireEvent.click(retry);
  await waitFor(() => expect(navigation.push).toHaveBeenCalled());
  expect(vi.mocked(teacherWorksApi.create).mock.calls[1][0]).toEqual(vi.mocked(teacherWorksApi.create).mock.calls[0][0]);
  expect(teacherBankApi.confirm).not.toHaveBeenCalled();
});
it('asks for the work grade only for mixed-grade packages', async () => {
  vi.mocked(teacherWorksApi.create).mockResolvedValue(work);
  setup({ ...result, gradeBands: ['grade_10_11', 'grade_8'] });
  const button = screen.getByRole('button', { name: 'Создать работу из 3 заданий' });
  expect(button).toBeDisabled();
  fireEvent.change(screen.getByRole('combobox', { name: 'Параллель работы' }), { target: { value: 'grade_8' } });
  fireEvent.click(button);
  await waitFor(() => expect(teacherWorksApi.create).toHaveBeenCalled());
  expect(vi.mocked(teacherWorksApi.create).mock.calls[0][0].gradeBand).toBe('grade_8');
});
it('does not invent pinned versions for old receipts', () => {
  setup({ added: 1, updated: 0, unchanged: 0, taskIds: result.taskIds });
  expect(screen.queryByRole('button', { name: /^Создать работу/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'В банк заданий' })).toBeEnabled();
});
