import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import type { TeacherStudent } from '@continuum/shared';
import StudentNamesForm from './StudentNamesForm';
import { teacherStudentsApi } from './teacher-students.api';
import { ApiError } from '@/lib/api/client';

vi.mock('./teacher-students.api', () => ({ teacherStudentsApi: { updateNames: vi.fn() } }));
const student: TeacherStudent = { id: '00000000-0000-4000-8000-000000000001', name: 'Иван Иванов', login: 'ivanov', firstName: 'Иван', lastName: 'Иванов', middleName: 'Иванович', classId: null, isActive: true, gradeBands: [] };
const close = vi.fn();
function show() { return render(<QueryClientProvider client={new QueryClient()}><StudentNamesForm student={student} onClose={close} /></QueryClientProvider>); }
beforeEach(() => vi.resetAllMocks());
it('prefills names, focuses the surname and cancels without any write', async () => {
  show(); const user = userEvent.setup();
  await waitFor(() => expect(screen.getByLabelText('Фамилия')).toHaveFocus());
  expect(screen.getByLabelText('Имя')).toHaveValue('Иван');
  expect(screen.getByText('Логин: ivanov')).toBeVisible(); expect(screen.getAllByRole('textbox')).toHaveLength(3);
  await user.click(screen.getByRole('button', { name: 'Отмена' })); expect(close).toHaveBeenCalledOnce();
  expect(teacherStudentsApi.updateNames).not.toHaveBeenCalled();
});
it('saves trimmed names and the previous values, without credentials or class changes', async () => {
  vi.mocked(teacherStudentsApi.updateNames).mockResolvedValue({ id: student.id, isActive: true });
  show(); const user = userEvent.setup();
  await user.clear(screen.getByLabelText('Фамилия')); await user.type(screen.getByLabelText('Фамилия'), ' Петров ');
  await user.clear(screen.getByLabelText('Отчество')); await user.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(teacherStudentsApi.updateNames).toHaveBeenCalledWith({ studentId: student.id, input: { firstName: 'Иван', lastName: 'Петров', middleName: null, expected: { firstName: 'Иван', lastName: 'Иванов', middleName: 'Иванович' } } }, expect.anything());
});
it('keeps input and the dialog on a conflict and blocks empty names', async () => {
  vi.mocked(teacherStudentsApi.updateNames).mockRejectedValue(new ApiError(409, 'Данные изменились'));
  show(); const user = userEvent.setup();
  await user.clear(screen.getByLabelText('Имя')); expect(screen.getByRole('button', { name: 'Сохранить' })).toBeDisabled();
  await user.type(screen.getByLabelText('Имя'), 'Пётр'); await user.click(screen.getByRole('button', { name: 'Сохранить' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Данные изменились');
  expect(screen.getByLabelText('Имя')).toHaveValue('Пётр'); expect(close).not.toHaveBeenCalled();
});
it('blocks dismissal and another submission while the request is pending', async () => {
  const pending = Promise.withResolvers<{ id: string; isActive: boolean }>(); vi.mocked(teacherStudentsApi.updateNames).mockReturnValue(pending.promise);
  show(); const user = userEvent.setup(); await user.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Отмена' })).toBeDisabled());
  await user.keyboard('{Escape}'); expect(close).not.toHaveBeenCalled();
  expect(teacherStudentsApi.updateNames).toHaveBeenCalledOnce(); pending.resolve({ id: student.id, isActive: true });
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
});
it('keeps the opening baseline when the roster refreshes during editing', async () => {
  vi.mocked(teacherStudentsApi.updateNames).mockResolvedValue({ id: student.id, isActive: true });
  const client = new QueryClient();
  const view = render(<QueryClientProvider client={client}><StudentNamesForm student={student} onClose={close} /></QueryClientProvider>);
  const user = userEvent.setup();
  await user.clear(screen.getByLabelText('Фамилия')); await user.type(screen.getByLabelText('Фамилия'), 'Петров');
  view.rerender(<QueryClientProvider client={client}><StudentNamesForm student={{ ...student, lastName: 'Сидоров' }} onClose={close} /></QueryClientProvider>);
  await user.click(screen.getByRole('button', { name: 'Сохранить' }));
  await waitFor(() => expect(close).toHaveBeenCalledOnce());
  expect(teacherStudentsApi.updateNames).toHaveBeenCalledWith(expect.objectContaining({ input: expect.objectContaining({ lastName: 'Петров', expected: { firstName: 'Иван', lastName: 'Иванов', middleName: 'Иванович' } }) }), expect.anything());
});
