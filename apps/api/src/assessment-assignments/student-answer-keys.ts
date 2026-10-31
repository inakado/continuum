import type { AssessmentPackageTask, StudentAnswerKey } from '@continuum/shared';

// Deliberately excludes tolerance, accepted alternatives, grading policies and solutions.
export function studentAnswerKey(task: AssessmentPackageTask): StudentAnswerKey | null {
  switch (task.type) {
    case 'extended': return null;
    case 'short_number': return { type: task.type, value: task.grading.answer };
    case 'short_text': return { type: task.type, value: task.grading.acceptedAnswers[0] };
    case 'single_choice': return { type: task.type, optionId: task.grading.correctOptionId };
    case 'multiple_choice': return { type: task.type, optionIds: task.grading.correctOptionIds };
    case 'matching': return { type: task.type, matches: task.grading.matches };
  }
}
