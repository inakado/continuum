import { z } from 'zod';
import { GradeBandSchema } from './library';
import { AssessmentTaskViewSchema } from './assessment-bank';

export const ASSESSMENT_WORK_TASK_LIMIT = 500;
export const AssessmentWorkReferenceSchema = z.strictObject({ taskId: z.uuid(), version: z.number().int().positive() });
const fields = {
  title: z.string().trim().min(1).max(200),
  instructions: z.string().max(10000),
  gradeBand: GradeBandSchema,
};
export const AssessmentWorkCreateSchema = z.strictObject({ id: z.uuid(), title: fields.title, gradeBand: fields.gradeBand });
export const AssessmentWorkUpdateSchema = z.strictObject({
  ...fields, requestId: z.uuid(), expectedRevision: z.number().int().positive(),
  items: z.array(AssessmentWorkReferenceSchema).max(ASSESSMENT_WORK_TASK_LIMIT)
    .refine((items) => new Set(items.map((item) => item.taskId)).size === items.length, 'Задание уже включено в работу.'),
});
export const AssessmentWorkFreezeSchema = z.strictObject({ expectedRevision: z.number().int().positive() });
export const AssessmentWorkSummarySchema = z.object({
  id: z.uuid(), title: z.string(), gradeBand: GradeBandSchema, revision: z.number().int().positive(),
  taskCount: z.number().int().nonnegative(), maxPoints: z.number().int().nonnegative(), updatedAt: z.iso.datetime(),
});
export const AssessmentWorkDetailSchema = AssessmentWorkSummarySchema.extend({ instructions: z.string(), items: z.array(AssessmentTaskViewSchema) });
export const AssessmentWorkListSchema = z.array(AssessmentWorkSummarySchema);
export const AssessmentWorkVersionSchema = z.object({
  id: z.uuid(), workId: z.uuid(), number: z.number().int().positive(), revision: z.number().int().positive(), createdAt: z.iso.datetime(),
  title: z.string(), instructions: z.string(), gradeBand: GradeBandSchema, items: z.array(AssessmentTaskViewSchema).min(1), maxPoints: z.number().int().positive(),
});
export type AssessmentWorkCreate = z.infer<typeof AssessmentWorkCreateSchema>;
export type AssessmentWorkUpdate = z.infer<typeof AssessmentWorkUpdateSchema>;
export type AssessmentWorkReference = z.infer<typeof AssessmentWorkReferenceSchema>;
export type AssessmentWorkSummary = z.infer<typeof AssessmentWorkSummarySchema>;
export type AssessmentWorkDetail = z.infer<typeof AssessmentWorkDetailSchema>;
export type AssessmentWorkVersion = z.infer<typeof AssessmentWorkVersionSchema>;
