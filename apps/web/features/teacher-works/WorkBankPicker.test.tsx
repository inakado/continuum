import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import WorkBankPicker from './WorkBankPicker';

vi.mock('@/features/teacher-bank/BankTaskPreview', () => ({ default: () => <p>Полное условие</p> }));
vi.mock('@/features/teacher-bank/teacher-bank.api', () => ({ teacherBankApi: { view: async (id: string, version: number) => ({ id, version }) } }));
vi.mock('@/features/teacher-bank/use-teacher-bank', () => ({
  useTeacherBank: ({ search }: { search: string }) => ({ data: { tasks: [{ id: search ? 'b' : 'a', version: search ? 2 : 1, title: search ? 'Температура' : 'Давление', topicPath: ['МКТ'], source: { provider: 'Авторское' }, maxPoints: 1 }], topics: [], total: 1 }, isPending: false }),
  useTeacherBankTask: () => ({ data: {}, isPending: false }),
}));
afterEach(cleanup);
it('keeps checked tasks across filters and adds the selected versions together', async () => {
  const add = vi.fn();
  render(<WorkBankPicker existing={[]} grade="grade_10_11" onClose={vi.fn()} onAdd={add} />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Выбрать: Давление' }));
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Температура' } });
  fireEvent.click(screen.getByRole('checkbox', { name: 'Выбрать: Температура' }));
  fireEvent.click(screen.getByRole('button', { name: 'Добавить в работу' }));
  await waitFor(() => expect(add).toHaveBeenCalledWith([{ id: 'a', version: 1 }, { id: 'b', version: 2 }]));
});
