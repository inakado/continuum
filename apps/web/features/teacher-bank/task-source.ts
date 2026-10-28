import type { AssessmentPackageTask, AssessmentTaskSummary } from '@continuum/shared';
type Source = AssessmentTaskSummary['source'];

export function taskSourceLabel(source: Source) {
  return source.externalId ? `${source.provider} · № ${source.externalId}` : source.provider;
}
export function taskSourceDetails(source: Source): [string, string][] {
  const exam = source.exam === 'ege' || (source.exam === undefined && source.examYear !== undefined && source.examTaskNumber !== undefined);
  const kind = { taskbook: 'Задачник', platform: 'Образовательная платформа', original: 'Авторское' } as const;
  return [
    ['Классификация', exam ? 'ЕГЭ' : source.exam === 'none' ? 'Не ЕГЭ' : 'Не указана'],
    ['Вид источника', source.kind ? kind[source.kind] : undefined],
    [source.kind === 'taskbook' ? 'Автор / составитель' : source.kind === 'original' ? 'Автор' : source.kind === 'platform' ? 'Платформа' : 'Источник', source.provider],
    [source.kind === 'taskbook' ? 'Номер задачи в задачнике' : 'ID / номер в источнике', source.externalId],
    [source.kind === 'taskbook' ? 'Название задачника' : source.kind === 'platform' ? 'Подраздел источника' : 'Раздел / сборник', source.kind === 'original' ? undefined : source.collection],
    [source.kind === 'platform' || source.sectionCode ? 'Номер задачи в подразделе' : 'Порядковый номер задачи', source.taskNumber?.toString()], ['Код подраздела', source.sectionCode],
    ['Год формата ЕГЭ', source.examYear?.toString()], ['Номер задания ЕГЭ', source.examTaskNumber?.toString()],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
}
export const taskTypeLabels = { short_number: 'Числовой ответ', short_text: 'Текстовый ответ', single_choice: 'Один вариант', multiple_choice: 'Несколько вариантов', matching: 'Соответствие', extended: 'Развёрнутая задача' } as const;
export function taskGradingLabel(task: AssessmentPackageTask) {
  if (task.type === 'extended') return 'По рецензии преподавателя';
  switch (task.grading.policy) {
    case 'ege_physics_matching_v1': return 'ЕГЭ: соответствие · 0–2 балла';
    case 'ege_physics_multiple_choice_v1': return 'ЕГЭ: выбор утверждений · 0–2 балла';
    default: return 'Полное совпадение';
  }
}
export function pointsLabel(points: number) {
  return `${points} ${points % 100 >= 11 && points % 100 <= 14 ? 'баллов' : points % 10 === 1 ? 'балл' : points % 10 >= 2 && points % 10 <= 4 ? 'балла' : 'баллов'}`;
}
