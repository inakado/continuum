import { z } from "zod";

export const TaskStatementImageMaxSizeBytes = 20 * 1024 * 1024;
export const TaskStatementImageAllowedContentTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export const TaskStatementImageUploadTtlDefaultSec = 300;
export const TaskStatementImageViewTtlStudentDefaultSec = 180;
export const TaskStatementImageViewTtlTeacherDefaultSec = 600;
export const TaskStatementImageTtlMaxSec = 600;

export const TaskStatementImageUploadFileSchema = z
  .object({
    filename: z.string().trim().min(1, "filename is required"),
    contentType: z.enum(TaskStatementImageAllowedContentTypes, {
      error: "contentType must be one of: image/jpeg, image/png, image/webp",
    }),
    sizeBytes: z
      .number({ error: "sizeBytes must be a positive integer" })
      .int("sizeBytes must be a positive integer")
      .positive("sizeBytes must be a positive integer")
      .max(TaskStatementImageMaxSizeBytes, `max file size is ${TaskStatementImageMaxSizeBytes} bytes`),
  })
  .passthrough();

export const TeacherTaskStatementImagePresignUploadRequestSchema = z.preprocess(
  (raw) => {
    if (raw && typeof raw === "object") {
      const record = raw as Record<string, unknown>;
      if (record.file && typeof record.file === "object") {
        return { file: record.file, ttlSec: record.ttlSec };
      }
    }

    return { file: raw };
  },
  z
    .object({
      file: TaskStatementImageUploadFileSchema,
      ttlSec: z
        .number({ error: "ttlSec must be a positive integer" })
        .int("ttlSec must be a positive integer")
        .positive("ttlSec must be a positive integer")
        .max(TaskStatementImageTtlMaxSec, `ttlSec must be <= ${TaskStatementImageTtlMaxSec}`)
        .optional(),
    })
    .passthrough(),
);

export const TaskStatementImageApplyRequestSchema = z
  .object({
    assetKey: z
      .string()
      .trim()
      .min(1, "assetKey is required")
      .max(500, "assetKey format is invalid")
      .regex(/^[a-zA-Z0-9\-_/\\.]+$/, "assetKey format is invalid"),
  })
  .passthrough();

export const TaskStatementImagePresignViewQuerySchema = z
  .object({
    ttlSec: z
      .coerce
      .number({ error: "ttlSec must be a positive integer" })
      .int("ttlSec must be a positive integer")
      .positive("ttlSec must be a positive integer")
      .max(TaskStatementImageTtlMaxSec, `ttlSec must be <= ${TaskStatementImageTtlMaxSec}`)
      .optional(),
  })
  .passthrough();

export const TaskStatementImagePresignUploadResponseSchema = z
  .object({
    uploadUrl: z.string().min(1),
    assetKey: z.string().min(1),
    headers: z.record(z.string(), z.string()).optional(),
    expiresInSec: z.number().int().positive(),
  })
  .passthrough();

export const TaskStatementImageApplyResponseSchema = z
  .object({
    ok: z.literal(true),
    taskId: z.string().min(1),
    taskRevisionId: z.string().min(1),
    assetKey: z.string().min(1).nullable(),
  })
  .passthrough();

export const TaskStatementImagePresignViewResponseSchema = z
  .object({
    ok: z.literal(true),
    taskId: z.string().min(1),
    taskRevisionId: z.string().min(1),
    key: z.string().min(1),
    expiresInSec: z.number().int().positive(),
    url: z.string().min(1),
  })
  .passthrough();

export type TaskStatementImageUploadFile = z.infer<typeof TaskStatementImageUploadFileSchema>;
export type TeacherTaskStatementImagePresignUploadRequest = z.infer<
  typeof TeacherTaskStatementImagePresignUploadRequestSchema
>;
export type TaskStatementImageApplyRequest = z.infer<typeof TaskStatementImageApplyRequestSchema>;
export type TaskStatementImagePresignViewQuery = z.infer<typeof TaskStatementImagePresignViewQuerySchema>;
export type TaskStatementImagePresignUploadResponse = z.infer<
  typeof TaskStatementImagePresignUploadResponseSchema
>;
export type TaskStatementImageApplyResponse = z.infer<typeof TaskStatementImageApplyResponseSchema>;
export type TaskStatementImagePresignViewResponse = z.infer<
  typeof TaskStatementImagePresignViewResponseSchema
>;
