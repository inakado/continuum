import { z } from "zod";

export const ContentStatusSchema = z.enum(["draft", "published"]);
export const StudentUnitStatusSchema = z.enum(["locked", "available", "in_progress", "completed"]);
export const StudentSectionAccessStatusSchema = z.enum(["locked", "available", "completed"]);
export const TaskAnswerTypeSchema = z.enum(["numeric", "single_choice", "multi_choice", "photo"]);
export const UnitHtmlAssetRefSchema = z
  .object({
    placeholder: z.string().min(1),
    assetKey: z.string().min(1),
    contentType: z.literal("image/svg+xml"),
  })
  .passthrough();

export const StudentCourseSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    description: z.string().nullable(),
    coverImageAssetKey: z.string().nullable().optional(),
    status: ContentStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

export const StudentSectionSchema = z
  .object({
    id: z.string().min(1),
    courseId: z.string().min(1),
    title: z.string(),
    description: z.string().nullable().optional(),
    coverImageAssetKey: z.string().nullable().optional(),
    completionPercent: z.number().int().nonnegative().max(100).optional(),
    accessStatus: StudentSectionAccessStatusSchema,
    status: ContentStatusSchema,
    sortOrder: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

export const StudentUnitSchema = z
  .object({
    id: z.string().min(1),
    sectionId: z.string().min(1),
    title: z.string(),
    description: z.string().nullable().optional(),
    status: ContentStatusSchema,
    sortOrder: z.number(),
    minOptionalCountedTasksToComplete: z.number(),
    theoryHtmlAssetKey: z.string().nullable().optional(),
    theoryHtmlAssetsJson: z.array(UnitHtmlAssetRefSchema).nullable().optional(),
    methodHtmlAssetKey: z.string().nullable().optional(),
    methodHtmlAssetsJson: z.array(UnitHtmlAssetRefSchema).nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

export const StudentGraphNodeSchema = z
  .object({
    unitId: z.string().min(1),
    title: z.string(),
    status: StudentUnitStatusSchema,
    position: z.object({ x: z.number(), y: z.number() }),
    completionPercent: z.number(),
    solvedPercent: z.number(),
  })
  .passthrough();

export const StudentGraphEdgeSchema = z
  .object({
    id: z.string().min(1),
    fromUnitId: z.string().min(1),
    toUnitId: z.string().min(1),
  })
  .passthrough();

export const StudentCourseListResponseSchema = z.array(StudentCourseSchema);

export const StudentCourseDetailResponseSchema = StudentCourseSchema.extend({
  sections: z.array(StudentSectionSchema),
}).passthrough();

export const StudentSectionDetailResponseSchema = StudentSectionSchema.extend({
  units: z.array(StudentUnitSchema),
}).passthrough();

export const StudentSectionGraphResponseSchema = z
  .object({
    sectionId: z.string().min(1),
    nodes: z.array(StudentGraphNodeSchema),
    edges: z.array(StudentGraphEdgeSchema),
  })
  .passthrough();

export const TeacherCourseSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    description: z.string().nullable(),
    coverImageAssetKey: z.string().nullable().optional(),
    status: ContentStatusSchema,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

export const TeacherSectionSchema = z
  .object({
    id: z.string().min(1),
    courseId: z.string().min(1),
    title: z.string(),
    description: z.string().nullable(),
    coverImageAssetKey: z.string().nullable().optional(),
    status: ContentStatusSchema,
    sortOrder: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

export const TeacherSectionMetaSchema = z
  .object({
    id: z.string().min(1),
    courseId: z.string().min(1),
    title: z.string(),
    status: ContentStatusSchema,
  })
  .passthrough();

export const TeacherUnitSchema = z
  .object({
    id: z.string().min(1),
    sectionId: z.string().min(1),
    title: z.string(),
    description: z.string().nullable().optional(),
    status: ContentStatusSchema,
    sortOrder: z.number(),
    minOptionalCountedTasksToComplete: z.number(),
    theoryHtmlAssetKey: z.string().nullable().optional(),
    theoryHtmlAssetsJson: z.array(UnitHtmlAssetRefSchema).nullable().optional(),
    methodHtmlAssetKey: z.string().nullable().optional(),
    methodHtmlAssetsJson: z.array(UnitHtmlAssetRefSchema).nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

export const StudentUnitRenderedContentResponseSchema = z
  .object({
    ok: z.literal(true),
    target: z.enum(["theory", "method"]),
    html: z.string().nullable(),
    htmlKey: z.string().nullable(),
    pdfUrl: z.string().nullable(),
    pdfKey: z.string().nullable(),
    expiresInSec: z.number(),
  })
  .passthrough();

export const StudentTaskSolutionRenderedContentResponseSchema = z
  .object({
    ok: z.literal(true),
    taskId: z.string().min(1),
    taskRevisionId: z.string().min(1),
    html: z.string(),
    htmlKey: z.string().min(1),
    expiresInSec: z.number(),
  })
  .passthrough();

export const TeacherGraphNodeSchema = z
  .object({
    unitId: z.string().min(1),
    title: z.string(),
    status: ContentStatusSchema,
    createdAt: z.string(),
    position: z.object({ x: z.number(), y: z.number() }),
  })
  .passthrough();

export const TeacherGraphEdgeSchema = z
  .object({
    id: z.string().min(1),
    fromUnitId: z.string().min(1),
    toUnitId: z.string().min(1),
  })
  .passthrough();

export const TeacherSectionGraphUpdateRequestSchema = z
  .object({
    nodes: z.array(
      z.object({
        unitId: z.string().min(1),
        position: z.object({ x: z.number(), y: z.number() }),
      }),
    ),
    edges: z.array(
      z.object({
        fromUnitId: z.string().min(1),
        toUnitId: z.string().min(1),
      }),
    ),
  })
  .passthrough();

export const TeacherCourseListResponseSchema = z.array(TeacherCourseSchema);

export const TeacherCourseDetailResponseSchema = TeacherCourseSchema.extend({
  sections: z.array(TeacherSectionSchema),
}).passthrough();

export const TeacherSectionDetailResponseSchema = TeacherSectionSchema.extend({
  units: z.array(TeacherUnitSchema),
}).passthrough();

export const TeacherSectionGraphResponseSchema = z
  .object({
    sectionId: z.string().min(1),
    nodes: z.array(TeacherGraphNodeSchema),
    edges: z.array(TeacherGraphEdgeSchema),
  })
  .passthrough();

export const TeacherCreateCourseRequestSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().nullable().optional(),
  })
  .passthrough();

export const TeacherUpdateCourseRequestSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
  })
  .passthrough();

export const TeacherCreateSectionRequestSchema = z
  .object({
    courseId: z.string().min(1),
    title: z.string().min(1),
    description: z.string().nullable().optional(),
    sortOrder: z.number().optional(),
  })
  .passthrough();

export const TeacherUpdateSectionRequestSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    sortOrder: z.number().optional(),
  })
  .passthrough();

export const TeacherCreateUnitRequestSchema = z
  .object({
    sectionId: z.string().min(1),
    title: z.string().min(1),
    sortOrder: z.number().optional(),
  })
  .passthrough();

export const StudentDashboardCourseSummarySchema = StudentCourseSchema.extend({
  sectionCount: z.number().int().nonnegative(),
  unitCount: z.number().int().nonnegative(),
  progressPercent: z.number().int().nonnegative().max(100),
  coverImageKey: z.string().nullable(),
  coverImageUrl: z.string().nullable(),
}).passthrough();

export const StudentDashboardContinueLearningSchema = z
  .object({
    courseId: z.string().min(1),
    courseTitle: z.string(),
    sectionId: z.string().min(1),
    sectionTitle: z.string(),
    unitId: z.string().min(1),
    unitTitle: z.string(),
    completionPercent: z.number().int().nonnegative().max(100),
    solvedPercent: z.number().int().nonnegative().max(100),
    href: z.string().min(1),
  })
  .passthrough();

export const StudentDashboardStatsSchema = z
  .object({
    totalUnits: z.number().int().nonnegative(),
    availableUnits: z.number().int().nonnegative(),
    inProgressUnits: z.number().int().nonnegative(),
    completedUnits: z.number().int().nonnegative(),
  })
  .passthrough();

export const StudentDashboardOverviewResponseSchema = z
  .object({
    courses: z.array(StudentDashboardCourseSummarySchema),
    continueLearning: StudentDashboardContinueLearningSchema.nullable(),
    stats: StudentDashboardStatsSchema,
  })
  .passthrough();

export const TeacherStudentSummarySchema = z
  .object({
    id: z.string().min(1),
    login: z.string().min(1),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    leadTeacherId: z.string().min(1),
    leadTeacherLogin: z.string().min(1),
    leadTeacherDisplayName: z.string().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    activeNotificationsCount: z.number(),
    pendingPhotoReviewCount: z.number(),
  })
  .passthrough();

export const TeacherSummarySchema = z
  .object({
    id: z.string().min(1),
    login: z.string().min(1),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    middleName: z.string().nullable().optional(),
  })
  .passthrough();

export const TeacherStudentsListQuerySchema = z
  .object({
    query: z.string().optional(),
  })
  .passthrough();

export const TeacherStudentsListResponseSchema = z.array(TeacherStudentSummarySchema);
export const TeacherTeachersListResponseSchema = z.array(TeacherSummarySchema);

export const TeacherCreateStudentRequestSchema = z
  .object({
    login: z.string().min(1),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
  })
  .passthrough();

export const TeacherCreateStudentResponseSchema = z
  .object({
    id: z.string().min(1),
    login: z.string().min(1),
    leadTeacherId: z.string().min(1),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
    password: z.string().min(1),
  })
  .passthrough();

export const TeacherResetStudentPasswordResponseSchema = z
  .object({
    id: z.string().min(1),
    login: z.string().min(1),
    password: z.string().min(1),
  })
  .passthrough();

export const TeacherTransferStudentRequestSchema = z
  .object({
    leaderTeacherId: z.string().min(1),
  })
  .passthrough();

export const TeacherTransferStudentResponseSchema = z
  .object({
    id: z.string().min(1),
    login: z.string().min(1),
    leadTeacherId: z.string().min(1),
    leadTeacherLogin: z.string().min(1),
  })
  .passthrough();

export const TeacherUpdateStudentProfileRequestSchema = z
  .object({
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
  })
  .passthrough();

export const TeacherUpdateStudentProfileResponseSchema = z
  .object({
    id: z.string().min(1),
    login: z.string().min(1),
    firstName: z.string().nullable().optional(),
    lastName: z.string().nullable().optional(),
  })
  .passthrough();

export const TeacherDeleteStudentResponseSchema = z
  .object({
    id: z.string().min(1),
    login: z.string().min(1),
  })
  .passthrough();

export const TeacherStudentProfileQuerySchema = z
  .object({
    courseId: z.string().min(1).optional(),
  })
  .passthrough();

export const TeacherNotificationSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum([
      "photo_reviewed",
      "unit_override_opened",
      "required_task_skipped",
      "task_locked",
    ]),
    payload: z.record(z.string(), z.unknown()),
    createdAt: z.string(),
    readAt: z.string().nullable(),
  })
  .passthrough();

