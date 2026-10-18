import { z } from 'zod';

export const solutionPhotoPolicy = {
  maxPhotos: 10,
  maxBytes: 10 * 1024 * 1024,
  maxPixels: 40_000_000,
  pendingTtlMs: 60 * 60 * 1000,
  contentTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const;
export const SolutionPhotoMutationSchema = z.strictObject({
  revision: z.coerce.number().int().min(0),
  replaceId: z.uuid().optional(),
});
export const SolutionPhotoSchema = z.strictObject({
  id: z.uuid(), url: z.string(), contentType: z.enum(solutionPhotoPolicy.contentTypes),
  sizeBytes: z.number().int().positive(), createdAt: z.iso.datetime(),
});
export const SolutionAnswerSchema = z.strictObject({
  publishedReview: z.strictObject({ points: z.number().int().nonnegative(), revision: z.number().int().positive(), reportUrl: z.string() }).nullable().optional(),
  taskId: z.uuid(), title: z.string(), maxPoints: z.number().int().positive(), revision: z.number().int().nonnegative(), locked: z.boolean(),
  photos: z.array(SolutionPhotoSchema).max(solutionPhotoPolicy.maxPhotos),
});
export const SolutionAnswersSchema = z.array(SolutionAnswerSchema);
export type SolutionAnswer = z.infer<typeof SolutionAnswerSchema>;
export type SolutionPhotoMutation = z.infer<typeof SolutionPhotoMutationSchema>;
