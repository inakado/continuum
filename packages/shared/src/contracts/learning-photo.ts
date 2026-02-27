import { z } from "zod";

const MAX_ANSWER_LENGTH = 2_000;
const PHOTO_FILES_MIN = 1;
const PHOTO_FILES_MAX = 5;
const PHOTO_MAX_SIZE_BYTES = 20 * 1024 * 1024;
const PHOTO_TTL_MAX_SEC = 600;

const PHOTO_ALLOWED_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const trimToUndefined = (value: unknown) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const coerceOptionalPositiveInt = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    return value;
  },
  z.coerce.number().int().positive().optional(),
);

const coerceOptionalNonNegativeInt = z.preprocess(
  (value) => {
    if (value === undefined || value === null || value === "") return undefined;
    return value;
  },
  z.coerce.number().int().nonnegative().optional(),
);

const nonEmptyString = z.string().trim().min(1);
const optionalIdString = z.preprocess(trimToUndefined, nonEmptyString.optional());

export const StudentAttemptRequestSchema = z
  .preprocess(
    (value) => (value && typeof value === "object" ? value : {}),
    z
      .object({
        answers: z.unknown().optional(),
        choiceKey: z.unknown().optional(),
        choiceKeys: z.unknown().optional(),
      })
      .passthrough(),
  );

export const NumericAttemptRequestSchema = z
  .object({
    answers: z
      .array(
        z
          .object({
            partKey: nonEmptyString,
            value: z.string().max(MAX_ANSWER_LENGTH),
          })
          .passthrough(),
      )
      .min(1),
  })
  .passthrough();

export const SingleChoiceAttemptRequestSchema = z
  .object({
    choiceKey: nonEmptyString,
  })
  .passthrough();

export const MultiChoiceAttemptRequestSchema = z
  .object({
    choiceKeys: z.array(z.string()).min(1),
  })
  .passthrough();

export const StudentPhotoPresignUploadFileSchema = z
  .object({
    filename: nonEmptyString,
    contentType: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.enum(PHOTO_ALLOWED_CONTENT_TYPES)),
    sizeBytes: z.coerce.number().int().positive().max(PHOTO_MAX_SIZE_BYTES),
  })
  .passthrough();

export const StudentPhotoPresignUploadRequestSchema = z
  .object({
    files: z.array(StudentPhotoPresignUploadFileSchema).min(PHOTO_FILES_MIN).max(PHOTO_FILES_MAX),
    ttlSec: coerceOptionalPositiveInt.refine(
      (value) => value === undefined || value <= PHOTO_TTL_MAX_SEC,
      `ttlSec must be <= ${PHOTO_TTL_MAX_SEC}`,
    ),
  })
  .passthrough();

export const StudentPhotoSubmitRequestSchema = z
  .object({
    assetKeys: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(500)
          .regex(/^[a-zA-Z0-9\-_/\.]+$/),
      )
      .min(PHOTO_FILES_MIN)
      .max(PHOTO_FILES_MAX)
      .refine((values) => new Set(values).size === values.length, {
        message: "assetKeys must be unique",
      }),
  })
  .passthrough();

export const StudentPhotoPresignViewQuerySchema = z
  .object({
    assetKey: nonEmptyString.max(500).regex(/^[a-zA-Z0-9\-_/\.]+$/),
    ttlSec: coerceOptionalPositiveInt.refine(
      (value) => value === undefined || value <= PHOTO_TTL_MAX_SEC,
      `ttlSec must be <= ${PHOTO_TTL_MAX_SEC}`,
    ),
  })
  .passthrough();

export const TeacherPhotoPresignViewQuerySchema = StudentPhotoPresignViewQuerySchema;

const TeacherPhotoQueueStatusInputSchema = z.preprocess(
  (value) => {
    const normalized = trimToUndefined(value);
    if (normalized === undefined) return undefined;
    return normalized;
  },
  z.enum(["pending_review", "submitted", "accepted", "rejected"]).optional(),
);

export const TeacherPhotoQueueQuerySchema = z
  .object({
    status: TeacherPhotoQueueStatusInputSchema.default("pending_review").transform((value) =>
      value === "pending_review" ? "submitted" : value,
    ),
    limit: coerceOptionalPositiveInt.default(20).transform((value) => Math.min(value, 100)),
    offset: coerceOptionalNonNegativeInt.default(0),
  })
  .passthrough();

const TeacherPhotoInboxStatusInputSchema = z.preprocess(
  (value) => {
    const normalized = trimToUndefined(value);
    if (normalized === undefined) return undefined;
    return normalized;
  },
  z.enum(["pending_review", "submitted", "accepted", "rejected"]).optional(),
);

const TeacherPhotoSortInputSchema = z.preprocess(trimToUndefined, z.enum(["oldest", "newest"]).optional());

