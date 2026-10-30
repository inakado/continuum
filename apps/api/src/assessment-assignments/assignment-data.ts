import { createHash } from 'node:crypto';
import { z } from 'zod';
import { gradeAssessmentAnswer } from '../common/assessment-grading';
import { AssessmentAnswerSchema, type PublicAssessmentItem } from '@continuum/shared';
import type { AssessmentRecipient, Prisma } from '@prisma/client';
import type { WorkSnapshotSchema } from '../assessment-works/assessment-works-read.service';

export const answersSchema = z.record(z.uuid(), AssessmentAnswerSchema);
export const inputHash = (input: object) => createHash('sha256').update(JSON.stringify(input)).digest('hex');
export const json = (input: object): Prisma.InputJsonValue => JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue;
export const attemptStatus = (row: { startedAt: Date | null; completedAt: Date | null }) => row.completedAt ? 'completed' as const : row.startedAt ? 'in_progress' as const : 'not_started' as const;
export function attemptState(row: Pick<AssessmentRecipient, 'revision' | 'startedAt' | 'completedAt' | 'answeredCount' | 'correctCount' | 'incorrectCount' | 'points'> & { answers?: Prisma.JsonValue }, snapshot: WorkSnapshot) {
  const automatic = snapshot.items.filter((item) => item.data.task.type !== 'extended');
  const answers = row.completedAt && row.answers !== undefined ? answersSchema.parse(row.answers) : undefined;
  const taskResults = answers ? Object.fromEntries(automatic.map(item => [item.taskId, { points: gradeAssessmentAnswer(item.data.task, answers[item.taskId] ?? null), maxPoints: item.data.task.maxPoints }])) : undefined;
  return { ...(taskResults ? { taskResults } : {}), revision: row.revision, status: attemptStatus(row), answeredCount: row.answeredCount, startedAt: row.startedAt?.toISOString() ?? null, completedAt: row.completedAt?.toISOString() ?? null,
    result: row.completedAt ? { correctCount: row.correctCount!, incorrectCount: row.incorrectCount!, partialCount: automatic.length - row.correctCount! - row.incorrectCount!, points: row.points!, maxPoints: automatic.reduce((sum, item) => sum + item.data.task.maxPoints, 0) } : null };
}
export type WorkSnapshot = z.infer<typeof WorkSnapshotSchema>;
export function publicItem(recipientId: string, item: WorkSnapshot['items'][number] & { presentationVersion?: number }): PublicAssessmentItem {
  const task = item.data.task;
  const base = { id: item.taskId, title: task.title, maxPoints: task.maxPoints, statement: item.data.statement,
    images: Object.fromEntries(item.data.images.map((image) => [image.path, `/student/assessment-works/${recipientId}/items/${item.taskId}/images/${encodeURIComponent(image.path.slice('images/'.length))}?presentation=${item.presentationVersion ?? item.version}`])) };
  switch (task.type) {
    case 'short_number': return { ...base, type: task.type, ...(task.unit ? { unit: task.unit } : {}) };
    case 'short_text': case 'extended': return { ...base, type: task.type };
    case 'single_choice': case 'multiple_choice': return { ...base, type: task.type, options: task.options };
    case 'matching': return { ...base, type: task.type, rows: task.rows, options: task.options };
  }
}
