import { z } from "zod";
import { GradeBandSchema } from "./library";

const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const text = z.string().trim().min(1).max(5_000);
const distinct = (values: string[]) => new Set(values).size === values.length;
const decimal = z.string().max(64).regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);
const choice = z.strictObject({ id, content: text });
const choices = z.array(choice).min(2).max(30);
export const ASSESSMENT_PACKAGE_TASK_LIMIT = 500;
const common = {
  id,
  title: z.string().trim().min(1).max(200),
  gradeBand: GradeBandSchema,
  topicPath: z.array(z.string().trim().min(1).max(160)).min(1).max(5),
  maxPoints: z.number().int().min(1).max(100),
  source: z.strictObject({
    provider: z.string().trim().min(1).max(160),
    externalId: z.string().trim().min(1).max(160).optional(),
    collection: z.string().trim().min(1).max(200).optional(),
    sectionCode: z.string().regex(/^\d{1,2}\.\d{2}$/).optional(),
    taskNumber: z.number().int().positive().optional(),
    examYear: z.number().int().min(2000).max(2100).optional(),
    examTaskNumber: z.number().int().positive().optional(),
  }),
};

export const AssessmentPackageManifestSchema = z.strictObject({
  format: z.literal("continuum-assessment-package"),
  version: z.literal(1),
  title: z.string().trim().min(1).max(200),
  tasks: z.array(id).min(1).max(ASSESSMENT_PACKAGE_TASK_LIMIT).refine(distinct, "Идентификаторы задач повторяются."),
});

// Candidate v1 covers automatic answers only. Extended-response criteria need a real authorial example.
// These are teacher import records, NEVER student DTOs: grading and source are private.
export const AssessmentPackageTaskSchema = z.discriminatedUnion("type", [
  z.strictObject({
    ...common, type: z.literal("short_number"), unit: z.string().trim().min(1).max(80).optional(),
    grading: z.strictObject({ answer: decimal, absoluteTolerance: z.number().finite().nonnegative() }),
  }),
  z.strictObject({
    ...common, type: z.literal("short_text"),
    grading: z.strictObject({ acceptedAnswers: z.array(text).min(1).max(30), caseSensitive: z.boolean() }),
  }),
  z.strictObject({
    ...common, type: z.literal("single_choice"), options: choices,
    grading: z.strictObject({ correctOptionId: id }),
  }),
  z.strictObject({
    ...common, type: z.literal("multiple_choice"), options: choices,
    grading: z.strictObject({ correctOptionIds: z.array(id).min(1).max(30) }),
  }),
  z.strictObject({
    ...common, type: z.literal("matching"), rows: choices, options: choices,
    grading: z.strictObject({ matches: z.record(id, id) }),
  }),
]).superRefine((task, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (!("options" in task)) return;
  const optionIds = task.options.map((option) => option.id);
  if (!distinct(optionIds)) issue("Идентификаторы вариантов повторяются.");
  if (task.type === "single_choice" && !optionIds.includes(task.grading.correctOptionId)) issue("Правильного варианта нет в задании.");
  if (task.type === "multiple_choice") {
    if (!distinct(task.grading.correctOptionIds)) issue("Ключ содержит повторяющиеся варианты.");
    if (task.grading.correctOptionIds.some((key) => !optionIds.includes(key))) issue("Ключ ссылается на отсутствующий вариант.");
  }
  if (task.type === "matching") {
    const rows = task.rows.map((row) => row.id);
    if (!distinct(rows)) issue("Идентификаторы позиций повторяются.");
    const keys = Object.keys(task.grading.matches);
    if (keys.length !== rows.length || rows.some((row) => !keys.includes(row))) issue("Ключ должен содержать каждую позицию ровно один раз.");
    if (Object.values(task.grading.matches).some((key) => !optionIds.includes(key))) issue("Соответствие ссылается на отсутствующий вариант.");
  }
});

export type AssessmentPackageManifest = z.infer<typeof AssessmentPackageManifestSchema>;
export type AssessmentPackageTask = z.infer<typeof AssessmentPackageTaskSchema>;
