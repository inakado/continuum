import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import BankMarkdown from '@/components/assessment/AssessmentMarkdown';

afterEach(cleanup);
const images = { 'images/graph.png': '/teacher/assessment-bank/tasks/task/images/graph.png?version=1' };

it('requests private images with credentialed CORS, not blocked no-cors embedding', () => {
  render(<BankMarkdown text="![График](images/graph.png)" images={images} />);
  expect(screen.getByRole('img', { name: 'График' })).toHaveAttribute('crossorigin', 'use-credentials');
});

it('replaces a failed image with a compact retry instead of a broken image box', () => {
  render(<BankMarkdown text="![График](images/graph.png)" images={images} />);
  fireEvent.error(screen.getByRole('img', { name: 'График' }));
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.getByText('Не удалось загрузить рисунок «График».')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Повторить загрузку рисунка' }));
  expect(screen.getByRole('img', { name: 'График' })).toBeVisible();
});
