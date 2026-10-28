import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render as baseRender, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import TeacherStudentsScreen from './TeacherStudentsScreen';
import { ApiError } from '@/lib/api/client';

const state = vi.hoisted(() => ({ remove: vi.fn(), reset: vi.fn(), archive: vi.fn() }));
vi.mock('./teacher-students.api', () => ({ teacherStudentsApi: { removeMany: state.remove, restoreMany: vi.fn() } }));
vi.mock('@/components/ContinuumHeader', () => ({ default: () => null }));
vi.mock('./use-teacher-students', () => {
  const mutation = () => ({ mutate: vi.fn(), isPending: false, error: null });
  return {
    useTeacherStudents: () => ({ data: { students: [{ id: 'pupil', name: 'Иванов Иван', login: 'ivanov', classId: 'class', isActive: true, gradeBands: [] }] } }),
    useSchoolClasses: () => ({ data: { classes: [{ id: 'class', title: '11А', grade: 11, academicYear: 2026, isArchived: false, studentCount: 1 }] } }),
    useResetStudentPassword: () => ({ ...mutation(), mutateAsync: state.reset, reset: vi.fn() }),
    useUpdateSchoolClass: () => ({ ...mutation(), mutateAsync: state.archive }),
    useSetStudentActive: mutation, useSetStudentAccess: mutation, useSetStudentClass: mutation, useDeleteSchoolClass: mutation,
  };
});
afterEach(() => { cleanup(); vi.resetAllMocks(); });
async function action(name: string) {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Действия: Иванов Иван' }));
  await user.click(await screen.findByRole('menuitem', { name }));
}
it('cancels deletion without a write and restores focus to the pupil menu', async () => {
  render(<TeacherStudentsScreen />); await action('Удалить ученика');
  expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(/Выбрано: 1.*можно отменить/);
  expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
  expect(state.remove).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole('button', { name: 'Действия: Иванов Иван' })).toHaveFocus());
});
it('retries a password reset with the same request id and guards closing one-time credentials', async () => {
  state.reset.mockRejectedValueOnce(new ApiError(503, 'Нет соединения')).mockResolvedValue({ credential: { id: 'pupil', name: 'Иванов Иван', login: 'ivanov', password: 'test-only-password' } });
  render(<TeacherStudentsScreen />); await action('Сбросить пароль');
  expect(state.reset).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Сбросить пароль' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Нет соединения');
  fireEvent.click(screen.getByRole('button', { name: 'Сбросить пароль' }));
  await screen.findByText('Доступы готовы');
  expect(state.reset.mock.calls[0][0]).toEqual(state.reset.mock.calls[1][0]);
  fireEvent.click(screen.getByRole('button', { name: 'К списку учеников' }));
  expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(/Повторно посмотреть пароль нельзя/);
  fireEvent.click(screen.getByRole('button', { name: 'Вернуться' }));
  expect(screen.getByText('Доступы готовы')).toBeVisible();
});
it('archives only after confirming the selected class', async () => {
  state.archive.mockResolvedValue({}); render(<TeacherStudentsScreen />);
  fireEvent.change(screen.getByRole('combobox', { name: 'Класс' }), { target: { value: 'class' } });
  fireEvent.click(screen.getByRole('button', { name: 'В архив' }));
  expect(state.archive).not.toHaveBeenCalled();
  expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(/11А.*доступы сохранятся/);
  fireEvent.click(screen.getByRole('button', { name: 'В архив' }));
  await waitFor(() => expect(state.archive).toHaveBeenCalledWith({ id: 'class', input: { isArchived: true } }));
});

function render(ui: Parameters<typeof baseRender>[0]) { return baseRender(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>{ui}</QueryClientProvider>); }
