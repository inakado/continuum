import { expect, it } from 'vitest';
import { solutionTaskProgress } from './progress-labels';

it.each([
  [0, 1, '0 из 1 задания'],
  [1, 2, '1 из 2 заданий'],
  [1, 11, '1 из 11 заданий'],
  [1, 21, '1 из 21 задания'],
  [0, 22, '0 из 22 заданий'],
])('formats solution progress %s/%s with the correct noun', (count, total, label) => {
  expect(solutionTaskProgress(count, total)).toBe(label);
});
