import { cleanup, fireEvent, render as renderComponent, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AssessmentWorkDetail } from '@continuum/shared';
import WorkPreview from './WorkPreview';
import { teacherWorksApi } from './teacher-works.api';

vi.mock('./teacher-works.api', () => ({ teacherWorksApi: { update: vi.fn(), freeze: vi.fn(), checkAnswer: vi.fn() } }));
function render(element: ReactElement) { const client = new QueryClient(); return renderComponent(element, { wrapper: ({ children }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> }); }
const base = { gradeBand: 'grade_10_11' as const, topicPath: ['МКТ'], maxPoints: 1, source: { provider: 'Авторское' } };
const variants = [{ id: 'a', content: 'Первый вариант' }, { id: 'b', content: 'Второй вариант' }];
const tasks: AssessmentWorkDetail['items'][number]['task'][] = [
  { ...base, id: 'number', title: 'Число', type: 'short_number', unit: 'К', grading: { answer: '314159', absoluteTolerance: 0 } },
  { ...base, id: 'text', title: 'Текст', type: 'short_text', grading: { acceptedAnswers: ['Секретный ответ'], caseSensitive: false } },
  { ...base, id: 'single', title: 'Один вариант', type: 'single_choice', options: variants, grading: { correctOptionId: 'a' } },
  { ...base, id: 'multi', title: 'Несколько вариантов', type: 'multiple_choice', options: variants, grading: { correctOptionIds: ['a', 'b'] } },
  { ...base, id: 'match', title: 'Соответствие', type: 'matching', options: variants, rows: [{ id: 'r1', content: 'Первая величина' }, { id: 'r2', content: 'Вторая величина' }], grading: { matches: { r1: 'a', r2: 'b' } } },
  { ...base, id: 'extended', title: 'Развёрнутая задача', type: 'extended' },
];
const items: AssessmentWorkDetail['items'] = tasks.map((task, index) => ({ id: `item-${index}`, version: 1, task, statement: `Условие ${index + 1}`, solution: 'Закрытый разбор', images: {} }));
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });

it('uses one question and all answer types with local state, without writes, keys or browser storage', () => {
  render(<WorkPreview id="work" revision={1} items={items} dirty={false} readOnly />);
  expect(screen.getAllByText(/^Условие \d/)).toHaveLength(1);
  expect(screen.queryByText('314159')).not.toBeInTheDocument();
  expect(screen.queryByText('Секретный ответ')).not.toBeInTheDocument();
  expect(screen.queryByText('Закрытый разбор')).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '-2,5' } });
  fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Пробный текст' } });
  fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
  fireEvent.click(screen.getByRole('radio', { name: 'Вариант 2: Один вариант' }));
  fireEvent.click(screen.getByRole('button', { name: 'Очистить ответ' }));
  expect(screen.getByRole('button', { name: 'Задание 3: без ответа' })).toHaveAttribute('aria-current', 'step');
  fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Вариант 1: Несколько вариантов' }));
  fireEvent.click(screen.getByRole('checkbox', { name: 'Вариант 2: Несколько вариантов' }));
  fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Ответ для А: Соответствие' }), { target: { value: 'a' } });
  expect(screen.getByRole('button', { name: 'Задание 5: частично' })).toHaveAttribute('data-state', 'partial');
  fireEvent.change(screen.getByRole('combobox', { name: 'Ответ для Б: Соответствие' }), { target: { value: 'b' } });
  fireEvent.click(screen.getByRole('button', { name: 'Задание 1: есть ответ' }));
  expect(screen.getByRole('textbox')).toHaveValue('-2,5');
  fireEvent.click(screen.getByRole('button', { name: 'Задание 2: есть ответ' }));
  expect(screen.getByRole('textbox')).toHaveValue('Пробный текст');
  expect(fetch).not.toHaveBeenCalled();
  expect(teacherWorksApi.update).not.toHaveBeenCalled();
  expect(teacherWorksApi.freeze).not.toHaveBeenCalled();
  expect(teacherWorksApi.checkAnswer).not.toHaveBeenCalled();
  expect(sessionStorage.length + localStorage.length).toBe(0);
  expect(screen.queryByRole('button', { name: 'Завершить работу' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Сохранить версию' })).not.toBeInTheDocument();
});

it('checks only on request, hides stale feedback after edits and checks the selected immutable version', async () => {
  vi.mocked(teacherWorksApi.checkAnswer).mockResolvedValue({ correct: true, points: 1, maxPoints: 1 });
  const view = render(<WorkPreview id="work" revision={2} items={items} dirty={false} versionNumber={3} readOnly />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '314159' } });
  fireEvent.click(screen.getByRole('button', { name: 'Проверить ответ' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Баллы: 1 из 1');
  expect(screen.getByRole('status')).toHaveAttribute('data-score', 'correct');
  expect(teacherWorksApi.checkAnswer).toHaveBeenCalledWith('work', { taskId: items[0].id, source: { kind: 'version', number: 3 }, answer: { type: 'short_number', value: '314159' } });
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '12' } });
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  vi.mocked(teacherWorksApi.checkAnswer).mockRejectedValueOnce(new Error('offline'));
  fireEvent.click(screen.getByRole('button', { name: 'Проверить ответ' }));
  await screen.findByRole('alert');
  vi.mocked(teacherWorksApi.checkAnswer).mockResolvedValue({ correct: false, points: 0, maxPoints: 1 });
  fireEvent.click(screen.getByRole('button', { name: 'Проверить ответ' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Баллы: 0 из 1');
  expect(screen.getByRole('status')).toHaveAttribute('data-score', 'incorrect');
  view.rerender(<WorkPreview id="work" revision={4} items={items} dirty versionNumber={undefined} />);
  expect(screen.getByRole('button', { name: 'Проверить ответ' })).toBeDisabled();
  view.rerender(<WorkPreview id="work" revision={4} items={items} dirty={false} />);
  let finish!: (value: { correct: boolean; points: number; maxPoints: number }) => void;
  vi.mocked(teacherWorksApi.checkAnswer).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  fireEvent.click(screen.getByRole('button', { name: 'Проверить ответ' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Проверяем…' })).toBeDisabled());
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Другой ввод' } });
  finish({ correct: true, points: 1, maxPoints: 1 });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Проверить ответ' })).toBeEnabled());
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});

it('shows only the earned points without a verbal assessment', async () => {
  vi.mocked(teacherWorksApi.checkAnswer).mockResolvedValue({ correct: false, points: 1, maxPoints: 2 });
  render(<WorkPreview id="ege" revision={1} items={items} dirty={false} readOnly />);
  fireEvent.click(screen.getByRole('button', { name: 'Проверить ответ' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Баллы: 1 из 2');
  expect(screen.getByRole('status')).toHaveAttribute('data-score', 'partial');
  expect(screen.queryByText(/Частично верно/)).not.toBeInTheDocument();
});

it('discards trial answers on leaving, changing the work or changing the task composition', () => {
  const view = render(<WorkPreview id="first" revision={1} items={items} dirty={false} />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '123' } });
  view.rerender(<WorkPreview id="other" revision={1} items={items} dirty={false} />);
  expect(screen.getByRole('textbox')).toHaveValue('');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '456' } });
  view.rerender(<WorkPreview id="other" revision={2} items={items.map((item) => ({ ...item, version: 2 }))} dirty={false} />);
  expect(screen.getByRole('textbox')).toHaveValue('');
  view.unmount();
  render(<WorkPreview id="first" revision={1} items={items} dirty={false} />);
  expect(screen.getByRole('textbox')).toHaveValue('');
});

it('previews photos locally, validates limits and releases URLs on removal and closing', () => {
  vi.stubGlobal('URL', class extends URL { static createObjectURL = vi.fn(() => 'blob:trial-photo'); static revokeObjectURL = vi.fn(); });
  const view = render(<WorkPreview id="photos" revision={1} items={items} dirty={false} readOnly />);
  fireEvent.click(screen.getByRole('button', { name: 'Задание 6: без ответа' }));
  expect(screen.queryByRole('button', { name: 'Проверить ответ' })).not.toBeInTheDocument();
  const input = screen.getByLabelText('Выбрать фотографии решения');
  const file = new File(['photo'], 'solution.png', { type: 'image/png' });
  fireEvent.change(input, { target: { files: [new File(['bad'], 'wrong.pdf', { type: 'application/pdf' })] } });
  expect(screen.getByRole('alert')).toHaveTextContent('JPG, PNG или WebP');
  fireEvent.change(input, { target: { files: Array.from({ length: 11 }, () => file) } });
  expect(screen.getByRole('alert')).toHaveTextContent('не более 10');
  expect(URL.createObjectURL).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { files: [file] } });
  expect(screen.getByRole('img', { name: 'Фото решения 1' })).toHaveAttribute('src', 'blob:trial-photo');
  fireEvent.click(screen.getByRole('button', { name: 'Задание 1: без ответа' }));
  fireEvent.click(screen.getByRole('button', { name: 'Задание 6: есть ответ' }));
  fireEvent.click(screen.getByRole('button', { name: 'Открыть фото 1' }));
  expect(within(screen.getByRole('dialog')).getByRole('img')).toHaveAttribute('src', 'blob:trial-photo');
  fireEvent.click(screen.getByRole('button', { name: 'Закрыть' }));
  fireEvent.click(screen.getByRole('button', { name: 'Удалить фото 1' }));
  expect(URL.revokeObjectURL).toHaveBeenCalledExactlyOnceWith('blob:trial-photo');
  fireEvent.change(screen.getByLabelText('Выбрать фотографии решения'), { target: { files: [file] } });
  view.unmount();
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  expect(fetch).not.toHaveBeenCalled();
});
