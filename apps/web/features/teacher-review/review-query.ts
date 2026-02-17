import type { TeacherReviewInboxFilters, TeacherReviewSubmissionStatus } from "@/lib/api/teacher";

type SearchParamsLike = {
  get(name: string): string | null;
};

export type ReviewRouteFilters = Omit<TeacherReviewInboxFilters, "limit" | "offset"> & {
  status: TeacherReviewSubmissionStatus;
  sort: "oldest" | "newest";
};

const normalizeStatus = (value: string | null): TeacherReviewSubmissionStatus => {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === "pending_review" || trimmed === "submitted") return "pending_review";
  if (trimmed === "accepted" || trimmed === "rejected") return trimmed;
  return "pending_review";
};

const normalizeSort = (value: string | null): "oldest" | "newest" => {
  const trimmed = value?.trim();
  if (trimmed === "newest") return "newest";
  return "oldest";
};

const normalizeOptional = (value: string | null): string | undefined => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

export const readReviewRouteFilters = (searchParams: SearchParamsLike): ReviewRouteFilters => ({
  status: normalizeStatus(searchParams.get("status")),
  sort: normalizeSort(searchParams.get("sort")),
  studentId: normalizeOptional(searchParams.get("studentId")),
  courseId: normalizeOptional(searchParams.get("courseId")),
  sectionId: normalizeOptional(searchParams.get("sectionId")),
  unitId: normalizeOptional(searchParams.get("unitId")),
  taskId: normalizeOptional(searchParams.get("taskId")),
});

export const buildReviewSearch = (
  filters: Partial<ReviewRouteFilters>,
  paging?: { limit?: number; offset?: number },
) => {
  const search = new URLSearchParams();
  if (filters.status) search.set("status", filters.status);
  if (filters.sort) search.set("sort", filters.sort);
  if (filters.studentId) search.set("studentId", filters.studentId);
  if (filters.courseId) search.set("courseId", filters.courseId);
  if (filters.sectionId) search.set("sectionId", filters.sectionId);
  if (filters.unitId) search.set("unitId", filters.unitId);
  if (filters.taskId) search.set("taskId", filters.taskId);
  if (paging?.limit !== undefined) search.set("limit", String(paging.limit));
  if (paging?.offset !== undefined) search.set("offset", String(paging.offset));
  return search.toString();
};
