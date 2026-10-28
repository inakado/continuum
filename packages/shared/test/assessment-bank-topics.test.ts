import { expect, it } from 'vitest';
import { AssessmentBankQuerySchema } from '../src/contracts/assessment-bank';

it('validates a complete topic path in HTTP and typed queries', () => {
  const path = ['Механика', 'Кинематика', 'Равноускоренное движение', 'Прямолинейное движение', 'Графики'];
  expect(AssessmentBankQuerySchema.parse({ topicPath: JSON.stringify(path) }).topicPath).toEqual(path);
  expect(AssessmentBankQuerySchema.parse({ topicPath: path }).topicPath).toEqual(path);
  for (const topicPath of ['broken', 'null', '[]', '[""]', JSON.stringify([...path, 'Шестой уровень'])]) {
    expect(AssessmentBankQuerySchema.safeParse({ topicPath }).success).toBe(false);
  }
  expect(AssessmentBankQuerySchema.parse({ topic: 'МКТ' }).topic).toBe('МКТ');
});