const TeacherPhotoInboxBaseQuerySchema = z
  .object({
    status: TeacherPhotoInboxStatusInputSchema.default("pending_review").transform((value) =>
      value === "submitted" ? "pending_review" : value,
    ),
    studentId: optionalIdString,
    courseId: optionalIdString,
    sectionId: optionalIdString,
    unitId: optionalIdString,
    taskId: optionalIdString,
    sort: TeacherPhotoSortInputSchema.default("oldest"),
  })
  .passthrough();

export const TeacherPhotoInboxQuerySchema = TeacherPhotoInboxBaseQuerySchema.extend({
  limit: coerceOptionalPositiveInt.default(20).transform((value) => Math.min(value, 100)),
  offset: coerceOptionalNonNegativeInt.default(0),
});

export const TeacherPhotoSubmissionDetailQuerySchema = TeacherPhotoInboxBaseQuerySchema;

export const TeacherPhotoRejectRequestSchema = z
  .preprocess(
    (value) => (value && typeof value === "object" ? value : {}),
    z
      .object({
        reason: z.preprocess(
          (value) => (typeof value === "string" ? trimToUndefined(value) : undefined),
          z.string().optional(),
        ),
      })
      .passthrough(),
  );

const StudentTaskStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "correct",
  "pending_review",
  "accepted",
  "rejected",
  "blocked",
  "credited_without_progress",
  "teacher_credited",
]);

const StudentUnitStatusSchema = z.enum(["locked", "available", "in_progress", "completed"]);

const StudentTaskStateSchema = z.object({
  status: StudentTaskStatusSchema,
  wrongAttempts: z.number().int().nonnegative(),
  blockedUntil: z.string().nullable(),
  requiredSkipped: z.boolean(),
});

const UnitSnapshotSchema = z.object({
  unitId: z.string(),
  status: StudentUnitStatusSchema,
  totalTasks: z.number().int().nonnegative(),
  countedTasks: z.number().int().nonnegative(),
  solvedTasks: z.number().int().nonnegative(),
  completionPercent: z.number().int().nonnegative(),
  solvedPercent: z.number().int().nonnegative(),
});

export const StudentAttemptResponseSchema = z
  .object({
    status: StudentTaskStatusSchema,
    attemptNo: z.number().int().positive(),
    wrongAttempts: z.number().int().nonnegative(),
    blockedUntil: z.string().nullable(),
    perPart: z.array(z.object({ partKey: z.string(), correct: z.boolean() })).optional(),
  })
  .passthrough();

export const StudentPhotoPresignUploadResponseSchema = z
  .object({
    uploads: z.array(
      z
        .object({
          assetKey: z.string(),
          url: z.string(),
          headers: z.record(z.string(), z.string()).optional(),
        })
        .passthrough(),
    ),
    expiresInSec: z.number().int().positive(),
  })
  .passthrough();

export const StudentPhotoSubmitResponseSchema = z
  .object({
    ok: z.literal(true),
    submissionId: z.string(),
    taskState: StudentTaskStateSchema,
    unitSnapshot: UnitSnapshotSchema.optional(),
  })
  .passthrough();

export const StudentPhotoPresignViewResponseSchema = z
  .object({
    ok: z.literal(true),
    assetKey: z.string(),
    expiresInSec: z.number().int().positive(),
    url: z.string(),
  })
  .passthrough();

const TeacherReviewSubmissionStatusSchema = z.enum(["pending_review", "accepted", "rejected"]);

const TeacherReviewInboxItemSchema = z
  .object({
    submissionId: z.string(),
    status: TeacherReviewSubmissionStatusSchema,
    submittedAt: z.string(),
    assetKeysCount: z.number().int().nonnegative(),
    student: z.object({
      id: z.string(),
      login: z.string(),
      firstName: z.string().nullable(),
      lastName: z.string().nullable(),
    }),
    course: z.object({ id: z.string(), title: z.string() }),
    section: z.object({ id: z.string(), title: z.string() }),
    unit: z.object({ id: z.string(), title: z.string() }),
    task: z.object({
      id: z.string(),
      title: z.string().nullable(),
      sortOrder: z.number().int(),
    }),
  })
  .passthrough();

export const TeacherReviewInboxResponseSchema = z
  .object({
    items: z.array(TeacherReviewInboxItemSchema),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
    sort: z.enum(["oldest", "newest"]),
  })
  .passthrough();

