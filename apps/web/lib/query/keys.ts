import type { TeacherReviewInboxFilters } from "@/lib/api/teacher";

export const learningPhotoQueryKeys = {
  studentUnit: (unitId: string) =>
    ["learning-photo", "student", "unit", unitId] as const,
  studentUnitPdfPreview: (unitId: string, target: "theory" | "method") =>
    ["learning-photo", "student", "unit", unitId, "pdf-preview", target] as const,
  studentTaskSolutionPdfPreview: (taskId: string) =>
    ["learning-photo", "student", "task", taskId, "solution-pdf"] as const,
  studentTaskStatementImagePreview: (taskId: string) =>
    ["learning-photo", "student", "task", taskId, "statement-image"] as const,
  teacherReviewInbox: (filters: TeacherReviewInboxFilters | undefined) =>
    ["learning-photo", "teacher", "review", "inbox", filters ?? {}] as const,
  teacherReviewSubmissionDetail: (
    submissionId: string,
    filters: Omit<TeacherReviewInboxFilters, "limit" | "offset"> | undefined,
  ) => ["learning-photo", "teacher", "review", "submission", submissionId, filters ?? {}] as const,
  teacherPhotoAssetPreview: (studentId: string, taskId: string, assetKey: string) =>
    ["learning-photo", "teacher", "review", "asset-preview", studentId, taskId, assetKey] as const,
} as const;
