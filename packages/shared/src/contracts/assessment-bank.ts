import { z } from 'zod';
import { AssessmentPackageTaskSchema } from './assessment-package';
import { GradeBandSchema } from './library';

export const AssessmentTaskTypeSchema = z.enum(['short_number', 'short_text', 'single_choice', 'multiple_choice', 'matching']);
export const AssessmentBankQuerySchema = z.object({
  gradeBand: GradeBandSchema.optional(),
  search: z.string().trim().max(200).default(''),
  topic: z.string().trim().max(200).default(''),
  type: AssessmentTaskTypeSchema.optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export const AssessmentTaskSummarySchema = z.object({
  id: z.uuid(), stableId: z.string(), title: z.string(), gradeBand: GradeBandSchema,
  topicPath: z.array(z.string()), type: AssessmentTaskTypeSchema, maxPoints: z.number(),
  source: z.object({ provider: z.string(), externalId: z.string().optional(), collection: z.string().optional(), sectionCode: z.string().optional(), taskNumber: z.number().optional(), examYear: z.number().optional(), examTaskNumber: z.number().optional() }),
  version: z.number().int().positive(), excerpt: z.string(),
});
export const AssessmentBankListSchema = z.object({
  tasks: z.array(AssessmentTaskSummarySchema), total: z.number(), topics: z.array(z.string()), pageSize: z.number(),
});
export const AssessmentTaskViewSchema = z.object({
  task: AssessmentPackageTaskSchema, statement: z.string(), solution: z.string().nullable(),
  images: z.record(z.string(), z.string()), version: z.number().int().positive(), id: z.string(),
});
export const AssessmentImportItemSchema = z.object({
  stableId: z.string(), title: z.string(), source: AssessmentTaskSummarySchema.shape.source,
  status: z.enum(['new', 'changed', 'unchanged']), version: z.number(),
});
export const AssessmentImportIssueSchema = z.object({ path: z.string(), message: z.string() });
export const AssessmentImportPreviewSchema = z.object({
  id: z.uuid().nullable(), title: z.string(), expiresAt: z.iso.datetime().nullable(),
  items: z.array(AssessmentImportItemSchema), issues: z.array(AssessmentImportIssueSchema),
});
export const AssessmentImportResultSchema = z.object({ added: z.number(), updated: z.number(), unchanged: z.number(), taskIds: z.array(z.uuid()) });
export type AssessmentBankQuery = z.infer<typeof AssessmentBankQuerySchema>;
export type AssessmentTaskSummary = z.infer<typeof AssessmentTaskSummarySchema>;
export type AssessmentTaskView = z.infer<typeof AssessmentTaskViewSchema>;
export type AssessmentImportPreview = z.infer<typeof AssessmentImportPreviewSchema>;
export type AssessmentImportResult = z.infer<typeof AssessmentImportResultSchema>;
