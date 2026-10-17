import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { PublicAssessmentItem } from '@continuum/shared';
import StudentAnswerInput from './StudentAnswerInput';
import styles from './student-works.module.css';

afterEach(cleanup);

it.each(['single_choice', 'multiple_choice'] as const)('keeps the %s control in an inline baseline wrapper without changing selection', (type) => {
  const item: PublicAssessmentItem = {
    id: 'ions', title: 'Ионы', type, statement: 'Выберите ответ', maxPoints: 1, images: {},
    options: [{ id: 'one', content: 'Все ионы имеют отрицательный заряд.' }, { id: 'two', content: 'Длинный ответ.\n\nВторой абзац ответа.' }],
  };
  const onChange = vi.fn();
  render(<StudentAnswerInput item={item} onChange={onChange} />);
  const control = screen.getByRole(type === 'single_choice' ? 'radio' : 'checkbox', { name: 'Вариант 1: Ионы' });
  expect(control.parentElement).toHaveClass(styles.choiceControl);
  expect(control.closest('label')).toHaveTextContent('1Все ионы имеют отрицательный заряд.');
  expect(screen.getByText('Второй абзац ответа.')).toBeVisible();
  fireEvent.click(screen.getByText('Все ионы имеют отрицательный заряд.'));
  expect(onChange).toHaveBeenCalledWith(type === 'single_choice'
    ? { type, optionId: 'one' }
    : { type, optionIds: ['one'] });
});

it('clears a single selected answer and describes signed decimal input without changing its value', () => {
  const onChange = vi.fn();
  const item: PublicAssessmentItem = { id: 'one', type: 'single_choice', title: 'Выбор', statement: 'Условие', maxPoints: 1, images: {}, options: [{ id: 'a', content: 'Первый' }, { id: 'b', content: 'Второй' }] };
  const view = render(<StudentAnswerInput item={item} answer={{ type: 'single_choice', optionId: 'a' }} onChange={onChange} />);
  fireEvent.click(screen.getByRole('button', { name: 'Очистить ответ' }));
  expect(onChange).toHaveBeenCalledWith({ type: 'single_choice', optionId: null });
  view.rerender(<StudentAnswerInput item={{ id: 'number', type: 'short_number', title: 'Число', statement: '', maxPoints: 1, images: {}, unit: 'Па' }} onChange={onChange} />);
  const input = screen.getByRole('textbox');
  expect(input).toHaveAccessibleDescription(/минус, запятую или точку/);
  fireEvent.change(input, { target: { value: '-2,5' } });
  expect(onChange).toHaveBeenLastCalledWith({ type: 'short_number', value: '-2,5' });
});
