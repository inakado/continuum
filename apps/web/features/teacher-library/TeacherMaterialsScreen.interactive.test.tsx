import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/client';
import TeacherMaterialsScreen from './TeacherMaterialsScreen';
import { teacherLibraryApi } from './teacher-library.api';

vi.mock('@/features/teacher-shell/TeacherChrome', () => ({ default: () => null }));
vi.mock('./LibraryDeleteAction', () => ({ default: () => null }));
vi.mock('./teacher-library.api', () => ({ teacherLibraryApi: {
  getLibrary: vi.fn(), getLesson: vi.fn(), publishLesson: vi.fn(), publishSection: vi.fn(),
  createLesson: vi.fn(), createSection: vi.fn(), updateLesson: vi.fn(), updateSection: vi.fn(), uploadArtifact: vi.fn(),
} }));

const artifact = { id: 'interactive-id', type: 'interactive', version: 2, filename: 'kin-01.zip', status: 'draft' };
const lesson = { id: 'lesson-id', title: 'Кинематика', status: 'published', formats: { pdf: false, tasks: false, interactive: true } };
const section = { id: 'section-id', title: 'Механика', status: 'published', lessons: [lesson] };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(teacherLibraryApi.getLibrary).mockResolvedValue({ gradeBands: [{ code: 'grade_10_11', sections: [section] }] } as never);
  vi.mocked(teacherLibraryApi.getLesson).mockResolvedValue({ ...lesson, artifacts: [artifact] } as never);
});

function view() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><TeacherMaterialsScreen /></QueryClientProvider>);
}

describe('интерактивный материал преподавателя', () => {
  it('offers preview and publication when only the interactive artifact is a new draft', async () => {
    vi.mocked(teacherLibraryApi.publishLesson).mockResolvedValue({ id: lesson.id, status: 'published' } as never);
    view();
    expect(await screen.findByRole('link', { name: 'Предпросмотр' })).toHaveAttribute('href', '/teacher/materials/interactive/interactive-id');
    fireEvent.click(screen.getByRole('button', { name: 'Опубликовать' }));
    await waitFor(() => expect(teacherLibraryApi.publishLesson).toHaveBeenCalledWith(lesson.id, expect.anything()));
    expect(screen.queryByText(/Публикация и просмотр учениками появятся/)).not.toBeInTheDocument();
  });
  it('shows the rejected package reason and preserves the existing preview after a failed replacement', async () => {
    vi.mocked(teacherLibraryApi.uploadArtifact).mockRejectedValue(new ApiError(400, 'Контрольная сумма HTML не совпадает.', 'INTERACTIVE_PACKAGE_INVALID'));
    view();
    const input = await screen.findByLabelText('Интерактивная лекция: выберите файл');
    const file = new File(['bad zip'], 'replacement.zip', { type: 'application/zip' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Контрольная сумма HTML не совпадает.');
    expect(screen.getByRole('link', { name: 'Предпросмотр' })).toHaveAttribute('href', '/teacher/materials/interactive/interactive-id');
    expect(teacherLibraryApi.uploadArtifact).toHaveBeenCalledWith({ lessonId: lesson.id, type: 'interactive', file }, expect.anything());
  });
});
