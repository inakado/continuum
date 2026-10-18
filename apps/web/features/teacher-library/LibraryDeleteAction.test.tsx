import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LibraryDeleteAction from './LibraryDeleteAction';
import { teacherLibraryApi } from './teacher-library.api';

vi.mock('./teacher-library.api', () => ({ teacherLibraryApi: { delete: vi.fn() } }));
const target = { kind: 'pdf' as const, id: 'lesson', expectedIds: ['version-1'] };
function view() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}><LibraryDeleteAction target={target} title="Конспект.pdf" /></QueryClientProvider>);
}
describe('подтверждение удаления библиотеки', () => {
  beforeEach(() => vi.resetAllMocks());
  it('фокусирует отмену и не удаляет без подтверждения', async () => {
    view(); fireEvent.click(screen.getByRole('button', { name: /Удалить конспект PDF/ }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Все версии');
    expect(screen.getByRole('button', { name: 'Отмена' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(teacherLibraryApi.delete).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
  it('передаёт подтвержденный список и закрывается после успеха', async () => {
    vi.mocked(teacherLibraryApi.delete).mockResolvedValue({ id: target.id });
    view(); fireEvent.click(screen.getByRole('button', { name: /Удалить конспект PDF/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Удалить конспект PDF' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(teacherLibraryApi.delete).toHaveBeenCalledWith(target, expect.anything());
  });
  it('оставляет диалог открытым при ошибке и позволяет повторить', async () => {
    vi.mocked(teacherLibraryApi.delete).mockRejectedValue(new Error('Не удалось удалить'));
    view(); fireEvent.click(screen.getByRole('button', { name: /Удалить конспект PDF/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Удалить конспект PDF' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeEnabled();
  });
  it('не закрывается и не повторяет запрос, пока удаление не закончено', async () => {
    const pending = Promise.withResolvers<{ id: string }>();
    vi.mocked(teacherLibraryApi.delete).mockReturnValue(pending.promise);
    view(); fireEvent.click(screen.getByRole('button', { name: /Удалить конспект PDF/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Удалить конспект PDF' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Удаляем…' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'Отмена' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(teacherLibraryApi.delete).toHaveBeenCalledTimes(1);
    pending.resolve({ id: target.id });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