export const TeacherStudentTaskStateSchema = z
  .object({
    status: z.enum([
      "not_started",
      "in_progress",
      "correct",
      "pending_review",
      "accepted",
      "rejected",
      "blocked",
      "credited_without_progress",
      "teacher_credited",
    ]),
    attemptsUsed: z.number(),
    wrongAttempts: z.number(),
    blockedUntil: z.string().nullable(),
    requiredSkippedFlag: z.boolean(),
    isCredited: z.boolean(),
    isTeacherCredited: z.boolean(),
    canTeacherCredit: z.boolean(),
  })
  .passthrough();

export const TeacherStudentTreeTaskSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().nullable(),
    statementLite: z.string(),
    answerType: TaskAnswerTypeSchema,
    isRequired: z.boolean(),
    sortOrder: z.number(),
    pendingPhotoReviewCount: z.number(),
    state: TeacherStudentTaskStateSchema,
  })
  .passthrough();

export const TeacherStudentTreeUnitSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    sortOrder: z.number(),
    state: z
      .object({
        status: StudentUnitStatusSchema,
        completionPercent: z.number(),
        solvedPercent: z.number(),
        countedTasks: z.number(),
        solvedTasks: z.number(),
        totalTasks: z.number(),
        overrideOpened: z.boolean(),
      })
      .passthrough(),
    tasks: z.array(TeacherStudentTreeTaskSchema),
  })
  .passthrough();

export const TeacherStudentTreeSectionSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    sortOrder: z.number(),
    units: z.array(TeacherStudentTreeUnitSchema),
  })
  .passthrough();

export const TeacherStudentCourseTreeSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    sections: z.array(TeacherStudentTreeSectionSchema),
  })
  .passthrough();

export const TeacherStudentProfileResponseSchema = z
  .object({
    profile: z
      .object({
        id: z.string().min(1),
        login: z.string().min(1),
        firstName: z.string().nullable().optional(),
        lastName: z.string().nullable().optional(),
        leadTeacherId: z.string().min(1),
        leadTeacherLogin: z.string().min(1),
        leadTeacherDisplayName: z.string().optional(),
      })
      .passthrough(),
    notifications: z
      .object({
        activeCount: z.number(),
        items: z.array(TeacherNotificationSchema),
      })
      .passthrough(),
    courses: z.array(
      z
        .object({
          id: z.string().min(1),
          title: z.string(),
        })
        .passthrough(),
    ),
    selectedCourseId: z.string().nullable(),
    courseTree: TeacherStudentCourseTreeSchema.nullable(),
  })
  .passthrough();

export const TeacherTaskCreditResponseSchema = z
  .object({
    ok: z.literal(true),
    status: z.string(),
    taskId: z.string().min(1),
    studentId: z.string().min(1),
  })
  .passthrough();

