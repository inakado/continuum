import { z } from "zod";

export const GradeBandSchema = z.enum([
  "grade_7",
  "grade_8",
  "grade_9",
  "grade_10_11",
]);

export const PublicationStatusSchema = z.enum(["draft", "published"]);
export const LessonArtifactTypeSchema = z.enum(["pdf", "interactive"]);

export const LessonArtifactSchema = z.object({
  id: z.uuid(),
  type: LessonArtifactTypeSchema,
  version: z.number().int().positive(),
  filename: z.string().trim().min(1),
  contentType: z.string().trim().min(1),
  sizeBytes: z.number().int().nonnegative(),
  publishedAt: z.iso.datetime().nullable(),
});

export const LessonTaskSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).nullable(),
  body: z.string().trim().min(1),
  imageUrl: z.url().nullable(),
  diagramPreviewUrl: z.url().nullable(),
  sortOrder: z.number().int().nonnegative(),
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

export const LessonDetailSchema = LessonSummarySchema.extend({
  section: z.object({
    id: z.uuid(),
    gradeBand: GradeBandSchema,
    title: z.string().trim().min(1),
  }),
  artifacts: z.array(LessonArtifactSchema),
  tasks: z.array(LessonTaskSchema),
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
export type LessonTask = z.infer<typeof LessonTaskSchema>;
export type LessonSummary = z.infer<typeof LessonSummarySchema>;
export type LibrarySection = z.infer<typeof LibrarySectionSchema>;
export type StudentLibrary = z.infer<typeof StudentLibrarySchema>;
export type LessonDetail = z.infer<typeof LessonDetailSchema>;
export type AccessGrant = z.infer<typeof AccessGrantSchema>;
export type CreateSectionInput = z.infer<typeof CreateSectionInputSchema>;
export type CreateLessonInput = z.infer<typeof CreateLessonInputSchema>;
export type ResourceIdParams = z.infer<typeof ResourceIdParamsSchema>;
export type SetAccessGrantInput = z.infer<typeof SetAccessGrantInputSchema>;
export type SetAccessGrantResult = z.infer<typeof SetAccessGrantResultSchema>;
export type PublicationResult = z.infer<typeof PublicationResultSchema>;
export type TeacherLibrary = z.infer<typeof TeacherLibrarySchema>;
