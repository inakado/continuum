import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import type { AssessmentWorkDetail } from '@continuum/shared';
import WorkEditor from './WorkEditor';
import { teacherWorksApi } from './teacher-works.api';
import { ApiError } from '@/lib/api/client';
import { authApi } from '@/lib/auth/client';

const navigation = vi.hoisted(() => ({ push: vi.fn(), logout: vi.fn() }));
vi.mock('@/components/ContinuumHeader', () => ({ default: ({ beforeLogout }: { beforeLogout?: () => Promise<boolean> }) => <button onClick={() => { void beforeLogout?.().then((allowed) => { if (allowed) navigation.logout(); }); }}>Выйти из профиля</button> }));
vi.mock('@/features/auth/useAuthSession', () => ({ useAuthSession: () => ({ data: { user: { id: 'teacher', login: 'teacher1', role: 'teacher' } } }) }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
vi.mock('./teacher-works.api', () => ({ teacherWorksApi: { update: vi.fn(), freeze: vi.fn() } }));
vi.mock('@/lib/auth/client', () => ({ authApi: { signIn: vi.fn(), signOut: vi.fn() } }));
const initial: AssessmentWorkDetail = {
  id: '00000000-0000-4000-8000-000000000001', title: 'МКТ', instructions: '', gradeBand: 'grade_10_11', revision: 1, taskCount: 3, maxPoints: 3, updatedAt: '2026-10-17T00:00:00Z',
  items: ['Давление', 'Температура', 'Объём'].map((title, index) => ({ id: `00000000-0000-4000-8000-00000000000${index + 2}`, version: 1, statement: 'Условие задачи.', solution: null, images: {}, task: { id: `sample-${index}`, title, gradeBand: 'grade_10_11', topicPath: ['МКТ'], maxPoints: 1, source: { provider: 'Авторское' }, type: 'short_number', grading: { answer: '42', absoluteTolerance: 0 } } })),
};
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function setup(onReload = vi.fn().mockResolvedValue(undefined)) {
  vi.mocked(teacherWorksApi.update).mockImplementation(async (_id, body) => ({ ...initial, ...body, revision: body.expectedRevision + 1, items: body.items.map((ref) => initial.items.find((item) => item.id === ref.taskId)!) }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><WorkEditor initial={initial} onReload={onReload} /></QueryClientProvider>);
}
const titles = () => within(screen.getByRole('list', { name: 'Задания работы' })).getAllByRole('button', { expanded: false }).filter((element) => element.querySelector('strong')).map((element) => element.querySelector('strong')!.textContent);

it('flushes before debounce and waits before returning, ignoring repeated navigation', async () => {
  setup();
  expect(screen.queryByText(/Черновик|Не назначена|Назначена/)).not.toBeInTheDocument();
  let saved!: (work: AssessmentWorkDetail) => void;
  vi.mocked(teacherWorksApi.update).mockImplementation(() => new Promise((resolve) => { saved = resolve; }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Название работы' }), { target: { value: 'Изменение' } });
  fireEvent.click(screen.getByRole('button', { name: 'К работам' }));
  await waitFor(() => expect(teacherWorksApi.update).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('link', { name: 'Банк заданий' }));
  expect(navigation.push).not.toHaveBeenCalled();
  saved({ ...initial, title: 'Изменение', revision: 2 });
  await waitFor(() => expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/teacher/works'));
});

it('waits for saving before logout through the shared header', async () => {
  setup();
  let saved!: (work: AssessmentWorkDetail) => void;
  vi.mocked(teacherWorksApi.update).mockImplementation(() => new Promise((resolve) => { saved = resolve; }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Название работы' }), { target: { value: 'Выход' } });
  fireEvent.click(screen.getByRole('button', { name: 'Выйти из профиля' }));
  await waitFor(() => expect(teacherWorksApi.update).toHaveBeenCalledOnce());
  expect(navigation.logout).not.toHaveBeenCalled();
  saved({ ...initial, title: 'Выход', revision: 2 });
  await waitFor(() => expect(navigation.logout).toHaveBeenCalledOnce());
});

it('keeps unsaved input after failure and explicitly discards only when leaving is confirmed', async () => {
  setup();
  vi.mocked(teacherWorksApi.update).mockRejectedValue(new Error('offline'));
  fireEvent.change(screen.getByRole('textbox', { name: 'Название работы' }), { target: { value: 'Изменение' } });
  fireEvent.click(screen.getByRole('button', { name: 'К работам' }));
  await screen.findByRole('dialog', { name: 'Изменения ещё не сохранены' });
  fireEvent.click(screen.getByRole('button', { name: 'Остаться' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(navigation.push).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox', { name: 'Название работы' })).toHaveValue('Изменение');
  fireEvent.click(screen.getByRole('link', { name: 'Банк заданий' }));
  await screen.findByRole('dialog', { name: 'Изменения ещё не сохранены' });
  fireEvent.click(screen.getByRole('button', { name: 'Выйти без сохранения' }));
  await waitFor(() => expect(navigation.push).toHaveBeenCalledOnce());
  expect(navigation.push).toHaveBeenCalledWith('/teacher/bank');
});

it('retries the same failed save from the leave dialog and then navigates once', async () => {
  setup();
  vi.mocked(teacherWorksApi.update).mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ ...initial, title: 'Повтор', revision: 2 });
  fireEvent.change(screen.getByRole('textbox', { name: 'Название работы' }), { target: { value: 'Повтор' } });
  fireEvent.click(screen.getByRole('link', { name: 'Банк заданий' }));
  const dialog = await screen.findByRole('dialog', { name: 'Изменения ещё не сохранены' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Повторить сохранение' }));
  await waitFor(() => expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/teacher/bank'));
  expect(vi.mocked(teacherWorksApi.update).mock.calls[1][1]).toEqual(vi.mocked(teacherWorksApi.update).mock.calls[0][1]);
});

it('does not discard the editor on cancellation or a failed conflict reload', async () => {
  const reload = vi.fn().mockRejectedValue(new ApiError(503, 'Сервис недоступен'));
  setup(reload);
  vi.mocked(teacherWorksApi.update).mockRejectedValue(new ApiError(409, 'Работа изменена'));
  fireEvent.change(screen.getByRole('textbox', { name: 'Название работы' }), { target: { value: 'Мой ввод' } });
  fireEvent.click(await screen.findByRole('button', { name: 'Загрузить актуальную работу' }));
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(reload).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Загрузить актуальную работу' }));
  fireEvent.click(screen.getByRole('button', { name: 'Загрузить работу' }));
  expect(await within(screen.getByRole('alertdialog')).findByRole('alert')).toHaveTextContent('Сервис недоступен');
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(screen.getByRole('textbox', { name: 'Название работы' })).toHaveValue('Мой ввод');
});

it('restores the same teacher session and retries the pending save before leaving', async () => {
  setup();
  vi.mocked(teacherWorksApi.update).mockRejectedValueOnce(new ApiError(401, 'Войдите')).mockResolvedValueOnce({ ...initial, title: 'Сохранить после входа', revision: 2 });
  vi.mocked(authApi.signIn).mockResolvedValue({ user: { id: 'teacher', login: 'teacher1', name: 'Преподаватель', role: 'teacher' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Название работы' }), { target: { value: 'Сохранить после входа' } });
  fireEvent.click(screen.getByRole('button', { name: 'К работам' }));
  const dialog = await screen.findByRole('dialog', { name: 'Изменения ещё не сохранены' });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Войти и сохранить' }));
  const login = await screen.findByRole('dialog', { name: 'Войдите, чтобы сохранить работу' });
  fireEvent.change(within(login).getByLabelText('Пароль для сохранения работы'), { target: { value: 'test-only' } });
  fireEvent.click(within(login).getByRole('button', { name: 'Войти и сохранить' }));
  await waitFor(() => expect(navigation.push).toHaveBeenCalledExactlyOnceWith('/teacher/works'));
  expect(vi.mocked(teacherWorksApi.update).mock.calls[1][1]).toEqual(vi.mocked(teacherWorksApi.update).mock.calls[0][1]);
});

it('explains tasks skipped from a copy without blocking the remaining draft', () => {
  const client = new QueryClient();
  render(<QueryClientProvider client={client}><WorkEditor initial={{ ...initial, copySkippedTaskCount: 2 }} onReload={vi.fn()} /></QueryClientProvider>);
  expect(screen.getByRole('note')).toHaveTextContent('При создании копии пропущено заданий: 2. Они удалены из банка.');
  expect(titles()).toEqual(['Давление', 'Температура', 'Объём']);
});

it('supports accessible reordering, undo removal and a preview without answer keys', async () => {
  setup();
  fireEvent.keyDown(screen.getByRole('button', { name: 'Переместить задание 1' }), { key: 'ArrowDown' });
  expect(titles()).toEqual(['Температура', 'Давление', 'Объём']);
  await waitFor(() => expect(teacherWorksApi.update).toHaveBeenCalled(), { timeout: 1500 });
  fireEvent.click(screen.getByRole('button', { name: 'Действия с заданием 2' }));
  // Radix opens menus on pointer-down rather than click.
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Действия с заданием 2' }), { button: 0, ctrlKey: false, pointerType: 'mouse' });
  const remove = await screen.findByRole('menuitem', { name: 'Убрать из работы' });
  fireEvent.click(remove);
  expect(titles()).toEqual(['Температура', 'Объём']);
  fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
  expect(titles()).toEqual(['Температура', 'Давление', 'Объём']);
  fireEvent.click(screen.getByRole('button', { name: 'Просмотр работы' }));
  expect(screen.getAllByText('Условие задачи.')).toHaveLength(1);
  expect(screen.getAllByRole('button', { name: /^Задание \d+:/ })).toHaveLength(3);
  expect(screen.queryByText('42')).not.toBeInTheDocument();
  expect(screen.queryByText('Ответ и проверка')).not.toBeInTheDocument();
});

it('moves a task by the drag handle and renumbers the persisted references', async () => {
  setup();
  const dataTransfer = { effectAllowed: '', dropEffect: '', setData: vi.fn(), setDragImage: vi.fn() };
  const list = screen.getByRole('list', { name: 'Задания работы' });
  fireEvent.dragStart(screen.getByRole('button', { name: 'Переместить задание 1' }), { dataTransfer });
  const target = list.children[2];
  const over = new MouseEvent('dragover', { bubbles: true, clientY: 10 });
  Object.defineProperty(over, 'dataTransfer', { value: dataTransfer });
  fireEvent(target, over);
  fireEvent.drop(target, { dataTransfer });
  expect(titles()).toEqual(['Температура', 'Объём', 'Давление']);
  await waitFor(() => expect(teacherWorksApi.update).toHaveBeenCalled(), { timeout: 1500 });
  expect(vi.mocked(teacherWorksApi.update).mock.calls[0][1].items.map((item) => item.taskId)).toEqual([initial.items[1].id, initial.items[2].id, initial.items[0].id]);
});

it('opens the existing editor with title focus after creating from an import', () => {
  const previous = location.href;
  history.replaceState({}, '', `/teacher/works/${initial.id}?from=import`);
  setup();
  const title = screen.getByRole('textbox', { name: 'Название работы' }) as HTMLInputElement;
  expect(title).toHaveFocus();
  expect(title.selectionStart).toBe(0); expect(title.selectionEnd).toBe(initial.title.length);
  expect(titles()).toEqual(['Давление', 'Температура', 'Объём']);
  expect(teacherWorksApi.freeze).not.toHaveBeenCalled();
  history.replaceState({}, '', previous);
});
