import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import TeacherBankScreen from './TeacherBankScreen';

const task = vi.hoisted(() => ({ id: '00000000-0000-4000-8000-000000000001', stableId: 'sample', title: 'Давление газа', lifecycleRevision: 1, version: 1, source: { provider: 'Школково' }, gradeBand: 'grade_10_11', topicPath: ['МКТ'], type: 'short_number', maxPoints: 1 }));
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  return { useSearchParams: () => new URLSearchParams(useSyncExternalStore(listener => { window.addEventListener('popstate', listener); return () => window.removeEventListener('popstate', listener); }, () => location.search)) };
});
vi.mock('@/components/ContinuumHeader', () => ({ default: () => null }));
vi.mock('@/components/assessment/AssessmentMarkdown', () => ({ default: ({ text }: { text: string }) => <p>{text}</p> }));
vi.mock('./BankTaskCorrection', () => ({ default: ({ onClose }: { onClose: () => void }) => <div role="dialog" aria-label="Исправить задачу"><button onClick={onClose}>Закрыть исправление</button></div> }));
vi.mock('./use-teacher-bank', async importOriginal => ({
  ...await importOriginal<typeof import('./use-teacher-bank')>(),
  useTeacherBank: () => ({ data: { tasks: [task], total: 1, pageSize: 50, topicPaths: [['МКТ']], sources: ['Школково'] }, isPending: false }),
  useTeacherBankTask: () => ({ data: { id: task.id, version: 1, lifecycleRevision: 1, createdAt: '2026-11-13T12:00:00.000Z', task: { ...task, id: task.stableId, grading: { answer: '1', absoluteTolerance: 0 } }, statement: 'Найдите давление.', solution: null, images: {} } }),
}));
beforeEach(() => {
  history.replaceState({}, '', '/teacher/bank');
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method].bind(history);
    vi.spyOn(history, method).mockImplementation((data, unused, url) => { original(data, unused, url); window.dispatchEvent(new PopStateEvent('popstate')); });
  }
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function setup() { return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><TeacherBankScreen /></QueryClientProvider>); }

it('keeps the original task actions, visible upload/export and the import screen in the single layout', async () => {
  const user = userEvent.setup(); setup();
  expect(screen.queryByRole('link', { name: /Исходный банк/ })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Экспорт' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Действия с заданием' }));
  expect(screen.getByRole('menuitem', { name: 'Удалить из банка' })).toBeVisible();
  await user.click(screen.getByRole('menuitem', { name: 'Исправить задачу' }));
  expect(screen.getByRole('dialog', { name: 'Исправить задачу' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Закрыть исправление' }));
  await user.click(screen.getByRole('button', { name: 'Действия с заданием' }));
  await user.click(screen.getByRole('menuitem', { name: 'Удалить из банка' }));
  expect(screen.getByRole('dialog', { name: 'Удалить задание из банка?' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Отмена' }));
  await user.click(screen.getByRole('button', { name: 'Загрузить пакет' }));
  expect(screen.getByRole('heading', { name: 'Загрузить пакет' })).toBeVisible();
  expect(screen.getByLabelText('Выбрать файл')).toHaveAttribute('type', 'file');
  await user.click(screen.getByRole('button', { name: 'Банк заданий' }));
  expect(screen.getByRole('button', { name: 'Действия с заданием' })).toBeVisible();
});

it('keeps bulk deletion confirmation and independent viewing selection', async () => {
  const user = userEvent.setup(); setup();
  const list = screen.getByRole('list', { name: 'Задания банка' });
  fireEvent.click(within(list).getByRole('button'));
  expect(within(list).getByRole('checkbox')).not.toBeChecked();
  await user.click(within(list).getByRole('checkbox'));
  expect(screen.getByRole('status')).toHaveTextContent('Выбрано: 1');
  await user.click(screen.getByRole('button', { name: 'Удалить' }));
  expect(screen.getByRole('alertdialog')).toHaveTextContent('Удалить выбранные задания?');
  await user.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(within(list).getByRole('checkbox')).toBeChecked();
});

it('reveals the answer and original metadata from one row, switches and collapses with the keyboard', async () => {
  const user = userEvent.setup(); setup();
  const answer = screen.getByRole('button', { name: 'Ответ' });
  const metadata = screen.getByRole('button', { name: 'Метаданные' });
  const scroll = vi.fn();
  screen.getByRole('region', { name: 'Ответ и информация о задаче' }).scrollIntoView = scroll;
  expect(answer).toHaveAttribute('aria-expanded', 'false');
  expect(metadata).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('region', { name: 'Ответ' })).not.toBeInTheDocument();
  await user.click(answer);
  expect(scroll).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('region', { name: 'Ответ' })).toHaveTextContent('Допустимая погрешность: 0');
  await user.tab();
  expect(metadata).toHaveFocus();
  await user.keyboard('{Enter}');
  expect(answer).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('region', { name: 'Ответ' })).not.toBeInTheDocument();
  const info = screen.getByRole('region', { name: 'Метаданные' });
  expect(scroll).toHaveBeenCalledTimes(2);
  expect(info).toHaveAttribute('id', metadata.getAttribute('aria-controls'));
  expect(info).toHaveTextContent('Школково');
  expect(info).toHaveTextContent('Дата загрузки13.11.2026');
  await user.keyboard(' ');
  expect(metadata).toHaveAttribute('aria-expanded', 'false');
  expect(screen.queryByRole('region', { name: 'Метаданные' })).not.toBeInTheDocument();
  expect(scroll).toHaveBeenCalledTimes(2);
});
