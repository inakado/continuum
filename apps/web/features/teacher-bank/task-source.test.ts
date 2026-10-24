import { describe, expect, it } from 'vitest';
import { taskSourceLabel, taskSourceDetails } from './task-source';

describe('task source metadata', () => {
  it('does not confuse provider ID, collection number, section and EGE number', () => {
    const source = { provider: 'Школково', externalId: '11121', collection: 'МКТ', taskNumber: 86, sectionCode: '7.05', examYear: 2026, examTaskNumber: 7 };
    expect(taskSourceLabel(source)).toBe('Школково · № 11121');
    expect(taskSourceDetails(source)).toEqual([
      ['Классификация', 'ЕГЭ'],
      ['Источник', 'Школково'], ['Номер в источнике', '11121'], ['Подборка', 'МКТ'],
      ['Номер в подборке', '86'], ['Раздел источника', '7.05'], ['Год ЕГЭ', '2026'], ['Номер задания ЕГЭ', '7'],
    ]);
  });
  it('handles authorial tasks without invented numbers', () => {
    expect(taskSourceLabel({ provider: 'Авторское' })).toBe('Авторское');
    expect(taskSourceDetails({ provider: 'Авторское' })).toEqual([['Классификация', 'Не указана'], ['Источник', 'Авторское']]);
  });
});
