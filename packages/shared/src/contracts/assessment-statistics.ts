import { z } from 'zod';
import { AssessmentTaskSummarySchema, AssessmentTaskViewSchema } from './assessment-bank';
import { AssessmentAnswerSchema, AssignmentSummarySchema } from './assessment-assignments';
import { SolutionAnswerSchema } from './assessment-solutions';

const count = z.number().int().nonnegative();
export const StatisticsCellSchema = z.discriminatedUnion('state', [
  z.strictObject({ state: z.literal('scored'), points: count }),
  z.strictObject({ state: z.enum(['not_started', 'in_progress', 'no_photos', 'awaiting_review', 'unavailable']) }),
]);
export const ScoreDistributionSchema = z.strictObject({
  scoredCount: count, pendingCount: count,
  buckets: z.array(z.strictObject({ points: count, count, percentage: z.number().min(0).max(100).nullable() })),
});
const part = z.strictObject({ maxPoints: count, scoredCount: count, averagePoints: z.number().nonnegative().nullable() });
export const StatisticsStudentSchema = z.strictObject({
  id: z.uuid(), assignmentId: z.uuid(), name: z.string(), login: z.string(),
  displayName: z.string().optional(),
  scores: z.array(StatisticsCellSchema), automaticPoints: count.nullable(), extendedPoints: count.nullable(), totalPoints: count.nullable(),
});
export const StatisticsSummarySchema = z.strictObject({
  studentCount: count, finalCount: count, automatic: part, extended: part, total: part,
});
export const AssessmentStatisticsSchema = z.strictObject({
  versionId: z.uuid(), workId: z.uuid(), title: z.string(), versionNumber: z.number().int().positive(),
  classes: AssignmentSummarySchema.shape.classes,
  tasks: z.array(AssessmentTaskSummarySchema),
  students: z.array(StatisticsStudentSchema),
  summary: StatisticsSummarySchema,
  distributions: z.array(ScoreDistributionSchema),
  classResults: z.array(z.strictObject({ assignmentId: z.uuid(), summary: StatisticsSummarySchema, distributions: z.array(ScoreDistributionSchema) })),
});
export const StatisticsTaskDetailSchema = z.strictObject({
  item: AssessmentTaskViewSchema,
  student: z.strictObject({ name: z.string(), answer: AssessmentAnswerSchema.nullable(), score: StatisticsCellSchema, solution: SolutionAnswerSchema.nullable() }).nullable(),
});
export type StatisticsCell = z.infer<typeof StatisticsCellSchema>;
export type ScoreDistribution = z.infer<typeof ScoreDistributionSchema>;
export type StatisticsStudent = z.infer<typeof StatisticsStudentSchema>;
export type StatisticsSummary = z.infer<typeof StatisticsSummarySchema>;
export type AssessmentStatistics = z.infer<typeof AssessmentStatisticsSchema>;
export type StatisticsTaskDetail = z.infer<typeof StatisticsTaskDetailSchema>;