export const TeacherReviewSubmissionDetailResponseSchema = z
  .object({
    submission: z
      .object({
        submissionId: z.string(),
        status: TeacherReviewSubmissionStatusSchema,
        submittedAt: z.string(),
        reviewedAt: z.string().nullable(),
        rejectedReason: z.string().nullable(),
        assetKeys: z.array(z.string()),
        student: z.object({
          id: z.string(),
          login: z.string(),
          firstName: z.string().nullable(),
          lastName: z.string().nullable(),
        }),
        course: z.object({ id: z.string(), title: z.string() }),
        section: z.object({ id: z.string(), title: z.string() }),
        unit: z.object({ id: z.string(), title: z.string() }),
        task: z.object({
          id: z.string(),
          title: z.string().nullable(),
          sortOrder: z.number().int(),
          statementLite: z.string(),
        }),
      })
      .passthrough(),
    navigation: z.object({
      prevSubmissionId: z.string().nullable(),
      nextSubmissionId: z.string().nullable(),
    }),
    appliedFilters: z
      .object({
        status: TeacherReviewSubmissionStatusSchema.optional(),
        studentId: z.string().optional(),
        courseId: z.string().optional(),
        sectionId: z.string().optional(),
        unitId: z.string().optional(),
        taskId: z.string().optional(),
        sort: z.enum(["oldest", "newest"]),
      })
      .passthrough(),
  })
  .passthrough();

export const TeacherPhotoPresignViewResponseSchema = StudentPhotoPresignViewResponseSchema;

export const TeacherPhotoReviewResponseSchema = z
  .object({
    ok: z.literal(true),
    submission: z
      .object({
        id: z.string(),
        studentUserId: z.string(),
        taskId: z.string(),
        taskRevisionId: z.string(),
        unitId: z.string(),
        attemptId: z.string(),
        status: z.enum(["submitted", "accepted", "rejected"]),
        assetKeys: z.array(z.string()),
        rejectedReason: z.string().nullable(),
        submittedAt: z.string(),
        reviewedAt: z.string().nullable(),
        reviewedByTeacherUserId: z.string().nullable(),
      })
      .passthrough(),
    taskState: StudentTaskStateSchema,
    unitSnapshot: UnitSnapshotSchema.optional(),
  })
  .passthrough();

export const TeacherStudentPhotoQueueResponseSchema = z
  .object({
    items: z.array(
      z
        .object({
          submissionId: z.string(),
          taskId: z.string(),
          taskTitle: z.string().nullable(),
          unitId: z.string(),
          unitTitle: z.string(),
          status: z.enum(["submitted", "accepted", "rejected"]),
          submittedAt: z.string(),
          rejectedReason: z.string().nullable(),
          assetKeysCount: z.number().int().nonnegative(),
        })
        .passthrough(),
    ),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  })
  .passthrough();

export type StudentAttemptRequest = z.infer<typeof StudentAttemptRequestSchema>;
export type NumericAttemptRequest = z.infer<typeof NumericAttemptRequestSchema>;
export type SingleChoiceAttemptRequest = z.infer<typeof SingleChoiceAttemptRequestSchema>;
export type MultiChoiceAttemptRequest = z.infer<typeof MultiChoiceAttemptRequestSchema>;

export type StudentPhotoPresignUploadRequest = z.infer<typeof StudentPhotoPresignUploadRequestSchema>;
export type StudentPhotoSubmitRequest = z.infer<typeof StudentPhotoSubmitRequestSchema>;
export type StudentPhotoPresignViewQuery = z.infer<typeof StudentPhotoPresignViewQuerySchema>;

export type TeacherPhotoQueueQuery = z.infer<typeof TeacherPhotoQueueQuerySchema>;
export type TeacherPhotoInboxQuery = z.infer<typeof TeacherPhotoInboxQuerySchema>;
export type TeacherPhotoSubmissionDetailQuery = z.infer<typeof TeacherPhotoSubmissionDetailQuerySchema>;
export type TeacherPhotoPresignViewQuery = z.infer<typeof TeacherPhotoPresignViewQuerySchema>;
export type TeacherPhotoRejectRequest = z.infer<typeof TeacherPhotoRejectRequestSchema>;

export type StudentAttemptResponse = z.infer<typeof StudentAttemptResponseSchema>;
export type StudentPhotoPresignUploadResponse = z.infer<typeof StudentPhotoPresignUploadResponseSchema>;
export type StudentPhotoSubmitResponse = z.infer<typeof StudentPhotoSubmitResponseSchema>;
export type StudentPhotoPresignViewResponse = z.infer<typeof StudentPhotoPresignViewResponseSchema>;

export type TeacherReviewInboxResponse = z.infer<typeof TeacherReviewInboxResponseSchema>;
export type TeacherReviewSubmissionDetailResponse = z.infer<typeof TeacherReviewSubmissionDetailResponseSchema>;
export type TeacherPhotoPresignViewResponse = z.infer<typeof TeacherPhotoPresignViewResponseSchema>;
export type TeacherPhotoReviewResponse = z.infer<typeof TeacherPhotoReviewResponseSchema>;
export type TeacherStudentPhotoQueueResponse = z.infer<typeof TeacherStudentPhotoQueueResponseSchema>;
