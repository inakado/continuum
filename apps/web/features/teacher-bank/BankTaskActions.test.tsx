import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import type { AssessmentTaskView } from '@continuum/shared';
import BankTaskActions from './BankTaskActions';
import { teacherBankApi } from './teacher-bank.api';

vi.mock('./teacher-bank.api', () => ({ teacherBankApi: { remove: vi.fn() } }));
const task = { id: 'task-id', version: 3, lifecycleRevision: 7, task: { title: 'Температура газа' } } as AssessmentTaskView;
const receipt = { id: task.id, version: 3, deletionRevision: 8 };
const onDeleted = vi.fn();
function setup() {
  const cache = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(<QueryClientProvider client={cache}><BankTaskActions task={task} query="search=газ" onDeleted={onDeleted} /></QueryClientProvider>);
}
async function open() {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Действия с заданием' }));
  await user.click(await screen.findByRole('menuitem', { name: 'Удалить из банка' }));
  return user;
}
beforeEach(() => vi.resetAllMocks());
it('убирает удаление в меню, фокусирует отмену и сохраняет задание после отмены', async () => {
  setup();
  expect(screen.queryByText('Удалить из банка')).not.toBeInTheDocument();
  const user = await open();
  expect(screen.getByRole('dialog')).toHaveTextContent('В уже собранных работах оно останется');
  await waitFor(() => expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus());
  await user.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(teacherBankApi.remove).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Действия с заданием' })).toHaveFocus();
});
it('отправляет подтверждённую версию и обновляет экран только после успеха', async () => {
  vi.mocked(teacherBankApi.remove).mockResolvedValue(receipt);
  setup(); const user = await open();
  await user.click(screen.getByRole('button', { name: 'Удалить из банка' }));
  await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
  expect(teacherBankApi.remove).toHaveBeenCalledWith(task.id, { expectedVersion: 3, expectedLifecycleRevision: 7 });
  expect(onDeleted).toHaveBeenCalledWith({ ...receipt, title: task.task.title, query: 'search=газ' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('оставляет ошибку в диалоге и не снимает подтверждение при неудаче', async () => {
  vi.mocked(teacherBankApi.remove).mockRejectedValue(new Error('Банк изменился'));
  setup(); const user = await open();
  await user.click(screen.getByRole('button', { name: 'Удалить из банка' }));
  await screen.findByRole('alert');
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(onDeleted).not.toHaveBeenCalled();
});
it('не закрывает диалог и не дублирует запрос во время удаления', async () => {
  const pending = Promise.withResolvers<typeof receipt>();
  vi.mocked(teacherBankApi.remove).mockReturnValue(pending.promise);
  setup(); const user = await open();
  await user.click(screen.getByRole('button', { name: 'Удалить из банка' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Удаляем…' })).toBeDisabled());
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  expect(teacherBankApi.remove).toHaveBeenCalledTimes(1);
  pending.resolve(receipt);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
