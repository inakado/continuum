import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import type { StudentWorkDetail } from '@continuum/shared';
import StudentWorkScreen from './StudentWorkScreen';
import { studentWorksApi } from './student-works.api';
import { studentWorkQueryKeys } from '@/lib/query/keys';
import { ApiError } from '@/lib/api/client';

vi.mock('@/components/ContinuumHeader', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/features/auth/useAuthSession', () => ({ useAuthSession: () => ({ data: { user: { id: 'student', login: 'student1' } } }) }));
vi.mock('./student-works.api', () => ({ studentWorksApi: { detail: vi.fn(), start: vi.fn(), save: vi.fn(), finish: vi.fn() } }));
const id = '00000000-0000-4000-8000-000000000001';
const taskId = '00000000-0000-4000-8000-000000000002';
const initial: StudentWorkDetail = { id, title: 'Давление газа', versionNumber: 1, taskCount: 1, assignedAt: '2026-10-17T00:00:00Z',
  revision: 1, status: 'not_started', answeredCount: 0, startedAt: null, completedAt: null, result: null, instructions: 'Введите давление.', answers: {},
  items: [{ id: taskId, type: 'short_number', title: 'Давление', statement: 'Найдите давление газа.', unit: 'Па', maxPoints: 1, images: {} }] };
const started = { ...initial, status: 'in_progress' as const, startedAt: '2026-10-17T01:00:00Z' };
const saved = { revision: 2, status: 'in_progress' as const, answeredCount: 1, startedAt: started.startedAt, completedAt: null, result: null };
const completed = { ...saved, revision: 3, status: 'completed' as const, completedAt: '2026-10-17T01:10:00Z', result: { correctCount: 1, incorrectCount: 0 } };
function show(cache = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })) {
  return render(<QueryClientProvider client={cache}><StudentWorkScreen id={id} /></QueryClientProvider>);
}
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.restoreAllMocks(); localStorage.clear(); sessionStorage.clear(); });

it('groups the instructions, saving policy and start action before the first attempt', async () => {
  vi.mocked(studentWorksApi.detail).mockResolvedValue(initial);
  show();
  const overview = await screen.findByRole('region', { name: initial.title });
  expect(within(overview).getByText(initial.instructions)).toBeVisible();
  expect(within(overview).getByText('После завершения ответы изменить нельзя.')).toBeVisible();
  expect(within(overview).getByRole('button', { name: 'Начать работу' })).toHaveAccessibleDescription(/сохраняются автоматически/);
  expect(studentWorksApi.start).not.toHaveBeenCalled();
});

it('checks the server on re-entry even for fresh cached data, before restoring editable answers', async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  cache.setQueryData(studentWorkQueryKeys.detail(id), { ...started, answers: { [taskId]: { type: 'short_number', value: '1' } } });
  let resolveDetail!: (value: StudentWorkDetail) => void;
  vi.mocked(studentWorksApi.detail).mockReturnValue(new Promise((resolve) => { resolveDetail = resolve; }));
  show(cache);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  await waitFor(() => expect(studentWorksApi.detail).toHaveBeenCalledWith(id));
  resolveDetail({ ...started, ...saved, answers: { [taskId]: { type: 'short_number', value: '4,83' } } });
  expect(await screen.findByRole('textbox', { name: 'Ответ: Давление' })).toHaveValue('4,83');
  expect(studentWorksApi.save).not.toHaveBeenCalled();
});

it('does not open a cached attempt for editing when the entry check fails, and can retry', async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 30_000 } } });
  cache.setQueryData(studentWorkQueryKeys.detail(id), started);
  vi.mocked(studentWorksApi.detail).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue({ ...started, ...completed });
  show(cache);
  await screen.findByRole('alert');
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
  expect(await screen.findByText('Работа завершена')).toBeVisible();
});

