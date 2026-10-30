import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render as baseRender, screen, within, waitFor } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import TeacherBankScreen from './TeacherBankScreen';

const state = vi.hoisted(() => ({ query: {} as Record<string, unknown>, viewedId: '', empty: false, viewError: false, refetch: vi.fn() }));
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (listener: () => void) => { window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener); };
  return { useSearchParams: () => new URLSearchParams(useSyncExternalStore(subscribe, () => window.location.search)) };
});
beforeEach(() => {
  state.empty = false;
  state.viewError = false; state.refetch.mockClear();
  history.replaceState({}, '', '/teacher/bank');
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method].bind(history);
    vi.spyOn(history, method).mockImplementation((data, unused, url) => { original(data, unused, url); window.dispatchEvent(new PopStateEvent('popstate')); });
  }
});
vi.mock('@/components/ContinuumHeader', () => ({ default: () => null }));
vi.mock('./BankTaskCorrection', () => ({ default: ({ task, onClose }: { task: { task: { title: string } }; onClose: () => void }) => <div role="dialog" aria-label="Исправить условие"><p>{task.task.title}</p><button onClick={onClose}>Закрыть исправление</button></div> }));
vi.mock('@/components/assessment/AssessmentMarkdown', () => ({ default: ({ text }: { text: string }) => <div>{text}</div> }));
vi.mock('./use-teacher-bank', () => {
  const source = { provider: 'Школково', externalId: '11121', taskNumber: 86, sectionCode: '7.05', examYear: 2026, examTaskNumber: 7 };
  const tasks = ['Давление газа', 'Температура'].map((title, index) => ({ id: `00000000-0000-4000-8000-00000000000${index}`, stableId: `sample-${index}`, title, source, version: 1, gradeBand: 'grade_10_11', topicPath: ['МКТ'], type: 'short_number', maxPoints: 1, excerpt: 'Условие задачи' }));
  return {
    useRemoveBankTask: () => ({ isPending: false, error: null, reset: vi.fn(), mutate: vi.fn() }),
    useTeacherBank: (query: Record<string, unknown>) => { state.query = query; return { data: { tasks: state.empty ? [] : tasks, total: state.empty ? 0 : 2, topics: ['МКТ', 'Механика', 'Баллистика'], topicPaths: [['МКТ'], ['Механика', 'Кинематика', 'Баллистика']], sources: ['Авторское', 'Школково'], pageSize: 50 }, isPending: false }; },
    useTeacherBankTask: (id: string) => { state.viewedId = id; return { error: state.viewError ? new Error('Ошибка условия') : null, refetch: state.refetch, data: { id, version: 1, lifecycleRevision: 1, task: { ...tasks[id === tasks[1].id ? 1 : 0], type: 'short_number', grading: { answer: '4.83', absoluteTolerance: 0 }, unit: 'Па' }, statement: 'Найдите давление.', solution: null, images: {} } }; },
  };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it('keeps the correction dialog when the task no longer matches the bank search', async () => {
  const user = userEvent.setup(); render(<TeacherBankScreen />);
  await user.click(screen.getByRole('button', { name: 'Действия с заданием' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Исправить условие' }));
  expect(screen.getByRole('dialog', { name: 'Исправить условие' })).toHaveTextContent('Давление газа');
  state.empty = true;
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'исправленная фраза' } });
  expect(screen.getByRole('heading', { name: 'Ничего не найдено' })).toBeInTheDocument();
  expect(screen.getByRole('dialog', { name: 'Исправить условие' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Закрыть исправление' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('retries only the selected task without losing its URL context', () => {
  state.viewError = true;
  history.replaceState({}, '', '/teacher/bank?exam=ege&source=Школково&task=00000000-0000-4000-8000-000000000001');
  render(<TeacherBankScreen />);
  const url = location.search;
  fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку условия' }));
  expect(state.refetch).toHaveBeenCalledTimes(1);
  expect(state.viewedId).toBe('00000000-0000-4000-8000-000000000001');
  expect(location.search).toBe(url);
});
it('keeps source visible and separates collection, source section and EGE numbers', () => {
  render(<TeacherBankScreen />);
  const list = screen.getByRole('list', { name: 'Задания банка' });
  expect(within(list).getAllByText('Школково · № 11121')).toHaveLength(2);
  fireEvent.click(screen.getByText('Источник и сведения'));
  expect(screen.getByText('Правило оценивания')).toBeVisible();
  expect(screen.getByText('Полное совпадение')).toBeVisible();
  expect(screen.getAllByText('Числовой ответ').length).toBeGreaterThan(0);
  expect(screen.getByText('Номер задачи в подразделе')).toBeVisible();
  expect(screen.getByText('86')).toBeVisible();
  expect(screen.getByText('Код подраздела')).toBeVisible();
  expect(screen.getByText('7.05')).toBeVisible();
  expect(screen.getByText('Номер задания ЕГЭ')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Следующая' }));
  expect(screen.getByRole('heading', { name: 'Температура' })).toBeVisible();
});
it('passes grade and search filters to the server-state layer', () => {
  render(<TeacherBankScreen />);
  fireEvent.click(screen.getByRole('button', { name: '8 класс' }));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: '11121' } });
  expect(state.query).toMatchObject({ gradeBand: 'grade_8', search: '11121', page: 1 });
});
it('filters by a subject section or topic while preserving exam and source filters', () => {
  history.replaceState({}, '', '/teacher/bank?exam=none&source=Авторское');
  render(<TeacherBankScreen />);
  fireEvent.click(screen.getByRole('button', { name: 'Все разделы и темы' }));
  fireEvent.click(screen.getByRole('button', { name: /^Механика/ }));
  expect(state.query.topicPath).toBeUndefined();
  fireEvent.click(screen.getByRole('button', { name: /^Кинематика/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Баллистика' }));
  expect(state.query).toMatchObject({ topicPath: ['Механика', 'Кинематика', 'Баллистика'], topic: '', exam: 'none', source: 'Авторское', page: 1 });
});
it('clears only the search and returns keyboard focus without losing other filters', () => {
  history.replaceState({}, '', '/teacher/bank?search=ма&topic=МКТ&exam=ege&source=Школково');
  render(<TeacherBankScreen />);
  const clear = screen.getByRole('button', { name: 'Очистить поиск' });
  expect(clear).toBeEnabled();
  fireEvent.click(clear);
  expect(screen.getByRole('searchbox')).toHaveValue('');
  expect(screen.getByRole('searchbox')).toHaveFocus();
  expect(state.query).toMatchObject({ search: '', topic: 'МКТ', exam: 'ege', source: 'Школково', page: 1 });
  expect(new URLSearchParams(location.search).has('search')).toBe(false);
  expect(clear).toBeDisabled();
});
it('expands the reading area without losing the selected task', () => {
  render(<TeacherBankScreen />);
  fireEvent.click(screen.getByRole('button', { name: 'Следующая' }));
  fireEvent.click(screen.getByRole('button', { name: 'Развернуть задание' }));
  expect(screen.getByRole('button', { name: 'Вернуть список' })).toHaveAttribute('aria-expanded', 'true');
  expect(screen.getByRole('heading', { name: 'Температура' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Вернуть список' }));
  expect(screen.getByRole('heading', { name: 'Температура' })).toBeVisible();
});
it('preserves the list scroll and navigation focus while opening another condition from the top', () => {
  render(<TeacherBankScreen />);
  const list = screen.getByRole('list', { name: 'Задания банка' });
  const condition = screen.getByRole('region', { name: 'Условие выбранного задания' });
  const next = screen.getByRole('button', { name: 'Следующая' });
  list.scrollTop = 180;
  condition.scrollTop = 120;
  next.focus();
  fireEvent.click(next);
  expect(screen.getByRole('heading', { name: 'Температура' })).toBeVisible();
  expect(screen.getByRole('list', { name: 'Задания банка' })).toBe(list);
  expect(list.scrollTop).toBe(180);
  expect(screen.getByRole('region', { name: 'Условие выбранного задания' }).scrollTop).toBe(0);
  expect(screen.getByRole('button', { name: 'Следующая' })).toBe(next);
  expect(next).toHaveFocus();
});
it('keeps source options available in an empty result and resets both filters', () => {
  state.empty = true;
  history.replaceState({}, '', '/teacher/bank?exam=none&source=Авторское');
  render(<TeacherBankScreen />);
  expect(screen.getByRole('heading', { name: 'Ничего не найдено' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Фильтры/ }));
  expect(screen.getByRole('option', { name: 'Школково' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Закрыть фильтр' }));
  fireEvent.click(screen.getByRole('button', { name: 'Сбросить фильтры' }));
  fireEvent.click(screen.getByRole('button', { name: /Фильтры/ }));
  expect(location.search).toBe('');
  expect(screen.getByRole('combobox', { name: 'ЕГЭ / не ЕГЭ' })).toHaveValue('');
  expect(screen.getByRole('combobox', { name: 'Источник' })).toHaveValue('');
});
it('combines exam and exact source filters, resets selection and restores them on return', async () => {
  const view = render(<TeacherBankScreen />);
  fireEvent.click(screen.getByRole('button', { name: 'Следующая' }));
  fireEvent.click(screen.getByRole('button', { name: /Фильтры/ }));
  fireEvent.change(screen.getByRole('combobox', { name: 'ЕГЭ / не ЕГЭ' }), { target: { value: 'ege' } });
  fireEvent.change(screen.getByRole('combobox', { name: 'Источник' }), { target: { value: 'Школково' } });
  fireEvent.click(screen.getByRole('button', { name: 'Показать задачи' }));
  expect(state.query).toMatchObject({ exam: 'ege', source: 'Школково', page: 1 });
  expect(new URLSearchParams(location.search).has('task')).toBe(false);
  view.unmount(); render(<TeacherBankScreen />);
  fireEvent.click(screen.getByRole('button', { name: /Фильтры/ }));
  expect(screen.getByRole('combobox', { name: 'ЕГЭ / не ЕГЭ' })).toHaveValue('ege');
  expect(screen.getByRole('combobox', { name: 'Источник' })).toHaveValue('Школково');
  fireEvent.click(screen.getByRole('button', { name: 'Закрыть фильтр' }));
  act(() => history.back());
  await waitFor(() => expect(state.query.source).toBeUndefined());
  act(() => history.forward());
  await waitFor(() => expect(state.query.source).toBe('Школково'));
});

it('restores the selected task on remount, Back and Forward without changing the API query', async () => {
  const view = render(<TeacherBankScreen />);
  fireEvent.click(screen.getByRole('button', { name: 'Следующая' }));
  expect(location.search).toBe('?task=00000000-0000-4000-8000-000000000001');
  expect(state.query).not.toHaveProperty('taskId');
  view.unmount(); render(<TeacherBankScreen />);
  expect(screen.getByRole('heading', { name: 'Температура' })).toBeVisible();
  act(() => history.back());
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Давление газа' })).toBeVisible());
  act(() => history.forward());
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Температура' })).toBeVisible());
  fireEvent.click(screen.getByRole('button', { name: /Фильтры/ }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Тип задания' }), { target: { value: 'short_number' } });
  fireEvent.click(screen.getByRole('button', { name: 'Показать задачи' }));
  expect(new URLSearchParams(location.search).has('task')).toBe(false);
});

it('clears an unavailable selected task and returns to the list without requesting the missing task', () => {
  history.replaceState({}, '', '/teacher/bank?task=00000000-0000-4000-8000-000000000099');
  render(<TeacherBankScreen />);
  expect(screen.getByRole('heading', { name: 'Давление газа' })).toBeVisible();
  expect(location.search).toBe('');
  expect(state.viewedId).toBe('00000000-0000-4000-8000-000000000000');
});

it('supports a reload into the mobile preview and returning to the list with the existing control', () => {
  history.replaceState({}, '', '/teacher/bank?task=00000000-0000-4000-8000-000000000001');
  render(<TeacherBankScreen />);
  const preview = screen.getByRole('region', { name: 'Просмотр задания' });
  expect(preview.parentElement?.className).toContain('showPreview');
  fireEvent.click(screen.getByRole('button', { name: 'К списку' }));
  expect(preview.parentElement?.className).not.toContain('showPreview');
  expect(location.search).toBe('');
});

function render(ui: Parameters<typeof baseRender>[0]) { return baseRender(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{ui}</QueryClientProvider>); }

it('does not treat the default desktop preview as an explicit mobile task choice', () => {
  render(<TeacherBankScreen />);
  const list = screen.getByRole('list', { name: 'Задания банка' });
  expect(within(list).queryByRole('button', { pressed: true })).not.toBeInTheDocument();
  expect(list.querySelector('[data-preview-current="true"]')).not.toBeNull();
  const row = within(list).getAllByRole('button')[1];
  fireEvent.click(row);
  expect(row).toHaveAttribute('aria-pressed', 'true');
  expect(within(list).getAllByRole('checkbox').every(input => !(input as HTMLInputElement).checked)).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'К списку' }));
  expect(within(list).queryByRole('button', { pressed: true })).not.toBeInTheDocument();
});
