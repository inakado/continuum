import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import type { TeacherLibrary } from '@continuum/shared';
import { ApiError } from '@/lib/api/client';
import TeacherMaterialsScreen from './TeacherMaterialsScreen';
import { teacherLibraryApi } from './teacher-library.api';

vi.mock('@/features/teacher-shell/TeacherChrome', () => ({ default: () => null }));
vi.mock('./LibraryDeleteAction', () => ({ default: () => null }));
vi.mock('./teacher-library.api', () => ({ teacherLibraryApi: {
  getLibrary: vi.fn(), getLesson: vi.fn(), reorderSections: vi.fn(), reorderLessons: vi.fn(),
  createLesson: vi.fn(), createSection: vi.fn(), updateLesson: vi.fn(), updateSection: vi.fn(),
  publishLesson: vi.fn(), publishSection: vi.fn(), uploadArtifact: vi.fn(),
} }));
let server: TeacherLibrary;
beforeEach(() => {
  vi.resetAllMocks();
  const lesson = (id: string, title: string, sortOrder: number) => ({ id, title, sortOrder, description: null, status: 'published' as const, formats: { pdf: false, tasks: false, interactive: false } });
  server = { gradeBands: [{ code: 'grade_10_11', sections: [
    { id: 'a', gradeBand: 'grade_10_11', title: 'Механика', description: null, status: 'published', sortOrder: 0, lessons: [lesson('one', 'Движение', 0), lesson('two', 'Скорость', 1), lesson('three', 'Ускорение', 2)] },
    { id: 'b', gradeBand: 'grade_10_11', title: 'Оптика', description: null, status: 'published', sortOrder: 1, lessons: [lesson('four', 'Свет', 0)] },
  ] }] };
  vi.mocked(teacherLibraryApi.getLibrary).mockImplementation(async () => structuredClone(server));
  vi.mocked(teacherLibraryApi.getLesson).mockImplementation(async (id) => {
    const section = server.gradeBands[0].sections.find((item) => item.lessons.some((row) => row.id === id))!;
    return { ...section.lessons.find((row) => row.id === id)!, section: { id: section.id, title: section.title, gradeBand: section.gradeBand }, artifacts: [] };
  });
  vi.mocked(teacherLibraryApi.reorderSections).mockImplementation(async (input) => {
    const sections = server.gradeBands[0].sections;
    server.gradeBands[0].sections = input.orderedIds.map((id, sortOrder) => ({ ...sections.find((item) => item.id === id)!, sortOrder }));
    return { orderedIds: input.orderedIds };
  });
  vi.mocked(teacherLibraryApi.reorderLessons).mockImplementation(async (id, input) => {
    const section = server.gradeBands[0].sections.find((item) => item.id === id)!;
    const lessons = section.lessons;
    section.lessons = input.orderedIds.map((key, sortOrder) => ({ ...lessons.find((item) => item.id === key)!, sortOrder }));
    return { orderedIds: input.orderedIds };
  });
});
function view() {
  return render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}><TeacherMaterialsScreen /></QueryClientProvider>);
}
const handle = (label: string) => screen.getByRole('button', { name: `Переместить ${label}` });
const sectionHeadings = () => screen.getAllByRole('heading', { level: 2 }).slice(0, 2).map((node) => node.textContent);
const lessonTitles = () => within(screen.getByRole('list', { name: 'Занятия раздела «Механика»' })).getAllByRole('button', { name: /^(?!Переместить)/ }).map((node) => node.textContent);

