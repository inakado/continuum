import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { AssessmentTaskView } from '@continuum/shared';
import WorkBankPicker from './WorkBankPicker';
import { teacherBankApi } from '@/features/teacher-bank/teacher-bank.api';

const fixture = vi.hoisted(() => ({ failed: false, version: 1 }));
vi.mock('@/features/teacher-bank/BankTaskPreview', () => ({ default: ({ data }: { data: { id: string; version: number } }) => <p>Условие {data.id}, версия {data.version}</p> }));
vi.mock('@/features/teacher-bank/teacher-bank.api', () => ({ teacherBankApi: { view: vi.fn(async (id: string, version: number) => ({ id, version })) } }));
vi.mock('@/features/teacher-bank/use-teacher-bank', () => ({
  useTeacherBank: ({ search, page }: { search: string; page: number }) => ({
    data: { tasks: [{ id: search ? 'b' : page === 2 ? 'c' : 'a', version: search ? 2 : fixture.version,
      title: search ? 'Температура' : page === 2 ? 'Магнитное поле' : 'Давление', topicPath: [search ? 'Термодинамика' : 'Основы МКТ'], source: { provider: 'Авторское', externalId: search ? '22' : '11' }, maxPoints: search ? 2 : 1 }], topics: [], total: 51 },
    isPending: false, error: fixture.failed ? new Error('Сеть недоступна') : null, refetch: vi.fn(),
  }),
  useTeacherBankTask: (id: string | null, version?: number) => ({ data: { id, version }, isPending: false, refetch: vi.fn() }),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); fixture.failed = false; fixture.version = 1; });

it('reviews selections across filters and pages, removes a check and adds only the remaining pinned versions', async () => {
  const add = vi.fn();
  render(<WorkBankPicker existing={[]} grade="grade_10_11" onClose={vi.fn()} onAdd={add} />);
  expect(screen.queryByRole('group', { name: 'Режим выбора заданий' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Посмотреть' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Добавить в работу' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Выбрать: Давление' }));
  fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Выбрать: Магнитное поле' }));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Температура' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Выбрать: Температура' }));
  fireEvent.click(screen.getByRole('button', { name: 'Посмотреть' }));
  expect(screen.getByRole('heading', { name: 'Выбранные задания' })).toHaveFocus();
  expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Далее' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  expect(screen.getByText('Термодинамика')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: /Давление/ }));
  expect(screen.getByText('Условие a, версия 1')).toBeVisible();
  fireEvent.click(screen.getByRole('checkbox', { name: 'Выбрать: Давление' }));
  expect(screen.queryByRole('checkbox', { name: 'Выбрать: Давление' })).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Выбрано 2 задания · 3 балла');
  fireEvent.click(screen.getByRole('button', { name: 'К банку' }));
  expect(screen.getByRole('heading', { name: 'Добавить из банка' })).toHaveFocus();
  expect(screen.getByRole('searchbox')).toHaveValue('Температура');
  expect(screen.getByRole('checkbox', { name: 'Выбрать: Температура' })).toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'Добавить в работу' }));
  await waitFor(() => expect(add).toHaveBeenCalledWith([{ id: 'c', version: 1 }, { id: 'b', version: 2 }]));
});

it('keeps the selected revision for preview even if the bank changes, and can review during a bank error', () => {
  const props = { existing: [], grade: 'grade_10_11' as const, onClose: vi.fn(), onAdd: vi.fn() };
  const view = render(<WorkBankPicker {...props} />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Выбрать: Давление' }));
  fixture.version = 2;
  fixture.failed = true;
  fireEvent.click(screen.getByRole('button', { name: 'Посмотреть' }));
  view.rerender(<WorkBankPicker {...props} />);
  expect(screen.getByText('Условие a, версия 1')).toBeVisible();
  expect(screen.getByRole('checkbox', { name: 'Выбрать: Давление' })).toBeChecked();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(teacherBankApi.view).not.toHaveBeenCalled();
});

it('does not count existing work items and stays in an actionable empty selection after clearing', () => {
  const existing = { id: 'a' } as AssessmentTaskView;
  render(<WorkBankPicker existing={[existing]} grade="grade_10_11" onClose={vi.fn()} onAdd={vi.fn()} />);
  expect(screen.getByRole('checkbox', { name: 'Выбрать: Давление' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: 'Посмотреть' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Температура' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Выбрать: Температура' }));
  fireEvent.click(screen.getByRole('button', { name: 'Посмотреть' }));
  fireEvent.click(screen.getByRole('button', { name: 'Сбросить выбор' }));
  expect(screen.getByRole('heading', { name: 'Выбранные задания' })).toBeVisible();
  expect(screen.getByText('Ничего не выбрано')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Добавить в работу' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'К банку' }));
  expect(screen.getByRole('searchbox')).toHaveValue('Температура');
});

it('keeps an empty review after removing the last checkbox and returns to the bank without closing the picker', () => {
  const close = vi.fn();
  render(<WorkBankPicker existing={[]} grade="grade_10_11" onClose={close} onAdd={vi.fn()} />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Выбрать: Давление' }));
  fireEvent.click(screen.getByRole('button', { name: 'Посмотреть' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Выбрать: Давление' }));
  expect(screen.getByText('Ничего не выбрано')).toBeVisible();
  expect(screen.getByRole('heading', { name: 'Выбранные задания' })).toBeVisible();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'К банку' }));
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByRole('checkbox', { name: 'Выбрать: Давление' })).not.toBeChecked();
  fireEvent.click(screen.getByRole('button', { name: 'К работе' }));
  expect(close).toHaveBeenCalledOnce();
});

it('keeps the selection and shows a recoverable error when adding fails, without requiring a review', async () => {
  vi.mocked(teacherBankApi.view).mockRejectedValueOnce(new TypeError('Failed to fetch'));
  const add = vi.fn();
  render(<WorkBankPicker existing={[]} grade="grade_10_11" onClose={vi.fn()} onAdd={add} />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Выбрать: Давление' }));
  fireEvent.click(screen.getByRole('button', { name: 'Добавить в работу' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось добавить задания. Повторите попытку.');
  expect(screen.getByRole('status')).toHaveTextContent('Выбрано 1 задание · 1 балл');
  expect(screen.getByRole('checkbox', { name: 'Выбрать: Давление' })).toBeChecked();
  expect(screen.getByRole('heading', { name: 'Добавить из банка' })).toBeVisible();
  expect(add).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Добавить в работу' }));
  await waitFor(() => expect(add).toHaveBeenCalledWith([{ id: 'a', version: 1 }]));
});
