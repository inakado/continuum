import { z } from 'zod';
import { GradeBandSchema } from './library';

const uuid = z.uuid();
const positive = z.number().int().positive();
const count = z.number().int().nonnegative();
const optionId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const distinct = (values: string[]) => new Set(values).size === values.length;
const options = z.array(z.strictObject({ id: optionId, content: z.string() })).min(2).max(30);

export const AssignmentSelectionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('draft'), expectedRevision: positive }),
  z.strictObject({ kind: z.literal('version'), number: positive }),
]);
export const AssignmentCreateSchema = z.strictObject({
  requestId: uuid,
  selection: AssignmentSelectionSchema,
  classes: z.array(z.strictObject({ id: uuid, rosterHash: z.string().regex(/^[a-f0-9]{64}$/) })).min(1).max(100)
    .refine((items) => distinct(items.map((item) => item.id)), 'Класс выбран повторно.'),
});
const work = { id: uuid, title: z.string(), gradeBand: GradeBandSchema, taskCount: count, maxPoints: count, revision: positive };
const rosterStudent = z.object({ id: uuid, name: z.string(), login: z.string(), isActive: z.boolean(), alreadyAssigned: z.boolean() });
export const AssignmentPrepareSchema = z.object({
  work: z.object(work), selection: AssignmentSelectionSchema,
  versions: z.array(z.object({ number: positive, title: z.string(), taskCount: count, maxPoints: count, revision: positive })),
  classes: z.array(z.object({ id: uuid, title: z.string(), grade: positive, academicYear: positive, rosterHash: z.string(), assignmentId: uuid.nullable(), students: z.array(rosterStudent) })),
});
export const AssignmentCreatedSchema = z.object({ versionId: uuid, versionNumber: positive, addedCount: count });
export const AssignmentRevokeSchema = z.strictObject({ expectedRecipientsHash: z.string().regex(/^[a-f0-9]{64}$/) });
export const AssignmentRevocationResultSchema = z.strictObject({ id: uuid, workId: uuid, versionId: uuid });
export const AssignmentRevocationPreviewSchema = AssignmentRevocationResultSchema.extend({
  title: z.string(), classTitle: z.string(), academicYear: positive,
  studentCount: count, startedCount: count, completedCount: count, recipientsHash: z.string().regex(/^[a-f0-9]{64}$/),
});
export const StudentWorkAvailabilitySchema = z.strictObject({ id: uuid });
export type AssignmentRevoke = z.infer<typeof AssignmentRevokeSchema>;
export type AssignmentRevocationPreview = z.infer<typeof AssignmentRevocationPreviewSchema>;
export const AttemptStatusSchema = z.enum(['not_started', 'in_progress', 'completed']);
const teacherResult = z.object({ points: count, maxPoints: positive, percentage: count.max(100), correctCount: count, incorrectCount: count, partialCount: count.optional() });
const assignmentClass = z.object({ id: uuid, classId: uuid.nullable(), title: z.string(), academicYear: positive });
export const WorkProgressSchema = z.strictObject({ photoTaskCount: count, publishedReviewTaskCount: count, resultReady: z.boolean() });
export type WorkProgress = z.infer<typeof WorkProgressSchema>;
export const AssignmentSummarySchema = z.object({
  versionId: uuid, workId: uuid, title: z.string(), versionNumber: positive, taskCount: count, maxPoints: count,
  automaticTaskCount: count, extendedTaskCount: count,
  classes: z.array(assignmentClass), studentCount: count, completedCount: count, allPhotosCount: count, allReviewsPublishedCount: count,
});
export const AssignmentListSchema = z.array(AssignmentSummarySchema);
export const AssignmentReportSchema = AssignmentSummarySchema.extend({
  recipients: z.array(z.object({
    id: uuid, name: z.string(), login: z.string(), assignmentId: uuid, isActive: z.boolean(), deleted: z.boolean(),
    status: AttemptStatusSchema, answeredCount: count, result: teacherResult.nullable(), completedAt: z.iso.datetime().nullable(),
    photoTaskCount: count.optional(), progress: WorkProgressSchema,
  })),
});

export const AssessmentAnswerSchema = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('short_number'), value: z.string().max(64) }),
  z.strictObject({ type: z.literal('short_text'), value: z.string().max(5000) }),
  z.strictObject({ type: z.literal('single_choice'), optionId: optionId.nullable() }),
  z.strictObject({ type: z.literal('multiple_choice'), optionIds: z.array(optionId).max(30).refine(distinct, 'Вариант выбран повторно.') }),
  z.strictObject({ type: z.literal('matching'), matches: z.record(optionId, optionId).refine((value) => Object.keys(value).length <= 30, 'Слишком много позиций.') }),
]);
export const AttemptSaveSchema = z.strictObject({ requestId: uuid, expectedRevision: positive, answer: AssessmentAnswerSchema.nullable() });
export const AttemptFinishSchema = z.strictObject({ expectedRevision: positive });
const publicItem = { id: uuid, title: z.string(), statement: z.string(), images: z.record(z.string(), z.string()), maxPoints: positive };
export const PublicAssessmentItemSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...publicItem, type: z.literal('extended') }),
  z.strictObject({ ...publicItem, type: z.literal('short_number'), unit: z.string().optional() }),
  z.strictObject({ ...publicItem, type: z.literal('short_text') }),
  z.strictObject({ ...publicItem, type: z.literal('single_choice'), options }),
  z.strictObject({ ...publicItem, type: z.literal('multiple_choice'), options }),
  z.strictObject({ ...publicItem, type: z.literal('matching'), rows: options, options }),
]);
export const StudentAttemptStateSchema = z.strictObject({
  revision: positive, status: AttemptStatusSchema, answeredCount: count,
  startedAt: z.iso.datetime().nullable(), completedAt: z.iso.datetime().nullable(),
  result: z.strictObject({ correctCount: count, incorrectCount: count, partialCount: count.optional(), points: count.optional(), maxPoints: positive.optional() }).nullable(),
});
export const StudentWorkSummarySchema = StudentAttemptStateSchema.extend({
  id: uuid, title: z.string(), versionNumber: positive, taskCount: positive, assignedAt: z.iso.datetime(),
  automaticTaskCount: count.optional(), extendedTaskCount: count.optional(),
});
export const StudentWorkListSchema = z.array(StudentWorkSummarySchema.extend({ automaticTaskCount: count, extendedTaskCount: count, progress: WorkProgressSchema }));
export type StudentWorkListItem = z.infer<typeof StudentWorkListSchema>[number];
export const StudentWorkDetailSchema = StudentWorkSummarySchema.extend({
  instructions: z.string(), items: z.array(PublicAssessmentItemSchema), answers: z.record(uuid, AssessmentAnswerSchema),
});
export type AssignmentSelection = z.infer<typeof AssignmentSelectionSchema>;
export type AssignmentCreate = z.infer<typeof AssignmentCreateSchema>;
export type AssignmentPrepare = z.infer<typeof AssignmentPrepareSchema>;
export type AssignmentReport = z.infer<typeof AssignmentReportSchema>;
export type AssignmentSummary = z.infer<typeof AssignmentSummarySchema>;
export type AssessmentAnswer = z.infer<typeof AssessmentAnswerSchema>;
export type PublicAssessmentItem = z.infer<typeof PublicAssessmentItemSchema>;
export type AttemptSave = z.infer<typeof AttemptSaveSchema>;
export type StudentAttemptState = z.infer<typeof StudentAttemptStateSchema>;
export type StudentWorkDetail = z.infer<typeof StudentWorkDetailSchema>;