it('starts explicitly, saves an answer before finishing and restores the final result on a fresh visit', async () => {
  vi.mocked(studentWorksApi.detail).mockResolvedValueOnce(initial).mockResolvedValue(started);
  vi.mocked(studentWorksApi.start).mockResolvedValue(started);
  vi.mocked(studentWorksApi.save).mockResolvedValue(saved);
  vi.mocked(studentWorksApi.finish).mockResolvedValue(completed);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  const first = show();
  fireEvent.click(await screen.findByRole('button', { name: 'Начать работу' }));
  const input = await screen.findByRole('textbox', { name: 'Ответ: Давление' });
  fireEvent.change(input, { target: { value: '4,83' } });
  expect(screen.getByRole('button', { name: 'Завершить работу' })).toBeDisabled();
  await screen.findByText('Сохранено ответов: 1 из 1');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Завершить работу' })).toBeEnabled());
  expect(studentWorksApi.save).toHaveBeenCalledWith(id, taskId, expect.objectContaining({ expectedRevision: 1, answer: { type: 'short_number', value: '4,83' } }));
  fireEvent.click(screen.getByRole('button', { name: 'Завершить работу' }));
  fireEvent.click(screen.getByRole('button', { name: 'Подтвердить завершение' }));
  expect(await screen.findByText('Верно: 1 · Неверно: 0')).toBeVisible();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  first.unmount();
  vi.mocked(studentWorksApi.detail).mockResolvedValue({ ...started, ...completed });
  show();
  expect(await screen.findByText('Работа завершена')).toBeVisible();
  expect(screen.getByText('Верно: 1 · Неверно: 0')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Завершить работу' })).not.toBeInTheDocument();
});

it('restores a saved unfinished answer on a fresh visit without finishing it automatically', async () => {
  vi.mocked(studentWorksApi.detail).mockResolvedValue({ ...started, ...saved, answers: { [taskId]: { type: 'short_number', value: '4,83' } } });
  show();
  expect(await screen.findByRole('textbox', { name: 'Ответ: Давление' })).toHaveValue('4,83');
  expect(screen.getByText('Сохранено ответов: 1 из 1')).toBeVisible();
  expect(screen.queryByText('Работа завершена')).not.toBeInTheDocument();
  expect(studentWorksApi.finish).not.toHaveBeenCalled();
});

it('keeps unsaved answers on screen if an explicitly requested conflict reload fails', async () => {
  vi.mocked(studentWorksApi.detail).mockResolvedValueOnce(started).mockRejectedValue(new TypeError('Failed to fetch'));
  vi.mocked(studentWorksApi.save).mockRejectedValue(new ApiError(409, 'Ответы изменились в другой вкладке.'));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  show();
  fireEvent.change(await screen.findByRole('textbox', { name: 'Ответ: Давление' }), { target: { value: '7' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Загрузить сохранённую работу' }));
  await waitFor(() => expect(studentWorksApi.detail).toHaveBeenCalledTimes(2));
  await screen.findByText('Не удалось загрузить сохранённую работу. Изменения этой вкладки сохранены на экране.');
  expect(screen.getByRole('textbox', { name: 'Ответ: Давление' })).toHaveValue('7');
  expect(screen.getByRole('button', { name: 'Завершить работу' })).toBeDisabled();
});

it('does not offer a device-storage setting or persist new answers when saving fails', async () => {
  vi.mocked(studentWorksApi.detail).mockResolvedValue(started);
  vi.mocked(studentWorksApi.save).mockRejectedValue(new TypeError('offline'));
  show();
  const input = await screen.findByRole('textbox', { name: 'Ответ: Давление' });
  expect(screen.queryByLabelText('Сохранять черновик на этом устройстве')).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: '7' } });
  await screen.findByRole('button', { name: 'Повторить сохранение' });
  expect(Object.keys(localStorage).filter((key) => key.startsWith('continuum:answer-draft:'))).toEqual([]);
  expect(input).toHaveValue('7');
});

it('recovers a previously stored draft without creating new ones, then removes it after acknowledgement', async () => {
  const name = `continuum:answer-draft:student:${id}:1`;
  localStorage.setItem(name, JSON.stringify({ owner: 'student', recipient: id, version: 1, revision: 1, expires: Date.now() + 86_400_000,
    answers: { [taskId]: { type: 'short_number', value: '7' } }, base: {} }));
  vi.mocked(studentWorksApi.detail).mockResolvedValue(started);
  vi.mocked(studentWorksApi.save).mockResolvedValue(saved);
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'Восстановить ответы' }));
  expect(screen.getByRole('textbox', { name: 'Ответ: Давление' })).toHaveValue('7');
  await screen.findByText('Сохранено ответов: 1 из 1');
  await waitFor(() => expect(localStorage.getItem(name)).toBeNull());
});

it('links the completion review to an incomplete matching task without submitting', async () => {
  const matchId = '00000000-0000-4000-8000-000000000003';
  vi.mocked(studentWorksApi.detail).mockResolvedValue({ ...started, taskCount: 2, answers: { [matchId]: { type: 'matching', matches: { a: 'one' } } }, items: [...started.items,
    { id: matchId, type: 'matching', title: 'Соответствие', statement: 'Сопоставьте', maxPoints: 2, images: {}, rows: [{ id: 'a', content: 'А' }, { id: 'b', content: 'Б' }], options: [{ id: 'one', content: 'Первый' }, { id: 'two', content: 'Второй' }] }] });
  show();
  fireEvent.click(await screen.findByRole('button', { name: 'Завершить работу' }));
  expect(screen.getByText('Заполнено: 0 из 2')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Задание 2 — ответ не закончен' }));
  expect(await screen.findByRole('heading', { name: 'Соответствие' })).toBeVisible();
  expect(screen.getByRole('combobox', { name: 'Ответ для А: Соответствие' })).toHaveValue('one');
  expect(studentWorksApi.finish).not.toHaveBeenCalled();
});
