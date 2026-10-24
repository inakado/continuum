export const workGrades = { grade_7: '7 класс', grade_8: '8 класс', grade_9: '9 класс', grade_10_11: '10–11 классы' } as const;
export const workStateLabel = (isArchived?: boolean) => isArchived ? 'Архив' : 'Черновик';
export function taskCountLabel(count: number) {
  const suffix = count % 100 >= 11 && count % 100 <= 14 ? 'заданий' : count % 10 === 1 ? 'задание' : count % 10 >= 2 && count % 10 <= 4 ? 'задания' : 'заданий';
  return `${count} ${suffix}`;
}