export const TeacherOverrideOpenUnitResponseSchema = z
  .object({
    ok: z.literal(true),
  })
  .passthrough();

export type StudentCourse = z.infer<typeof StudentCourseSchema>;
export type StudentSection = z.infer<typeof StudentSectionSchema>;
export type StudentUnit = z.infer<typeof StudentUnitSchema>;
export type UnitHtmlAssetRef = z.infer<typeof UnitHtmlAssetRefSchema>;
export type StudentGraphNode = z.infer<typeof StudentGraphNodeSchema>;
export type StudentGraphEdge = z.infer<typeof StudentGraphEdgeSchema>;
export type StudentCourseListResponse = z.infer<typeof StudentCourseListResponseSchema>;
export type StudentCourseDetailResponse = z.infer<typeof StudentCourseDetailResponseSchema>;
export type StudentSectionDetailResponse = z.infer<typeof StudentSectionDetailResponseSchema>;
export type StudentSectionGraphResponse = z.infer<typeof StudentSectionGraphResponseSchema>;
export type StudentUnitRenderedContentResponse = z.infer<typeof StudentUnitRenderedContentResponseSchema>;
export type StudentTaskSolutionRenderedContentResponse = z.infer<
  typeof StudentTaskSolutionRenderedContentResponseSchema
>;

