import { z } from "zod";

export const GradeBandSchema = z.enum([
  "grade_7",
  "grade_8",
  "grade_9",
  "grade_10_11",
]);

export const PublicationStatusSchema = z.enum(["draft", "published"]);
export const LessonArtifactTypeSchema = z.enum(["pdf", "interactive", "tasks_pdf"]);

export const LessonArtifactSchema = z.object({
  id: z.uuid(),
  type: LessonArtifactTypeSchema,
  version: z.number().int().positive(),
  filename: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
  sizeBytes: z.number().int().nonnegative(),
  status: PublicationStatusSchema,
  isActive: z.boolean(),
  publishedAt: z.iso.datetime().nullable(),
});

export const LessonSummarySchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1),
  description: z.string().nullable(),
  status: PublicationStatusSchema,
  sortOrder: z.number().int().nonnegative(),
  formats: z.object({
    pdf: z.boolean(),
    interactive: z.boolean(),
    tasks: z.boolean(),
  }),
});

export const LibrarySectionSchema = z.object({
  id: z.uuid(),
  gradeBand: GradeBandSchema,
  title: z.string().trim().min(1),
  description: z.string().nullable(),
  status: PublicationStatusSchema,
  sortOrder: z.number().int().nonnegative(),
  lessons: z.array(LessonSummarySchema),
});

export const StudentLibrarySchema = z.object({
  gradeBands: z.array(
    z.object({
      code: GradeBandSchema,
      sections: z.array(LibrarySectionSchema),
    }),
  ),
});

const LessonSectionSchema = z.object({
  id: z.uuid(),
  gradeBand: GradeBandSchema,
  title: z.string().trim().min(1),
});

export const LessonDetailSchema = LessonSummarySchema.extend({
  section: LessonSectionSchema,
  artifacts: z.array(LessonArtifactSchema),
});

export const TeacherLessonDetailSchema = LessonSummarySchema.extend({
  section: z.object({
    id: z.uuid(),
    gradeBand: GradeBandSchema,
    title: z.string().trim().min(1),
  }),
  artifacts: z.array(LessonArtifactSchema),
});

export const AccessGrantSchema = z.object({
  studentId: z.uuid(),
  gradeBand: GradeBandSchema,
  grantedAt: z.iso.datetime(),
});

export const CreateSectionInputSchema = z.object({
  gradeBand: GradeBandSchema,
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2_000).nullable().optional(),
});

export const CreateLessonInputSchema = z.object({
  sectionId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4_000).nullable().optional(),
});

export const UpdateSectionInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
});

export const UpdateLessonInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
});

export const LessonArtifactFileInputSchema = z.object({
  type: LessonArtifactTypeSchema,
  filename: z.string().trim().min(1).max(240),
  contentType: z.string().trim().min(1).max(120),
  sizeBytes: z.number().int().positive(),
});

export const UploadLessonArtifactQuerySchema = LessonArtifactFileInputSchema.omit({
  contentType: true,
}).extend({
  sizeBytes: z.coerce.number().int().positive(),
});

export const LessonArtifactViewResultSchema = z.object({
  url: z.url(),
});

export const ResourceIdParamsSchema = z.object({
  id: z.uuid(),
});

export const SetAccessGrantInputSchema = z.object({
  studentId: z.uuid(),
  gradeBand: GradeBandSchema,
  enabled: z.boolean(),
});

export const SetAccessGrantResultSchema = z.object({
  grant: AccessGrantSchema.nullable(),
});

export const PublicationResultSchema = z.object({
  id: z.uuid(),
  status: PublicationStatusSchema,
});

export const TeacherLibrarySchema = StudentLibrarySchema;

export type GradeBand = z.infer<typeof GradeBandSchema>;
export type PublicationStatus = z.infer<typeof PublicationStatusSchema>;
export type LessonArtifactType = z.infer<typeof LessonArtifactTypeSchema>;
export type LessonArtifact = z.infer<typeof LessonArtifactSchema>;
export type LessonSummary = z.infer<typeof LessonSummarySchema>;
export type LibrarySection = z.infer<typeof LibrarySectionSchema>;
export type StudentLibrary = z.infer<typeof StudentLibrarySchema>;
export type LessonDetail = z.infer<typeof LessonDetailSchema>;
export type TeacherLessonDetail = z.infer<typeof TeacherLessonDetailSchema>;
export type AccessGrant = z.infer<typeof AccessGrantSchema>;
export type CreateSectionInput = z.infer<typeof CreateSectionInputSchema>;
export type CreateLessonInput = z.infer<typeof CreateLessonInputSchema>;
export type UpdateSectionInput = z.infer<typeof UpdateSectionInputSchema>;
export type UpdateLessonInput = z.infer<typeof UpdateLessonInputSchema>;
export type LessonArtifactFileInput = z.infer<typeof LessonArtifactFileInputSchema>;
export type UploadLessonArtifactQuery = z.infer<typeof UploadLessonArtifactQuerySchema>;
export type LessonArtifactViewResult = z.infer<typeof LessonArtifactViewResultSchema>;
export type ResourceIdParams = z.infer<typeof ResourceIdParamsSchema>;
export type SetAccessGrantInput = z.infer<typeof SetAccessGrantInputSchema>;
export type SetAccessGrantResult = z.infer<typeof SetAccessGrantResultSchema>;
export type PublicationResult = z.infer<typeof PublicationResultSchema>;
export type TeacherLibrary = z.infer<typeof TeacherLibrarySchema>;
