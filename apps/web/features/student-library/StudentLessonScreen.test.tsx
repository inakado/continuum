import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { LessonDetail } from '@continuum/shared';
import StudentLessonScreen from './StudentLessonScreen';
import { useStudentLesson } from './use-student-library';
import { studentLibraryApi } from './student-library.api';

vi.mock('@/components/ContinuumHeader', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('grade=grade_7&q=движение') }));
vi.mock('./use-student-library', () => ({ useStudentLesson: vi.fn() }));
vi.mock('./student-library.api', () => ({ studentLibraryApi: { getArtifactView: vi.fn() } }));
const lesson: LessonDetail = { id: 'lesson-2', title: 'Движение', description: null, status: 'published', sortOrder: 1, formats: { pdf: true, interactive: false, tasks: false }, section: { id: 'section', gradeBand: 'grade_7', title: 'Механика' }, artifacts: [{ id: 'file', type: 'pdf', version: 1, filename: 'Очень_длинное_название_файла_без_пробелов.pdf', contentType: 'application/pdf', sizeBytes: 12, status: 'published', isActive: true, publishedAt: null }] };
function show() {
  vi.mocked(useStudentLesson).mockReturnValue({ data: lesson, isPending: false, isError: false } as ReturnType<typeof useStudentLesson>);
  render(<StudentLessonScreen lessonId={lesson.id} />);
}
afterEach(() => vi.restoreAllMocks());
it('keeps catalog context and exposes a single clear file action with optional metadata', async () => {
  const replace = vi.fn();
  const tab = { location: { replace }, close: vi.fn(), opener: window };
  vi.spyOn(window, 'open').mockReturnValue(tab as unknown as Window);
  vi.mocked(studentLibraryApi.getArtifactView).mockResolvedValue({ url: 'https://files.example/lesson.pdf' });
  show();
  expect(screen.getByRole('navigation', { name: 'Разделы ученика' })).toBeVisible();
  const back = new URL(screen.getByRole('link', { name: 'К занятиям' }).getAttribute('href')!, location.origin);
  expect(back.searchParams.get('grade')).toBe('grade_7');
  expect(back.searchParams.get('q')).toBe('движение');
  expect(back.hash).toBe('#lesson-lesson-2');
  expect(screen.getAllByRole('button', { name: /Конспект PDF: Движение/ })).toHaveLength(1);
  expect(screen.getByText(lesson.artifacts[0].filename).closest('details')).not.toHaveAttribute('open');
  fireEvent.click(screen.getByRole('button', { name: /Конспект PDF: Движение/ }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith('https://files.example/lesson.pdf'));
  expect(tab.opener).toBeNull();
});
it('closes the placeholder and offers retry when file opening fails', async () => {
  const close = vi.fn();
  vi.spyOn(window, 'open').mockReturnValue({ location: { replace: vi.fn() }, close } as unknown as Window);
  vi.mocked(studentLibraryApi.getArtifactView).mockRejectedValue(new Error('offline'));
  show();
  const button = screen.getByRole('button', { name: /Конспект PDF: Движение/ });
  fireEvent.click(button);
  expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось открыть файл');
  expect(close).toHaveBeenCalledOnce();
  expect(button).toBeEnabled();
});
