import { z } from 'zod';
import { AssessmentPackageTaskSchema, AssessmentTaskSourceSchema } from './assessment-package';
import { GradeBandSchema } from './library';

export const AssessmentTaskTypeSchema = z.enum(['short_number', 'short_text', 'single_choice', 'multiple_choice', 'matching', 'extended']);
export const AssessmentBankQuerySchema = z.object({
  gradeBand: GradeBandSchema.optional(),
  search: z.string().trim().max(200).default(''),
  topic: z.string().trim().max(200).default(''),
  type: AssessmentTaskTypeSchema.optional(),
  exam: z.enum(['ege', 'none']).optional(),
  source: z.string().trim().min(1).max(160).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export const AssessmentTaskSummarySchema = z.object({
  id: z.uuid(), stableId: z.string(), title: z.string(), gradeBand: GradeBandSchema,
  topicPath: z.array(z.string()), type: AssessmentTaskTypeSchema, maxPoints: z.number(),
  source: AssessmentTaskSourceSchema,
  version: z.number().int().positive(), excerpt: z.string(),
});
export const AssessmentBankListSchema = z.object({
  tasks: z.array(AssessmentTaskSummarySchema), total: z.number(), topics: z.array(z.string()), sources: z.array(z.string()).optional(), pageSize: z.number(),
});
export const AssessmentTaskViewSchema = z.object({
  task: AssessmentPackageTaskSchema, statement: z.string(), solution: z.string().nullable(),
  images: z.record(z.string(), z.string()), version: z.number().int().positive(), id: z.string(),
  lifecycleRevision: z.number().int().positive().optional(),
});
export const AssessmentImportItemSchema = z.object({
  stableId: z.string(), title: z.string(), source: AssessmentTaskSummarySchema.shape.source,
  status: z.enum(['new', 'changed', 'unchanged']), version: z.number(),
});
export const AssessmentImportIssueSchema = z.object({ path: z.string(), message: z.string() });
const duplicateTarget = { stableId: z.string(), title: z.string(), version: z.number().int().positive(), source: AssessmentTaskSourceSchema };
export const AssessmentDuplicateMatchSchema = z.object({
  target: z.discriminatedUnion('location', [z.object({ ...duplicateTarget, location: z.literal('bank'), taskId: z.uuid() }), z.object({ ...duplicateTarget, location: z.literal('package') })]),
  reasons: z.array(z.enum(['source', 'statement'])).min(1).max(2),
});
export const AssessmentDuplicateHintsSchema = z.object({
  status: z.enum(['complete', 'unavailable']),
  tasks: z.array(z.object({ stableId: z.string(), matches: z.array(AssessmentDuplicateMatchSchema).max(5), hasMore: z.boolean() })).max(500),
});
export type AssessmentDuplicateMatch = z.infer<typeof AssessmentDuplicateMatchSchema>;
export type AssessmentDuplicateHints = z.infer<typeof AssessmentDuplicateHintsSchema>;
export const AssessmentImportPreviewSchema = z.object({
  id: z.uuid().nullable(), title: z.string(), expiresAt: z.iso.datetime().nullable(),
  items: z.array(AssessmentImportItemSchema), issues: z.array(AssessmentImportIssueSchema),
});
export const AssessmentImportResultSchema = z.object({ added: z.number(), updated: z.number(), unchanged: z.number(), taskIds: z.array(z.uuid()) });
export const AssessmentBankDeleteSchema = z.strictObject({ expectedVersion: z.number().int().positive().max(100000), expectedLifecycleRevision: z.number().int().positive().max(2147483646) });
export const AssessmentBankDeleteResultSchema = z.strictObject({ id: z.uuid(), version: z.number().int().positive(), deletionRevision: z.number().int().positive() });
export const AssessmentBankRestoreSchema = z.strictObject({ expectedVersion: z.number().int().positive().max(100000), expectedDeletionRevision: z.number().int().positive().max(2147483646) });
export const AssessmentBankRestoreResultSchema = z.strictObject({ id: z.uuid() });
export type AssessmentBankDeletion = z.infer<typeof AssessmentBankDeleteResultSchema>;
export type AssessmentBankRestore = z.infer<typeof AssessmentBankRestoreSchema>;
export type AssessmentBankDelete = z.infer<typeof AssessmentBankDeleteSchema>;
export type AssessmentBankQuery = z.infer<typeof AssessmentBankQuerySchema>;
export type AssessmentTaskSummary = z.infer<typeof AssessmentTaskSummarySchema>;
export type AssessmentTaskView = z.infer<typeof AssessmentTaskViewSchema>;
export type AssessmentImportPreview = z.infer<typeof AssessmentImportPreviewSchema>;
export type AssessmentImportResult = z.infer<typeof AssessmentImportResultSchema>;
