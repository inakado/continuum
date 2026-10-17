import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import type { AssessmentWorkDetail } from '@continuum/shared';
import WorkEditor from './WorkEditor';
import { teacherWorksApi } from './teacher-works.api';

vi.mock('@/components/ContinuumHeader', () => ({ default: () => null }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('./teacher-works.api', () => ({ teacherWorksApi: { update: vi.fn(), freeze: vi.fn() } }));
const initial: AssessmentWorkDetail = {
  id: '00000000-0000-4000-8000-000000000001', title: 'МКТ', instructions: '', gradeBand: 'grade_10_11', revision: 1, taskCount: 3, maxPoints: 3, updatedAt: '2026-10-17T00:00:00Z',
  items: ['Давление', 'Температура', 'Объём'].map((title, index) => ({ id: `00000000-0000-4000-8000-00000000000${index + 2}`, version: 1, statement: 'Условие задачи.', solution: null, images: {}, task: { id: `sample-${index}`, title, gradeBand: 'grade_10_11', topicPath: ['МКТ'], maxPoints: 1, source: { provider: 'Авторское' }, type: 'short_number', grading: { answer: '42', absoluteTolerance: 0 } } })),
};
afterEach(() => { cleanup(); vi.clearAllMocks(); });
function setup() {
  vi.mocked(teacherWorksApi.update).mockImplementation(async (_id, body) => ({ ...initial, ...body, revision: body.expectedRevision + 1, items: body.items.map((ref) => initial.items.find((item) => item.id === ref.taskId)!) }));
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><WorkEditor initial={initial} onReload={vi.fn()} /></QueryClientProvider>);
}
const titles = () => within(screen.getByRole('list', { name: 'Задания работы' })).getAllByRole('button', { expanded: false }).filter((element) => element.querySelector('strong')).map((element) => element.querySelector('strong')!.textContent);

it('supports accessible reordering, undo removal and a preview without answer keys', async () => {
  setup();
  fireEvent.keyDown(screen.getByRole('button', { name: 'Переместить задание 1' }), { key: 'ArrowDown' });
  expect(titles()).toEqual(['Температура', 'Давление', 'Объём']);
  await waitFor(() => expect(teacherWorksApi.update).toHaveBeenCalled(), { timeout: 1500 });
  fireEvent.click(screen.getByRole('button', { name: 'Действия с заданием 2' }));
  // Radix opens menus on pointer-down rather than click.
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Действия с заданием 2' }), { button: 0, ctrlKey: false, pointerType: 'mouse' });
  const remove = await screen.findByRole('menuitem', { name: 'Убрать из работы' });
  fireEvent.click(remove);
  expect(titles()).toEqual(['Температура', 'Объём']);
  fireEvent.click(screen.getByRole('button', { name: 'Отменить' }));
  expect(titles()).toEqual(['Температура', 'Давление', 'Объём']);
  fireEvent.click(screen.getByRole('button', { name: 'Просмотр работы' }));
  expect(screen.getAllByText('Условие задачи.')).toHaveLength(3);
  expect(screen.queryByText('42')).not.toBeInTheDocument();
  expect(screen.queryByText('Ответ и проверка')).not.toBeInTheDocument();
});

it('moves a task by the drag handle and renumbers the persisted references', async () => {
  setup();
  const dataTransfer = { effectAllowed: '', dropEffect: '', setData: vi.fn(), setDragImage: vi.fn() };
  const list = screen.getByRole('list', { name: 'Задания работы' });
  fireEvent.dragStart(screen.getByRole('button', { name: 'Переместить задание 1' }), { dataTransfer });
  const target = list.children[2];
  const over = new MouseEvent('dragover', { bubbles: true, clientY: 10 });
  Object.defineProperty(over, 'dataTransfer', { value: dataTransfer });
  fireEvent(target, over);
  fireEvent.drop(target, { dataTransfer });
  expect(titles()).toEqual(['Температура', 'Объём', 'Давление']);
  await waitFor(() => expect(teacherWorksApi.update).toHaveBeenCalled(), { timeout: 1500 });
  expect(vi.mocked(teacherWorksApi.update).mock.calls[0][1].items.map((item) => item.taskId)).toEqual([initial.items[1].id, initial.items[2].id, initial.items[0].id]);
});