it('saves keyboard order, keeps the selected lesson, and reads saved order after remount', async () => {
  const first = view();
  const grip = await screen.findByRole('button', { name: 'Переместить занятие «Движение»' });
  grip.focus(); fireEvent.keyDown(grip, { key: 'ArrowDown' });
  await waitFor(() => expect(teacherLibraryApi.reorderLessons).toHaveBeenCalledWith('a', { expectedIds: ['one', 'two', 'three'], orderedIds: ['two', 'one', 'three'] }));
  await screen.findByText(/Порядок сохранён/);
  expect(lessonTitles()[0]).toContain('Скорость');
  expect(within(screen.getByRole('complementary')).getByRole('heading', { name: 'Движение' })).toBeInTheDocument();
  expect(grip).toHaveFocus();
  first.unmount(); view();
  await screen.findByRole('button', { name: 'Переместить занятие «Движение»' });
  expect(lessonTitles()[0]).toContain('Скорость');
});
it('offers menu movement without dragging and preserves the opened section', async () => {
  view(); await screen.findByRole('button', { name: 'Переместить раздел «Механика»' });
  fireEvent.keyDown(handle('раздел «Механика»'), { key: 'Enter' });
  fireEvent.click(await screen.findByRole('menuitem', { name: 'В конец' }));
  await screen.findByText(/Порядок сохранён/);
  expect(sectionHeadings()).toEqual(['Оптика', 'Механика']);
  expect(screen.getByRole('button', { name: 'Свернуть раздел «Механика»' })).toHaveAttribute('aria-expanded', 'true');
});
it('opens the pointer menu only after click, leaving pointerdown available for native drag', async () => {
  view(); const grip = await screen.findByRole('button', { name: 'Переместить раздел «Механика»' });
  fireEvent.pointerDown(grip, { button: 0, pointerType: 'mouse' });
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  fireEvent.click(grip);
  expect(await screen.findByRole('menuitem', { name: 'Ниже' })).toBeInTheDocument();
});
function dragEvent(type: string, target: Element, y: number, transfer: object) {
  const event = new MouseEvent(type, { bubbles: true, clientY: y });
  Object.defineProperty(event, 'dataTransfer', { value: transfer }); fireEvent(target, event);
}
it('inserts a dragged section after a header and ignores lesson drops on sections', async () => {
  view(); await screen.findByRole('button', { name: 'Переместить раздел «Механика»' });
  const transfer = { setData: vi.fn(), setDragImage: vi.fn(), effectAllowed: '', dropEffect: '' };
  const target = handle('раздел «Оптика»').closest('section')!;
  vi.spyOn(target.querySelector('[data-library-order-header]')!, 'getBoundingClientRect').mockReturnValue({ top: 100, height: 50 } as DOMRect);
  fireEvent.dragStart(handle('занятие «Движение»'), { dataTransfer: transfer });
  dragEvent('dragover', target, 140, transfer); dragEvent('drop', target, 140, transfer);
  expect(teacherLibraryApi.reorderSections).not.toHaveBeenCalled();
  fireEvent.dragEnd(handle('занятие «Движение»'));
  fireEvent.dragStart(handle('раздел «Механика»'), { dataTransfer: transfer });
  dragEvent('dragover', target, 140, transfer); expect(target).toHaveAttribute('data-order-drop', 'after');
  dragEvent('drop', target, 140, transfer);
  await screen.findByText(/Порядок сохранён/); expect(sectionHeadings()).toEqual(['Оптика', 'Механика']);
});
it('keeps a colleague’s new section after failed saving and allows a fresh retry', async () => {
  const pending = Promise.withResolvers<{ orderedIds: string[] }>();
  vi.mocked(teacherLibraryApi.reorderSections).mockReturnValueOnce(pending.promise);
  view(); const grip = await screen.findByRole('button', { name: 'Переместить раздел «Механика»' });
  fireEvent.keyDown(grip, { key: 'ArrowDown' });
  await screen.findByText('Сохраняем порядок…');
  expect(sectionHeadings()).toEqual(['Оптика', 'Механика']); expect(grip).toHaveAttribute('aria-disabled', 'true');
  fireEvent.keyDown(grip, { key: 'ArrowDown' });
  expect(teacherLibraryApi.reorderSections).toHaveBeenCalledTimes(1);
  server.gradeBands[0].sections.push({ ...server.gradeBands[0].sections[1], id: 'new', title: 'Новый раздел', lessons: [], sortOrder: 2 });
  await act(async () => pending.reject(new ApiError(409, 'List changed', 'LIBRARY_ORDER_CHANGED')));
  expect(await screen.findByRole('alert')).toHaveTextContent('Список уже изменился');
  expect(screen.getByRole('heading', { name: 'Новый раздел' })).toBeInTheDocument();
  expect(sectionHeadings()).toEqual(['Механика', 'Оптика']); expect(grip).toHaveAttribute('aria-disabled', 'false');
  fireEvent.keyDown(grip, { key: 'End' }); await screen.findByText(/Порядок сохранён/);
  expect(teacherLibraryApi.reorderSections).toHaveBeenLastCalledWith({ gradeBand: 'grade_10_11', expectedIds: ['a', 'b', 'new'], orderedIds: ['b', 'new', 'a'] });
});
