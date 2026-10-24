import { BadRequestException } from '@nestjs/common';
import type { AssessmentAnswer, AssessmentPackageTask } from '@continuum/shared';

function decimal(value: string) {
  const match = /^([+-]?)(?:(\d+)(?:[.,](\d*))?|[.,](\d+))(?:[eE]([+-]?\d{1,3}))?$/.exec(value.trim());
  if (!match) return null;
  const fraction = match[3] ?? match[4] ?? '';
  return { coefficient: BigInt(`${match[1] === '-' ? '-' : ''}${match[2] ?? '0'}${fraction}`), scale: fraction.length - Number(match[5] ?? 0) };
}
function numberMatches(input: string, expected: string, tolerance: number) {
  const actual = decimal(input), target = decimal(expected), allowed = decimal(String(tolerance));
  if (!actual || !target || !allowed) return false;
  const scale = Math.max(actual.scale, target.scale, allowed.scale);
  const aligned = (value: NonNullable<ReturnType<typeof decimal>>) => value.coefficient * 10n ** BigInt(scale - value.scale);
  const delta = aligned(actual) - aligned(target);
  return (delta < 0n ? -delta : delta) <= aligned(allowed);
}
const text = (value: string, sensitive: boolean) => sensitive ? value.normalize('NFC').trim() : value.normalize('NFC').trim().toLocaleLowerCase('ru');

function egeScore(task: AssessmentPackageTask, answer: AssessmentAnswer): number | null {
  if (task.type === 'matching' && answer.type === 'matching' && task.grading.policy === 'ege_physics_matching_v1') return task.rows.filter((row) => answer.matches[row.id] === task.grading.matches[row.id]).length;
  if (task.type === 'multiple_choice' && answer.type === 'multiple_choice' && task.grading.policy === 'ege_physics_multiple_choice_v1') {
    const expected = new Set(task.grading.correctOptionIds), selected = new Set(answer.optionIds);
    const missing = [...expected].filter((id) => !selected.has(id)).length;
    const extra = [...selected].filter((id) => !expected.has(id)).length;
    return Math.max(0, 2 - Math.max(missing, extra));
  }
  return null;
}

export function gradeAssessmentAnswer(task: AssessmentPackageTask, answer: AssessmentAnswer | null): number {
  if (!answer || task.type !== answer.type) return 0;
  const partial = egeScore(task, answer);
  if (partial !== null) return partial;
  let correct = false;
  if (task.type === 'short_number' && answer.type === 'short_number') correct = numberMatches(answer.value, task.grading.answer, task.grading.absoluteTolerance);
  if (task.type === 'short_text' && answer.type === 'short_text') correct = task.grading.acceptedAnswers.some((value) => text(value, task.grading.caseSensitive) === text(answer.value, task.grading.caseSensitive));
  if (task.type === 'single_choice' && answer.type === 'single_choice') correct = answer.optionId === task.grading.correctOptionId;
  if (task.type === 'multiple_choice' && answer.type === 'multiple_choice') correct = answer.optionIds.length === task.grading.correctOptionIds.length && task.grading.correctOptionIds.every((id) => answer.optionIds.includes(id));
  if (task.type === 'matching' && answer.type === 'matching') correct = Object.keys(answer.matches).length === task.rows.length && task.rows.every((row) => answer.matches[row.id] === task.grading.matches[row.id]);
  return correct ? task.maxPoints : 0;
}

export function answerIsFilled(answer: AssessmentAnswer | undefined, task: AssessmentPackageTask): boolean {
  if (!answer || answer.type !== task.type) return false;
  switch (answer.type) {
    case 'short_number': case 'short_text': return Boolean(answer.value.trim());
    case 'single_choice': return answer.optionId !== null;
    case 'multiple_choice': return answer.optionIds.length > 0;
    case 'matching': return task.type === 'matching' && task.rows.every((row) => Boolean(answer.matches[row.id]));
  }
}

export function validateAssessmentAnswer(answer: AssessmentAnswer | null, task: AssessmentPackageTask) {
  if (!answer) return;
  if (answer.type !== task.type) throw new BadRequestException('Тип ответа не соответствует заданию.');
  const allowed = 'options' in task ? new Set(task.options.map((item) => item.id)) : new Set<string>();
  let selected: string[];
  switch (answer.type) {
    case 'single_choice': selected = answer.optionId ? [answer.optionId] : []; break;
    case 'multiple_choice': selected = answer.optionIds; break;
    case 'matching': selected = Object.values(answer.matches); break;
    default: selected = [];
  }
  if (selected.some((id) => !allowed.has(id))) throw new BadRequestException('Вариант ответа отсутствует в задании.');
  if (answer.type === 'matching' && task.type === 'matching' && Object.keys(answer.matches).some((id) => !task.rows.some((row) => row.id === id))) throw new BadRequestException('Позиция соответствия отсутствует в задании.');
}
