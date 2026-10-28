import { describe, expect, it } from 'vitest';
import { taskSourceLabel, taskSourceDetails } from './task-source';

describe('task source metadata', () => {
  it('does not confuse provider ID, collection number, section and EGE number', () => {
    const source = { provider: 'Школково', kind: 'platform' as const, externalId: '11121', collection: '7.05 МКТ', taskNumber: 86, sectionCode: '7.05', examYear: 2026, examTaskNumber: 7 };
    expect(taskSourceLabel(source)).toBe('Школково · № 11121');
    expect(taskSourceDetails(source)).toEqual([
      ['Классификация', 'ЕГЭ'],
      ['Вид источника', 'Образовательная платформа'],
      ['Платформа', 'Школково'], ['ID / номер в источнике', '11121'], ['Подраздел источника', '7.05 МКТ'],
      ['Номер задачи в подразделе', '86'], ['Код подраздела', '7.05'], ['Год формата ЕГЭ', '2026'], ['Номер задания ЕГЭ', '7'],
    ]);
  });
  it('shows a complete catalogue subsection without treating it as a collection', () => {
    const details = taskSourceDetails({ provider: 'Школково', kind: 'platform', exam: 'ege', externalId: '16640', collection: '1.06 Равноускоренное движение', sectionCode: '1.06', taskNumber: 8, examYear: 2026, examTaskNumber: 1 });
    expect(details).toEqual(expect.arrayContaining([
      ['Подраздел источника', '1.06 Равноускоренное движение'],
      ['Номер задачи в подразделе', '8'], ['Код подраздела', '1.06'], ['ID / номер в источнике', '16640'],
    ]));
    expect(details.some(([label]) => label === 'Подборка')).toBe(false);
  });
  it('keeps book titles and original problem numbers even when the title starts with a section code', () => {
    const details = taskSourceDetails({ provider: 'Автор сборника', kind: 'taskbook', exam: 'none', collection: '1.06 Сборник задач по физике', sectionCode: '1.06', externalId: '§2.123' });
    expect(details).toEqual(expect.arrayContaining([
      ['Автор / составитель', 'Автор сборника'], ['Название задачника', '1.06 Сборник задач по физике'], ['Номер задачи в задачнике', '§2.123'],
    ]));
    expect(details.some(([label]) => label === 'Подраздел источника')).toBe(false);
  });
  it('uses the same subsection label for other platforms without requiring a code prefix', () => {
    const details = taskSourceDetails({ provider: 'Другая платформа', kind: 'platform', collection: 'Равноускоренное движение', taskNumber: 3, externalId: 'motion-42' });
    expect(details).toEqual(expect.arrayContaining([
      ['Подраздел источника', 'Равноускоренное движение'], ['Номер задачи в подразделе', '3'], ['ID / номер в источнике', 'motion-42'],
    ]));
    expect(details.some(([label]) => label === 'Код подраздела')).toBe(false);
  });
  it('shows an original task author without a book or collection', () => {
    expect(taskSourceDetails({ provider: 'Иван Иванов', kind: 'original', exam: 'none' })).toEqual([
      ['Классификация', 'Не ЕГЭ'], ['Вид источника', 'Авторское'], ['Автор', 'Иван Иванов'],
    ]);
  });
  it('handles authorial tasks without invented numbers', () => {
    expect(taskSourceLabel({ provider: 'Авторское' })).toBe('Авторское');
    expect(taskSourceDetails({ provider: 'Авторское' })).toEqual([['Классификация', 'Не указана'], ['Источник', 'Авторское']]);
  });
});
