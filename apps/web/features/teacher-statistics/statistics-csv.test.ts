import { expect, it } from 'vitest';
import type { AssessmentStatistics, StatisticsStudent } from '@continuum/shared';
import { statisticsCsv } from './statistics-csv';

const part = { maxPoints: 2, scoredCount: 1, averagePoints: 0 };
const data: AssessmentStatistics = {
  versionId: 'version', workId: 'work', title: 'Контрольная; "МКТ"', versionNumber: 2,
  classes: [{ id: 'group', classId: null, title: '11А', academicYear: 2026 }],
  tasks: ['Число', 'Решение'].map((title, index) => ({ id: String(index), stableId: String(index), title, gradeBand: 'grade_10_11', topicPath: ['МКТ'], type: index ? 'extended' : 'short_number', maxPoints: 2, version: 1, excerpt: '', source: { provider: 'Авторское' } })),
  students: [], summary: { studentCount: 1, finalCount: 0, automatic: part, extended: part, total: { ...part, maxPoints: 4 } }, distributions: [], classResults: [],
};
const student: StatisticsStudent = { id: 'student', assignmentId: 'group', name: 'Иванов Иван', login: 'ivanov', scores: [{ state: 'scored', points: 0 }, { state: 'awaiting_review' }], automaticPoints: 0, extendedPoints: null, totalPoints: null };

it('exports numeric points, real zero and independent pending states without keys, percentages or invented final results', () => {
  const csv = statisticsCsv(data, [student]);
  expect(csv.startsWith('\uFEFF')).toBe(true);
  expect(csv).toContain('"Контрольная; ""МКТ""";"2";"Иванов Иван";"ivanov";"11А";"2026–2027"');
  expect(csv).toContain('"0";"Есть результат";"";"Ожидает проверки";"0";"";""');
  expect(csv).toContain('"Итог (из 4)"');
  expect(csv).not.toContain('%');
  expect(csv.split('\r\n')).toHaveLength(2);
  const selected = statisticsCsv(data, [student], '1');
  expect(selected).not.toContain('1. Число');
  expect(selected).toContain('2. Решение (из 2)');
  expect(selected).toContain('"Тестовая часть (из 2)"');
});

it('quotes multiline cells and neutralizes spreadsheet formula prefixes, including leading whitespace', () => {
  for (const name of ['=1+1', '+1', '-1', '@SUM(A1)', '\t=1', '  =1', '\n@SUM(A1)']) {
    const csv = statisticsCsv(data, [{ ...student, name }]);
    expect(csv).toContain(`"'${name}"`);
  }
  const csv = statisticsCsv({ ...data, title: '  =HYPERLINK("bad")' }, [{ ...student, name: 'Иванов\nИван', login: '+user' }]);
  expect(csv).toContain('"\'  =HYPERLINK(""bad"")"');
  expect(csv).toContain('"Иванов\nИван";"\'+user"');
});
