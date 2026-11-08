import { z } from 'zod';
import { InteractiveLessonIdSchema } from './interactive-lesson';

export const LessonReadingScaleSchema = z.union([z.literal(80), z.literal(90), z.literal(100), z.literal(110), z.literal(120)]);
export const LessonAnswerResultSchema = z.enum(['correct', 'incorrect']);
export const LessonReaderStateSchema = z.strictObject({
  readingScale: LessonReadingScaleSchema,
  answers: z.record(InteractiveLessonIdSchema, LessonAnswerResultSchema).refine((answers) => Object.keys(answers).length <= 100),
});
const envelope = { channel: z.literal('continuum.lesson'), version: z.literal(1) };
export const LessonToHostMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...envelope, type: z.literal('ready') }),
  z.strictObject({ ...envelope, type: z.literal('section'), sectionId: InteractiveLessonIdSchema }),
  z.strictObject({ ...envelope, type: z.literal('state'), state: LessonReaderStateSchema }),
]);
export const HostToLessonMessageSchema = z.discriminatedUnion('type', [
  z.strictObject({ ...envelope, type: z.literal('init'), state: LessonReaderStateSchema, visible: z.boolean() }),
  z.strictObject({ ...envelope, type: z.literal('navigate'), sectionId: InteractiveLessonIdSchema }),
  z.strictObject({ ...envelope, type: z.literal('scale'), value: LessonReadingScaleSchema }),
  z.strictObject({ ...envelope, type: z.literal('visibility'), visible: z.boolean() }),
]);
export type LessonReaderState = z.infer<typeof LessonReaderStateSchema>;
export type LessonToHostMessage = z.infer<typeof LessonToHostMessageSchema>;
export type HostToLessonMessage = z.infer<typeof HostToLessonMessageSchema>;
