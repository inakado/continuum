import type { AssessmentStatistics, StatisticsStudent } from '@continuum/shared';
import { statisticsStateLabels } from './statistics-table';

const csvCell = (value: string | number | null) => {
  const text = value === null ? '' : String(value);
  const safe = /^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

export function statisticsCsv(data: AssessmentStatistics, students: StatisticsStudent[], taskId = '') {
  const tasks = data.tasks.map((task, index) => ({ task, index })).filter(({ task }) => !taskId || task.id === taskId);
  const parts = [
    ...(data.summary.automatic.maxPoints > 0 ? [{ label: 'Тестовая часть', max: data.summary.automatic.maxPoints, key: 'automaticPoints' as const }] : []),
    ...(data.summary.extended.maxPoints > 0 ? [{ label: 'Развёрнутые задачи', max: data.summary.extended.maxPoints, key: 'extendedPoints' as const }] : []),
    { label: 'Итог', max: data.summary.total.maxPoints, key: 'totalPoints' as const },
  ];
  const headers = ['Работа', 'Версия', 'Ученик', 'Логин', 'Класс', 'Учебный год',
    ...tasks.flatMap(({ task, index }) => [`${index + 1}. ${task.title} (из ${task.maxPoints})`, `Состояние задания ${index + 1}`]),
    ...parts.map(({ label, max }) => `${label} (из ${max})`),
  ];
  const rows = students.map((student) => {
    const group = data.classes.find((item) => item.id === student.assignmentId);
    return [data.title, data.versionNumber, student.name, student.login, group?.title ?? '', group ? `${group.academicYear}–${group.academicYear + 1}` : '',
      ...tasks.flatMap(({ index }): (string | number | null)[] => {
        const cell = student.scores[index];
        return cell?.state === 'scored' ? [cell.points, 'Есть результат'] : [null, cell ? statisticsStateLabels[cell.state] : 'Нет детализации'];
      }),
      ...parts.map(({ key }) => student[key]),
    ];
  });
  return '\uFEFF' + [headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n');
}

export function downloadStatisticsCsv(data: AssessmentStatistics, students: StatisticsStudent[], taskId = '') {
  const url = URL.createObjectURL(new Blob([statisticsCsv(data, students, taskId)], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `Статистика-${data.title.replace(/[^\p{L}\p{N}-]/gu, '_').slice(0, 80)}-v${data.versionNumber}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