export type TeacherCourse = z.infer<typeof TeacherCourseSchema>;
export type TeacherSection = z.infer<typeof TeacherSectionSchema>;
export type TeacherSectionMeta = z.infer<typeof TeacherSectionMetaSchema>;
export type TeacherUnit = z.infer<typeof TeacherUnitSchema>;
export type TeacherGraphNode = z.infer<typeof TeacherGraphNodeSchema>;
export type TeacherGraphEdge = z.infer<typeof TeacherGraphEdgeSchema>;
export type TeacherSectionGraphUpdateRequest = z.infer<typeof TeacherSectionGraphUpdateRequestSchema>;
export type StudentDashboardCourseSummary = z.infer<typeof StudentDashboardCourseSummarySchema>;
export type StudentDashboardContinueLearning = z.infer<typeof StudentDashboardContinueLearningSchema>;
export type StudentDashboardStats = z.infer<typeof StudentDashboardStatsSchema>;
export type StudentDashboardOverviewResponse = z.infer<typeof StudentDashboardOverviewResponseSchema>;
export type TeacherCourseListResponse = z.infer<typeof TeacherCourseListResponseSchema>;
export type TeacherCourseDetailResponse = z.infer<typeof TeacherCourseDetailResponseSchema>;
export type TeacherSectionDetailResponse = z.infer<typeof TeacherSectionDetailResponseSchema>;
export type TeacherSectionGraphResponse = z.infer<typeof TeacherSectionGraphResponseSchema>;
export type TeacherCreateCourseRequest = z.infer<typeof TeacherCreateCourseRequestSchema>;
export type TeacherUpdateCourseRequest = z.infer<typeof TeacherUpdateCourseRequestSchema>;
export type TeacherCreateSectionRequest = z.infer<typeof TeacherCreateSectionRequestSchema>;
export type TeacherUpdateSectionRequest = z.infer<typeof TeacherUpdateSectionRequestSchema>;
export type TeacherCreateUnitRequest = z.infer<typeof TeacherCreateUnitRequestSchema>;
export type TeacherStudentSummary = z.infer<typeof TeacherStudentSummarySchema>;
export type TeacherSummary = z.infer<typeof TeacherSummarySchema>;
export type TeacherStudentsListQuery = z.infer<typeof TeacherStudentsListQuerySchema>;
export type TeacherStudentsListResponse = z.infer<typeof TeacherStudentsListResponseSchema>;
export type TeacherTeachersListResponse = z.infer<typeof TeacherTeachersListResponseSchema>;
export type TeacherCreateStudentRequest = z.infer<typeof TeacherCreateStudentRequestSchema>;
export type TeacherCreateStudentResponse = z.infer<typeof TeacherCreateStudentResponseSchema>;
export type TeacherResetStudentPasswordResponse = z.infer<typeof TeacherResetStudentPasswordResponseSchema>;
export type TeacherTransferStudentRequest = z.infer<typeof TeacherTransferStudentRequestSchema>;
export type TeacherTransferStudentResponse = z.infer<typeof TeacherTransferStudentResponseSchema>;
export type TeacherUpdateStudentProfileRequest = z.infer<typeof TeacherUpdateStudentProfileRequestSchema>;
export type TeacherUpdateStudentProfileResponse = z.infer<typeof TeacherUpdateStudentProfileResponseSchema>;
export type TeacherDeleteStudentResponse = z.infer<typeof TeacherDeleteStudentResponseSchema>;
export type TeacherStudentProfileQuery = z.infer<typeof TeacherStudentProfileQuerySchema>;
export type TeacherStudentTaskState = z.infer<typeof TeacherStudentTaskStateSchema>;
export type TeacherStudentTreeTask = z.infer<typeof TeacherStudentTreeTaskSchema>;
export type TeacherStudentTreeUnit = z.infer<typeof TeacherStudentTreeUnitSchema>;
export type TeacherStudentTreeSection = z.infer<typeof TeacherStudentTreeSectionSchema>;
export type TeacherStudentCourseTree = z.infer<typeof TeacherStudentCourseTreeSchema>;
export type TeacherStudentProfileResponse = z.infer<typeof TeacherStudentProfileResponseSchema>;
export type TeacherTaskCreditResponse = z.infer<typeof TeacherTaskCreditResponseSchema>;
export type TeacherOverrideOpenUnitResponse = z.infer<typeof TeacherOverrideOpenUnitResponseSchema>;
