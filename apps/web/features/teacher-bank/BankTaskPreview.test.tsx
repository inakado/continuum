import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { AssessmentTaskView } from '@continuum/shared';
import BankTaskPreview from './BankTaskPreview';

vi.mock('@/components/assessment/AssessmentMarkdown', () => ({ default: ({ text }: { text: string }) => <div>{text}</div> }));
afterEach(cleanup);

it('labels matching positions so the answer key can be mapped to conditions', () => {
  const data: AssessmentTaskView = {
    id: '00000000-0000-4000-8000-000000000001', version: 1, statement: 'Установите соответствие.', solution: null, images: {},
    task: { id: 'sample', title: 'Графики', gradeBand: 'grade_10_11', topicPath: ['МКТ'], maxPoints: 2, source: { provider: 'Авторское' }, type: 'matching', rows: [{ id: 'a', content: 'Радиус' }, { id: 'b', content: 'Сила' }], options: [{ id: '1', content: 'Увеличится' }, { id: '2', content: 'Уменьшится' }], grading: { matches: { a: '1', b: '2' } } },
  };
  render(<BankTaskPreview data={data} />);
  const positions = screen.getByRole('region', { name: 'Позиции соответствия' });
  expect(within(positions).getByText('А')).toBeVisible();
  expect(within(positions).getByText('Б')).toBeVisible();
  expect(within(positions).getByText('Радиус')).toBeVisible();
  expect(within(positions).getByText('Сила')).toBeVisible();
});

it('uses Russian presentation labels instead of internal IDs and removes duplicate legacy labels', () => {
  const data: AssessmentTaskView = {
    id: '00000000-0000-4000-8000-000000000001', version: 1, statement: 'Установите соответствие.', solution: null, images: {},
    task: { id: 'sample', title: 'Величины', gradeBand: 'grade_10_11', topicPath: ['МКТ'], maxPoints: 2, source: { provider: 'Авторское' }, type: 'matching', rows: [{ id: 'radius', content: 'А) Радиус' }, { id: 'force', content: 'Б) Сила' }], options: [{ id: 'up', content: 'Увеличится' }, { id: 'down', content: 'Уменьшится' }], grading: { matches: { radius: 'down', force: 'down' } } },
  };
  render(<BankTaskPreview data={data} />);
  expect(screen.queryByText(/RADIUS|FORCE|DOWN|UP/)).not.toBeInTheDocument();
  expect(screen.queryByText('А) Радиус')).not.toBeInTheDocument();
  expect(screen.getByText('А — 2; Б — 2')).toBeVisible();
  expect(screen.getByText('Радиус')).toBeVisible();
  expect(screen.getByText('Сила')).toBeVisible();
});
