import { z } from "zod";
import { GradeBandSchema } from "./library";

const id = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
const text = z.string().trim().min(1).max(5_000);
const distinct = (values: string[]) => new Set(values).size === values.length;
const decimal = z.string().max(64).regex(/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/);
const choice = z.strictObject({ id, content: text });
const choices = z.array(choice).min(2).max(30);
const exactPolicy = { policy: z.literal("exact").optional() };
export const AssessmentTaskSourceSchema = z.strictObject({
  provider: z.string().trim().min(1).max(160),
  kind: z.enum(["taskbook", "platform", "original"]).optional(),
  exam: z.enum(["ege", "none"]).optional(),
  externalId: z.string().trim().min(1).max(160).optional(),
  collection: z.string().trim().min(1).max(200).optional(),
  sectionCode: z.string().regex(/^\d{1,2}\.\d{2}$/).optional(),
  taskNumber: z.number().int().positive().optional(),
  examYear: z.number().int().min(2000).max(2100).optional(),
  examTaskNumber: z.number().int().positive().optional(),
}).superRefine((source, ctx) => {
  const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (source.exam === "ege") {
    if (source.examYear === undefined) issue("examYear", "Для ЕГЭ укажите год.");
    if (source.examTaskNumber === undefined) issue("examTaskNumber", "Для ЕГЭ укажите номер задания.");
  }
  if (source.exam === "none" && (source.examYear !== undefined || source.examTaskNumber !== undefined)) issue("exam", "У задачи не ЕГЭ не должно быть года или номера ЕГЭ.");
  if (source.kind === "taskbook" && !source.collection) issue("collection", "Укажите название задачника.");
});
export const ASSESSMENT_PACKAGE_TASK_LIMIT = 500;
const common = {
  id,
  title: z.string().trim().min(1).max(200),
  gradeBand: GradeBandSchema,
  topicPath: z.array(z.string().trim().min(1).max(160)).min(1).max(5),
  maxPoints: z.number().int().min(1).max(100),
  source: AssessmentTaskSourceSchema,
};

export const AssessmentPackageManifestSchema = z.strictObject({
  format: z.literal("continuum-assessment-package"),
  version: z.literal(1),
  title: z.string().trim().min(1).max(200),
  tasks: z.array(id).min(1).max(ASSESSMENT_PACKAGE_TASK_LIMIT).refine(distinct, "Идентификаторы задач повторяются."),
});

// These are teacher import records, NEVER student DTOs: grading and source are private.
export const AssessmentPackageTaskSchema = z.discriminatedUnion("type", [
  z.strictObject({ ...common, type: z.literal("extended") }),
  z.strictObject({
    ...common, type: z.literal("short_number"), unit: z.string().trim().min(1).max(80).optional(),
    grading: z.strictObject({ ...exactPolicy, answer: decimal, absoluteTolerance: z.number().finite().nonnegative() }),
  }),
  z.strictObject({
    ...common, type: z.literal("short_text"),
    grading: z.strictObject({ ...exactPolicy, acceptedAnswers: z.array(text).min(1).max(30), caseSensitive: z.boolean() }),
  }),
  z.strictObject({
    ...common, type: z.literal("single_choice"), options: choices,
    grading: z.strictObject({ ...exactPolicy, correctOptionId: id }),
  }),
  z.strictObject({
    ...common, type: z.literal("multiple_choice"), options: choices,
    grading: z.strictObject({ policy: z.enum(["exact", "ege_physics_multiple_choice_v1"]).optional(), correctOptionIds: z.array(id).min(1).max(30) }),
  }),
  z.strictObject({
    ...common, type: z.literal("matching"), rows: choices, options: choices,
    grading: z.strictObject({ policy: z.enum(["exact", "ege_physics_matching_v1"]).optional(), matches: z.record(id, id) }),
  }),
]).superRefine((task, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (!("options" in task)) return;
  const optionIds = task.options.map((option) => option.id);
  if (task.grading.policy && task.grading.policy !== "exact" && task.maxPoints !== 2) issue("Правило ЕГЭ требует maxPoints = 2.");
  if (!distinct(optionIds)) issue("Идентификаторы вариантов повторяются.");
  if (task.type === "single_choice" && !optionIds.includes(task.grading.correctOptionId)) issue("Правильного варианта нет в задании.");
  if (task.type === "multiple_choice") {
    if (task.grading.policy === "ege_physics_multiple_choice_v1" && ![2, 3].includes(task.grading.correctOptionIds.length)) issue("Правило ЕГЭ требует 2 или 3 верных варианта.");
    if (!distinct(task.grading.correctOptionIds)) issue("Ключ содержит повторяющиеся варианты.");
    if (task.grading.correctOptionIds.some((key) => !optionIds.includes(key))) issue("Ключ ссылается на отсутствующий вариант.");
  }
  if (task.type === "matching") {
    if (task.grading.policy === "ege_physics_matching_v1" && task.rows.length !== 2) issue("Правило ЕГЭ требует две позиции соответствия.");
    const rows = task.rows.map((row) => row.id);
    if (!distinct(rows)) issue("Идентификаторы позиций повторяются.");
    const keys = Object.keys(task.grading.matches);
    if (keys.length !== rows.length || rows.some((row) => !keys.includes(row))) issue("Ключ должен содержать каждую позицию ровно один раз.");
    if (Object.values(task.grading.matches).some((key) => !optionIds.includes(key))) issue("Соответствие ссылается на отсутствующий вариант.");
  }
}).superRefine((task, ctx) => {
  if (task.source.exam === "none" && 'grading' in task && task.grading.policy?.startsWith('ege_')) ctx.addIssue({ code: "custom", path: ['grading', 'policy'], message: "Правило ЕГЭ несовместимо с меткой «не ЕГЭ»." });
});

export type AssessmentPackageManifest = z.infer<typeof AssessmentPackageManifestSchema>;
export type AssessmentPackageTask = z.infer<typeof AssessmentPackageTaskSchema>;
