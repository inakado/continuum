import { z } from 'zod';
import { GradeBandSchema } from './library';
import { AssessmentTaskViewSchema, AssessmentTaskReferenceSchema } from './assessment-bank';
import { AssessmentAnswerSchema, AssignmentSelectionSchema } from './assessment-assignments';

export const ASSESSMENT_WORK_TASK_LIMIT = 500;
export const AssessmentWorkReferenceSchema = AssessmentTaskReferenceSchema;
const workItems = z.array(AssessmentWorkReferenceSchema).max(ASSESSMENT_WORK_TASK_LIMIT)
  .refine((items) => new Set(items.map((item) => item.taskId)).size === items.length, 'Задание уже включено в работу.');
const fields = {
  title: z.string().trim().min(1).max(200),
  instructions: z.string().max(10000),
  gradeBand: GradeBandSchema,
};
export const AssessmentWorkCreateSchema = z.strictObject({ id: z.uuid(), title: fields.title, gradeBand: fields.gradeBand, items: workItems.optional() });
export const AssessmentWorkUpdateSchema = z.strictObject({
  ...fields, requestId: z.uuid(), expectedRevision: z.number().int().positive(),
  items: workItems,
});
export const AssessmentWorkFreezeSchema = z.strictObject({ expectedRevision: z.number().int().positive() });
export const AssessmentWorkAnswerCheckSchema = z.strictObject({ taskId: z.uuid(), source: AssignmentSelectionSchema, answer: AssessmentAnswerSchema.nullable() });
export const AssessmentWorkAnswerCheckResultSchema = z.strictObject({ correct: z.boolean(), points: z.number().int().nonnegative(), maxPoints: z.number().int().positive() });
export const AssessmentWorkCopySchema = z.strictObject({ id: z.uuid(), expectedRevision: z.number().int().positive() });
export const AssessmentWorkArchiveSchema = z.strictObject({ isArchived: z.boolean(), expectedLifecycleRevision: z.number().int().positive() });
export const AssessmentWorkDeleteSchema = z.strictObject({ expectedRevision: z.number().int().positive(), expectedLifecycleRevision: z.number().int().positive() });
export const AssessmentWorkMutationResultSchema = z.object({ id: z.uuid() });
export const AssessmentWorkSummarySchema = z.object({
  id: z.uuid(), title: z.string(), gradeBand: GradeBandSchema, revision: z.number().int().positive(),
  taskCount: z.number().int().nonnegative(), maxPoints: z.number().int().nonnegative(), updatedAt: z.iso.datetime(),
  isArchived: z.boolean().optional(), lifecycleRevision: z.number().int().positive().optional(), canDelete: z.boolean().optional(),
});
export const AssessmentWorkDetailSchema = AssessmentWorkSummarySchema.extend({ instructions: z.string(), items: z.array(AssessmentTaskViewSchema), copySkippedTaskCount: z.number().int().nonnegative().optional() });
export const AssessmentWorkListSchema = z.array(AssessmentWorkSummarySchema.extend({ hasAssignments: z.boolean() }));
export const AssessmentWorkVersionSchema = z.object({
  id: z.uuid(), workId: z.uuid(), number: z.number().int().positive(), revision: z.number().int().positive(), createdAt: z.iso.datetime(),
  title: z.string(), instructions: z.string(), gradeBand: GradeBandSchema, items: z.array(AssessmentTaskViewSchema).min(1), maxPoints: z.number().int().positive(),
});
export type AssessmentWorkCreate = z.infer<typeof AssessmentWorkCreateSchema>;
export type AssessmentWorkAnswerCheck = z.infer<typeof AssessmentWorkAnswerCheckSchema>;
export type AssessmentWorkCopy = z.infer<typeof AssessmentWorkCopySchema>;
export type AssessmentWorkArchive = z.infer<typeof AssessmentWorkArchiveSchema>;
export type AssessmentWorkDelete = z.infer<typeof AssessmentWorkDeleteSchema>;
export type AssessmentWorkUpdate = z.infer<typeof AssessmentWorkUpdateSchema>;
export type AssessmentWorkReference = z.infer<typeof AssessmentWorkReferenceSchema>;
export type AssessmentWorkSummary = z.infer<typeof AssessmentWorkSummarySchema>;
export type AssessmentWorkDetail = z.infer<typeof AssessmentWorkDetailSchema>;
export type AssessmentWorkVersion = z.infer<typeof AssessmentWorkVersionSchema>;
