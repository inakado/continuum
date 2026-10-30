import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { StudentWorkDetail, SolutionAnswer } from '@continuum/shared';
import StudentWorkQuestions, { studentAnswerState } from './StudentWorkQuestions';

const work: StudentWorkDetail = {
  id: '00000000-0000-4000-8000-000000000001', title: 'Большая работа', versionNumber: 1, taskCount: 30,
  assignedAt: '2026-10-18T00:00:00Z', revision: 1, status: 'in_progress', answeredCount: 0,
  startedAt: '2026-10-18T00:00:00Z', completedAt: null, result: null, instructions: '', answers: {},
  items: Array.from({ length: 30 }, (_, index) => ({ id: `task-${index + 1}`, type: 'short_number', title: `Задача ${index + 1}`, statement: `Условие ${index + 1}`, unit: 'Па', maxPoints: 1, images: {} })),
};
function Example({ data = work }: { data?: StudentWorkDetail }) {
  const [answers, setAnswers] = useState(data.answers);
  return <StudentWorkQuestions work={data} answers={answers} disabled={false} onChange={(id, answer) => setAnswers((previous) => ({ ...previous, [id]: answer }))} />;
}
afterEach(() => { cleanup(); vi.restoreAllMocks(); sessionStorage.clear(); });

it('opens a task without photos from the list action and preserves manual navigation on later refreshes', () => {
  const extended = ['ext-1', 'ext-2'].map((id) => ({ id, title: id, type: 'extended' as const, statement: `Условие ${id}`, images: {}, maxPoints: 2 }));
  const data = { ...work, taskCount: 2, items: extended };
  const answers: SolutionAnswer[] = [{ taskId: 'ext-1', title: 'ext-1', maxPoints: 2, revision: 1, locked: false, publishedReview: null, photos: [{ id: 'photo', sizeBytes: 1, contentType: 'image/png', createdAt: '2026-10-21T00:00:00Z', url: '/photo' }] }];
  history.replaceState({}, '', `/student/works/${work.id}?view=solutions`);
  const view = render(<StudentWorkQuestions work={data} answers={{}} disabled={false} onChange={vi.fn()} entry="solutions" solutions={answers} solutionsLoading renderExtended={(id) => <p>Фото {id}</p>} />);
  expect(screen.getByText('Условие ext-1')).toBeVisible();
  view.rerender(<StudentWorkQuestions work={data} answers={{}} disabled={false} onChange={vi.fn()} entry="solutions" solutions={answers} renderExtended={(id) => <p>Фото {id}</p>} />);
  expect(screen.getByText('Условие ext-2')).toBeVisible();
  expect(location.search).toBe('');
  fireEvent.click(screen.getByRole('button', { name: 'Назад' }));
  view.rerender(<StudentWorkQuestions work={data} answers={{}} disabled={false} onChange={vi.fn()} entry="solutions" solutions={[...answers]} />);
  expect(screen.getByText('Условие ext-1')).toBeVisible();
});

it('renders only one question, allows skipping and keeps unsaved inputs when switching', () => {
  render(<Example />);
  expect(screen.getAllByRole('textbox')).toHaveLength(1);
  expect(screen.queryByText('Условие 2')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Задание 1: без ответа' })).toHaveAttribute('aria-current', 'step');
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '4,83' } });
  expect(screen.getByRole('button', { name: 'Задание 1: есть ответ' })).toHaveAttribute('aria-current', 'step');
  fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
  expect(screen.getByText('Условие 2')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Задание 30: без ответа' }));
  expect(screen.getByText('Условие 30')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Далее' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Задание 1: есть ответ' }));
  expect(screen.getByRole('textbox')).toHaveValue('4,83');
  expect(screen.getByRole('button', { name: 'Назад' })).toBeDisabled();
});

it('restores the last position in this tab without storing any answers', () => {
  const first = render(<Example />);
  fireEvent.click(screen.getByRole('button', { name: 'Задание 12: без ответа' }));
  expect(sessionStorage.getItem(`continuum:work-position:${work.id}`)).toBe('task-12');
  first.unmount();
  render(<Example />);
  expect(screen.getByText('Условие 12')).toBeVisible();
  expect(sessionStorage.length).toBe(1);
});

it('ignores a missing stored task and distinguishes partial matching from a filled answer', () => {
  sessionStorage.setItem(`continuum:work-position:${work.id}`, 'missing');
  render(<Example />);
  expect(screen.getByText('Условие 1')).toBeVisible();
  const matching = { id: 'match', title: 'Соответствие', type: 'matching' as const, statement: 'Условие', images: {}, maxPoints: 2,
    rows: [{ id: 'a', content: 'А' }, { id: 'b', content: 'Б' }], options: [{ id: '1', content: 'Первый' }, { id: '2', content: 'Второй' }] };
  expect(studentAnswerState(matching, { type: 'matching', matches: { a: '1' } })).toBe('partial');
  expect(studentAnswerState(matching, { type: 'matching', matches: { a: '1', b: '1' } })).toBe('filled');
  expect(studentAnswerState(matching, undefined)).toBe('empty');
});

it('keeps navigation available when browser storage is denied', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Denied', 'SecurityError'); });
  render(<Example />);
  fireEvent.click(screen.getByRole('button', { name: 'Далее' }));
  expect(screen.getByText('Условие 2')).toBeVisible();
});

it('uses one compact task map on mobile, restores focus and keeps typed answers across navigation', () => {
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: query.includes('max-width: 760px'), media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn() }));
  render(<Example data={{ ...work, taskCount: 20, items: work.items.slice(0, 20) }} />);
  expect(screen.queryByRole('navigation', { name: 'Номера заданий' })).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: 'Далее' })).toHaveLength(1);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '-12' } });
  fireEvent.click(screen.getByRole('button', { name: 'Задания · 1 из 20' }));
  expect(screen.getAllByRole('button', { name: /^Задание \d+:/ })).toHaveLength(20);
  fireEvent.click(screen.getByRole('button', { name: 'Задание 20: без ответа' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Задача 20' })).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Далее' })).toBeDisabled();
  const toggle = screen.getByRole('button', { name: 'Задания · 20 из 20' });
  fireEvent.click(toggle);
  fireEvent.click(screen.getByRole('button', { name: 'Задание 1: есть ответ' }));
  expect(screen.getByRole('textbox')).toHaveValue('-12');
  expect(screen.getByRole('button', { name: 'Назад' })).toBeDisabled();
});

it('preserves answers and closes the task sheet when rotating between mobile and desktop', () => {
  let mobile = true;
  const listeners = new Set<() => void>();
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: mobile, media: query, onchange: null, addListener: vi.fn(), removeListener: vi.fn(), addEventListener: (_: string, listener: unknown) => { if (typeof listener === 'function') listeners.add(listener as () => void); }, removeEventListener: (_: string, listener: unknown) => { if (typeof listener === 'function') listeners.delete(listener as () => void); }, dispatchEvent: vi.fn() }));
  render(<Example />);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: '3,25' } });
  fireEvent.click(screen.getByRole('button', { name: 'Задания · 1 из 30' }));
  expect(screen.getByRole('dialog')).toBeVisible();
  act(() => { mobile = false; listeners.forEach(listener => listener()); });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox')).toHaveValue('3,25');
  expect(screen.getAllByRole('button', { name: 'Далее' })).toHaveLength(1);
  act(() => { mobile = true; listeners.forEach(listener => listener()); });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('textbox')).toHaveValue('3,25');
});
