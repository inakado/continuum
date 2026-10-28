import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { StudentWorkDetail } from '@continuum/shared';
import StudentWorkScreen from './StudentWorkScreen';
import { studentWorksApi } from './student-works.api';
import { studentWorkQueryKeys } from '@/lib/query/keys';
import { ApiError } from '@/lib/api/client';
import { solutionsApi } from '@/lib/assessment/solutions.api';

vi.mock('@/components/ContinuumHeader', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/features/auth/useAuthSession', () => ({ useAuthSession: () => ({ data: { user: { id: 'student', login: 'student1' } } }) }));
vi.mock('./student-works.api', () => ({ studentWorksApi: { detail: vi.fn(), start: vi.fn(), save: vi.fn(), finish: vi.fn(), availability: vi.fn(), list: vi.fn() } }));
vi.mock('@/lib/assessment/solutions.api', () => ({ solutionsApi: { list: vi.fn(), upload: vi.fn(), remove: vi.fn() } }));
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
beforeEach(() => { vi.mocked(studentWorksApi.availability).mockResolvedValue({ id }); });

it('refreshes corrected text without resetting a pending answer or focus', async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(studentWorksApi.detail).mockResolvedValue({ ...started, presentationRevision: 'a'.repeat(64) });
  vi.mocked(studentWorksApi.availability).mockResolvedValue({ id, presentationRevision: 'a'.repeat(64) });
  vi.mocked(studentWorksApi.save).mockReturnValue(new Promise(() => {}));
  show(cache);
  const input = await screen.findByRole('textbox', { name: 'Ответ: Давление' });
  input.focus(); fireEvent.change(input, { target: { value: '7' } });
  vi.mocked(studentWorksApi.detail).mockResolvedValue({ ...started, presentationRevision: 'b'.repeat(64), items: [{ ...initial.items[0], statement: 'Исправленное условие газа.' }] });
  vi.mocked(studentWorksApi.availability).mockResolvedValue({ id, presentationRevision: 'b'.repeat(64) });
  await cache.invalidateQueries({ queryKey: studentWorkQueryKeys.availability(id) });
  await screen.findByText('Исправленное условие газа.');
  expect(input).toHaveValue('7'); expect(input).toHaveFocus();
  expect(studentWorksApi.start).not.toHaveBeenCalled(); expect(studentWorksApi.finish).not.toHaveBeenCalled();
});

it('does not loop detail reads when the availability response is older than the detail', async () => {
  vi.mocked(studentWorksApi.detail).mockResolvedValue({ ...started, presentationRevision: 'b'.repeat(64) });
  vi.mocked(studentWorksApi.availability).mockResolvedValue({ id, presentationRevision: 'a'.repeat(64) });
  show(); await screen.findByRole('textbox', { name: 'Ответ: Давление' });
  await waitFor(() => expect(studentWorksApi.detail).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(screen.getByRole('textbox', { name: 'Ответ: Давление' })).toBeEnabled());
  expect(studentWorksApi.detail).toHaveBeenCalledTimes(2);
});

it('shows saved points without verbal labels when a work has partial scores', async () => {
  vi.mocked(studentWorksApi.detail).mockResolvedValue({ ...started, ...completed, result: { correctCount: 0, partialCount: 1, incorrectCount: 0, points: 1, maxPoints: 2 } });
  show();
  expect(await screen.findByText('Баллы: 1 из 2')).toBeVisible();
  expect(screen.getByText('Баллы: 1 из 2')).toHaveAttribute('data-score', 'partial');
  expect(screen.queryByText(/Частично|Верно:|Неверно:/)).not.toBeInTheDocument();
  expect(studentWorksApi.finish).not.toHaveBeenCalled();
});

