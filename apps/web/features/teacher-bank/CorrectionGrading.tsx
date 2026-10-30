import type { AssessmentPackageTask } from '@continuum/shared';
import { taskGradingLabel } from './task-source';

export default function CorrectionGrading({ task }: { task: AssessmentPackageTask }) {
  let answer = '';
  switch (task.type) {
    case 'short_number': answer = `Ответ: ${task.grading.answer}. Допуск: ${task.grading.absoluteTolerance}.`; break;
    case 'short_text': answer = `Ответ: ${task.grading.acceptedAnswers.join('; ')}. Регистр ${task.grading.caseSensitive ? 'учитывается' : 'не учитывается'}.`; break;
    case 'single_choice': answer = `Верный вариант: ${task.options.findIndex(option => option.id === task.grading.correctOptionId) + 1}`; break;
    case 'multiple_choice': answer = `Верные варианты: ${task.grading.correctOptionIds.map(id => task.options.findIndex(option => option.id === id) + 1).join(', ')}`; break;
    case 'matching': answer = `Соответствие: ${task.rows.map(row => task.options.findIndex(option => option.id === task.grading.matches[row.id]) + 1).join(', ')}`; break;
  }
  return <div><p>{taskGradingLabel(task)}</p><p>{answer}</p></div>;
}
