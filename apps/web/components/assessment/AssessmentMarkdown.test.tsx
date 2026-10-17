import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import AssessmentMarkdown from './AssessmentMarkdown';

afterEach(cleanup);

it('renders table alignment from Markdown inside its own keyboard-accessible scroll region', () => {
  render(<AssessmentMarkdown images={{}} text={'Условие.\n\n| Величина | Значение |\n| :--- | ---: |\n| Скорость | 100 |'} />);
  const region = screen.getByRole('region', { name: 'Таблица данных' });
  expect(region).toHaveAttribute('tabindex', '0');
  expect(within(region).getByRole('columnheader', { name: 'Величина' })).toHaveStyle({ textAlign: 'left' });
  expect(within(region).getByRole('columnheader', { name: 'Значение' })).toHaveStyle({ textAlign: 'right' });
  expect(within(region).getByRole('cell', { name: '100' })).toHaveStyle({ textAlign: 'right' });
  expect(screen.getByText('Условие.')).toBeVisible();
});