it('removes the player and cached answers when an open work is no longer available', async () => {
  const cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  vi.mocked(studentWorksApi.detail).mockResolvedValue(started);
  show(cache);
  const input = await screen.findByRole('textbox', { name: 'Ответ: Давление' });
  fireEvent.change(input, { target: { value: '7' } });
  vi.mocked(studentWorksApi.availability).mockRejectedValue(new ApiError(404, 'Недоступна'));
  await cache.invalidateQueries({ queryKey: studentWorkQueryKeys.availability(id) });
  expect(await screen.findByRole('heading', { name: 'Работа больше недоступна' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Работа больше недоступна' })).toHaveFocus();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByText(initial.instructions)).not.toBeInTheDocument();
  expect(cache.getQueryData(studentWorkQueryKeys.detail(id))).toBeUndefined();
  expect(screen.getByRole('link', { name: 'К работам' })).toHaveAttribute('href', '/student/works');
});

it('does not hide an open work or its input merely because the availability check is offline', async () => {
  vi.mocked(studentWorksApi.detail).mockResolvedValue(started);
  vi.mocked(studentWorksApi.availability).mockRejectedValue(new TypeError('offline'));
  show();
  expect(await screen.findByRole('textbox', { name: 'Ответ: Давление' })).toBeEnabled();
  expect(screen.queryByRole('heading', { name: 'Работа больше недоступна' })).not.toBeInTheDocument();
});

it('hides a revoked work after a save returns 404, rather than retaining a retryable editor', async () => {
  vi.mocked(studentWorksApi.detail).mockResolvedValue(started);
  vi.mocked(studentWorksApi.save).mockRejectedValue(new ApiError(404, 'Недоступна'));
  show();
  fireEvent.change(await screen.findByRole('textbox', { name: 'Ответ: Давление' }), { target: { value: '8' } });
  expect(await screen.findByRole('heading', { name: 'Работа больше недоступна' })).toBeVisible();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
});

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
  show();
  fireEvent.change(await screen.findByRole('textbox', { name: 'Ответ: Давление' }), { target: { value: '7' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Загрузить сохранённую работу' }));
  expect(studentWorksApi.detail).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Загрузить ответы' }));
  await waitFor(() => expect(studentWorksApi.detail).toHaveBeenCalledTimes(2));
  await screen.findByText('Не удалось загрузить сохранённую работу. Изменения этой вкладки сохранены на экране.');
  expect(screen.getByRole('alertdialog')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
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

it('keeps photo answers available after completing the automatic part without reopening test answers', async () => {
  const photoTaskId = '00000000-0000-4000-8000-000000000004';
  vi.mocked(studentWorksApi.detail).mockResolvedValue({ ...started, ...completed, taskCount: 2, automaticTaskCount: 1, extendedTaskCount: 1,
    items: [...started.items, { id: photoTaskId, title: 'Работа газа', type: 'extended', maxPoints: 2, statement: 'Найдите работу газа.', images: {} }] });
  vi.mocked(solutionsApi.list).mockResolvedValue([{ taskId: photoTaskId, title: 'Работа газа', maxPoints: 2, revision: 0, photos: [], locked: false }]);
  show();
  await screen.findByText('Тестовая часть завершена');
  expect(screen.getByRole('textbox', { name: 'Ответ: Давление' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Задание 2: без ответа' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Добавить фото' })).toBeEnabled());
  expect(screen.queryByRole('button', { name: 'Завершить тестовую часть' })).not.toBeInTheDocument();
});

it('does not require final submission for a photo-only work', async () => {
  vi.mocked(studentWorksApi.detail).mockResolvedValue({ ...started, automaticTaskCount: 0, extendedTaskCount: 1,
    items: [{ id: taskId, title: 'Работа газа', type: 'extended', maxPoints: 2, statement: 'Найдите работу.', images: {} }] });
  vi.mocked(solutionsApi.list).mockResolvedValue([{ taskId, title: 'Работа газа', maxPoints: 2, revision: 0, photos: [], locked: false }]);
  show();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Добавить фото' })).toBeEnabled());
  expect(screen.queryByRole('button', { name: /Завершить/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/Сохранено ответов/)).not.toBeInTheDocument();
});
