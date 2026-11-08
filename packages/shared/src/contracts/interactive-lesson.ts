import { z } from 'zod';

// v1 is an offline document. Scripts run only inside the host's opaque-origin sandbox.
export const interactiveLessonPolicy = {
  zipBytes: 16 * 1024 * 1024,
  htmlBytes: 32 * 1024 * 1024,
  manifestBytes: 32 * 1024,
  files: 2,
} as const;

export const InteractiveLessonIdSchema = z.string().regex(/^[a-z][a-z0-9-]{0,99}$/);
export const InteractiveLessonManifestSchema = z.strictObject({
  schemaVersion: z.literal(1),
  lessonId: InteractiveLessonIdSchema,
  title: z.string().trim().min(1).max(200),
  entrypoint: z.literal('lesson.html'),
  contentSha256: z.string().regex(/^[a-f0-9]{64}$/),
  sections: z.array(z.strictObject({
    id: InteractiveLessonIdSchema,
    title: z.string().trim().min(1).max(120),
  })).min(1).max(100).refine((items) => new Set(items.map((item) => item.id)).size === items.length, 'Идентификаторы разделов должны быть уникальны.'),
  questions: z.array(z.strictObject({
    id: InteractiveLessonIdSchema,
    revision: z.number().int().positive(),
  })).max(100).default([]).refine((items) => new Set(items.map((item) => item.id)).size === items.length, 'Идентификаторы вопросов должны быть уникальны.'),
});

export const InteractiveLessonDocumentSchema = z.strictObject({
  artifactId: z.uuid(),
  manifest: InteractiveLessonManifestSchema,
  html: z.string().min(1).max(interactiveLessonPolicy.htmlBytes),
});
export type InteractiveLessonManifest = z.infer<typeof InteractiveLessonManifestSchema>;
export type InteractiveLessonDocument = z.infer<typeof InteractiveLessonDocumentSchema>;
