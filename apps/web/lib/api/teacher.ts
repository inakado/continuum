import {
  StudentUnitRenderedContentResponseSchema,
  TeacherCourseDetailResponseSchema,
  TeacherCourseListResponseSchema,
  TeacherCourseSchema,
  TeacherCreateStudentResponseSchema,
  TeacherDeleteStudentResponseSchema,
  TeacherOverrideOpenUnitResponseSchema,
  TeacherPhotoPresignViewResponseSchema,
  TeacherPhotoReviewResponseSchema,
  TeacherResetStudentPasswordResponseSchema,
  TeacherReviewInboxResponseSchema,
  TeacherReviewSubmissionDetailResponseSchema,
  TeacherSectionDetailResponseSchema,
  TeacherSectionMetaSchema,
  TeacherSectionGraphResponseSchema,
  TeacherSectionSchema,
  TeacherStudentPhotoQueueResponseSchema,
  TeacherStudentProfileResponseSchema,
  TeacherStudentsListResponseSchema,
  TeacherTaskCreditResponseSchema,
  TeacherTeachersListResponseSchema,
  TeacherTransferStudentResponseSchema,
  TeacherUnitSchema,
  TeacherUpdateStudentProfileResponseSchema,
  type TeacherCourse as SharedTeacherCourse,
  type TeacherCourseDetailResponse as SharedTeacherCourseDetailResponse,
  type TeacherCreateCourseRequest as SharedTeacherCreateCourseRequest,
  type TeacherCreateSectionRequest as SharedTeacherCreateSectionRequest,
  type TeacherCreateStudentRequest as SharedTeacherCreateStudentRequest,
  type TeacherCreateUnitRequest as SharedTeacherCreateUnitRequest,
  type TeacherGraphEdge as SharedTeacherGraphEdge,
  type TeacherGraphNode as SharedTeacherGraphNode,
  type TeacherPhotoInboxQuery as SharedTeacherPhotoInboxQuery,
  type TeacherPhotoPresignViewQuery as SharedTeacherPhotoPresignViewQuery,
  type TeacherPhotoPresignViewResponse as SharedTeacherPhotoPresignViewResponse,
  type TeacherPhotoQueueQuery as SharedTeacherPhotoQueueQuery,
  type TeacherPhotoRejectRequest as SharedTeacherPhotoRejectRequest,
  type TeacherPhotoReviewResponse as SharedTeacherPhotoReviewResponse,
  type TeacherPhotoSubmissionDetailQuery as SharedTeacherPhotoSubmissionDetailQuery,
  type TeacherReviewInboxResponse as SharedTeacherReviewInboxResponse,
  type TeacherReviewSubmissionDetailResponse as SharedTeacherReviewSubmissionDetailResponse,
  type TeacherSection as SharedTeacherSection,
  type TeacherSectionDetailResponse as SharedTeacherSectionDetailResponse,
  type TeacherSectionMeta as SharedTeacherSectionMeta,
  type TeacherSectionGraphResponse as SharedTeacherSectionGraphResponse,
  type TeacherSectionGraphUpdateRequest as SharedTeacherSectionGraphUpdateRequest,
  type TeacherStudentPhotoQueueResponse as SharedTeacherStudentPhotoQueueResponse,
  type TeacherStudentProfileQuery as SharedTeacherStudentProfileQuery,
  type TeacherStudentProfileResponse as SharedTeacherStudentProfileResponse,
  type TeacherStudentSummary as SharedTeacherStudentSummary,
  type TeacherStudentsListQuery as SharedTeacherStudentsListQuery,
  type StudentUnitRenderedContentResponse as SharedStudentUnitRenderedContentResponse,
  type TeacherSummary as SharedTeacherSummary,
  type TeacherTransferStudentRequest as SharedTeacherTransferStudentRequest,
  type TeacherUnit as SharedTeacherUnit,
  type TeacherUpdateCourseRequest as SharedTeacherUpdateCourseRequest,
  type TeacherUpdateSectionRequest as SharedTeacherUpdateSectionRequest,
  type TeacherUpdateStudentProfileRequest as SharedTeacherUpdateStudentProfileRequest,
} from "@continuum/shared";
import { apiRequest, apiRequestParsed } from "./client";
import type { MeResponse } from "./auth";

export type ContentStatus = "draft" | "published";

export type Course = SharedTeacherCourse;

export type UnitVideo = { id: string; title: string; embedUrl: string };
export type UnitAttachment = { id: string; name: string; urlOrKey?: string | null };
export type TaskAnswerType = "numeric" | "single_choice" | "multi_choice" | "photo";
export type NumericPart = { key: string; labelLite?: string | null; correctValue: string };
export type Choice = { key: string; textLite: string };
export type CorrectAnswer = { key?: string; keys?: string[] };

export type Section = SharedTeacherSection;
export type SectionMeta = SharedTeacherSectionMeta;

export type Unit = SharedTeacherUnit & {
  theoryRichLatex?: string | null;
  theoryPdfAssetKey?: string | null;
  methodRichLatex?: string | null;
  methodPdfAssetKey?: string | null;
  videosJson?: UnitVideo[] | null;
  attachmentsJson?: UnitAttachment[] | null;
  section?: {
    id: string;
    title: string;
    courseId: string;
  } | null;
};

export type Task = {
  id: string;
  unitId: string;
  title: string | null;
  statementLite: string;
  statementImageAssetKey?: string | null;
  answerType: TaskAnswerType;
  numericPartsJson?: NumericPart[] | null;
  choicesJson?: Choice[] | null;
  correctAnswerJson?: CorrectAnswer | null;
  solutionRichLatex?: string | null;
  solutionPdfAssetKey?: string | null;
  isRequired: boolean;
  status: ContentStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type EventLog = {
  id: string;
  category: "admin" | "learning" | "system";
  eventType: string;
  actorUserId: string | null;
  actorUser?: { id: string; login: string; role: string } | null;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
};

export type EventsResponse = {
  items: EventLog[];
  total: number;
  limit: number;
  offset: number;
};

export type StudentSummary = SharedTeacherStudentSummary;
export type TeacherSummary = SharedTeacherSummary;

export type TeacherMeResponse = {
  user: {
    id: string;
    login: string;
    role: "teacher" | "student" | string;
  };
  profile: {
    firstName: string;
    lastName: string;
    middleName?: string | null;
  } | null;
};

export type TeacherNotification = {
  id: string;
  type: "photo_reviewed" | "unit_override_opened" | "required_task_skipped" | "task_locked";
  payload: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
};

export type TeacherStudentTaskState = {
  status:
    | "not_started"
    | "in_progress"
    | "correct"
    | "pending_review"
    | "accepted"
    | "rejected"
    | "blocked"
    | "credited_without_progress"
    | "teacher_credited";
  attemptsUsed: number;
  wrongAttempts: number;
  blockedUntil: string | null;
  requiredSkippedFlag: boolean;
  isCredited: boolean;
  isTeacherCredited: boolean;
  canTeacherCredit: boolean;
};

export type TeacherStudentTreeTask = {
  id: string;
  title: string | null;
  statementLite: string;
  answerType: TaskAnswerType;
  isRequired: boolean;
  sortOrder: number;
  pendingPhotoReviewCount: number;
  state: TeacherStudentTaskState;
};

export type TeacherStudentTreeUnit = {
  id: string;
  title: string;
  sortOrder: number;
  state: {
    status: "locked" | "available" | "in_progress" | "completed";
    completionPercent: number;
    solvedPercent: number;
    countedTasks: number;
    solvedTasks: number;
    totalTasks: number;
    overrideOpened: boolean;
  };
  tasks: TeacherStudentTreeTask[];
};

export type TeacherStudentTreeSection = {
  id: string;
  title: string;
  sortOrder: number;
  units: TeacherStudentTreeUnit[];
};

export type TeacherStudentCourseTree = {
  id: string;
  title: string;
  sections: TeacherStudentTreeSection[];
};

export type TeacherStudentProfileResponse = SharedTeacherStudentProfileResponse;

export type TeacherStudentUnitTask = Task & {
  state?: {
    status:
      | "not_started"
      | "in_progress"
      | "correct"
      | "pending_review"
      | "accepted"
      | "rejected"
      | "blocked"
      | "credited_without_progress"
      | "teacher_credited";
    wrongAttempts: number;
    blockedUntil: string | null;
    requiredSkipped: boolean;
  };
};

export type TeacherStudentUnitPreview = Unit & { tasks: TeacherStudentUnitTask[] };

export type CourseWithSections = SharedTeacherCourseDetailResponse;
export type SectionWithUnits = SharedTeacherSectionDetailResponse;
export type UnitWithTasks = Unit & { tasks: Task[] };

export type GraphNode = SharedTeacherGraphNode;
export type GraphEdge = SharedTeacherGraphEdge;
export type SectionGraphResponse = SharedTeacherSectionGraphResponse;
export type SectionGraphUpdateRequest = SharedTeacherSectionGraphUpdateRequest;

export type LoginResponse = {
  user: { id: string; login: string; role: string };
};

export type LatexCompileEnqueueResponse = {
  jobId: string;
};

export type LatexCompileJobStatusResponse = {
  jobId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  assetKey?: string;
  presignedUrl?: string;
  error?: {
    code: string;
    message: string;
    log?: string;
    logTruncated?: boolean;
    logLimitBytes?: number;
    logSnippet?: string;
  };
};

export type LatexCompileApplyResponse = {
  ok: true;
  applied?: boolean;
  reason?: "already_applied" | "stale";
  unitId?: string;
  taskId?: string;
  taskRevisionId?: string;
  activeRevisionId?: string;
  target: "theory" | "method" | "task_solution";
  assetKey: string;
};

export type UnitPdfPresignedResponse = {
  ok: true;
  target: "theory" | "method";
  key: string | null;
  expiresInSec: number;
  url: string | null;
};

export type TeacherUnitRenderedContentResponse = SharedStudentUnitRenderedContentResponse;

export type TaskSolutionPdfPresignedResponse = {
  ok: true;
  taskId: string;
  taskRevisionId: string;
  key: string;
  expiresInSec: number;
  url: string;
};

export type TaskStatementImagePresignUploadResponse = {
  uploadUrl: string;
  assetKey: string;
  headers?: Record<string, string>;
  expiresInSec: number;
};

export type TaskStatementImageApplyResponse = {
  ok: true;
  taskId: string;
  taskRevisionId: string;
  assetKey: string | null;
};

export type TaskStatementImagePresignViewResponse = {
  ok: true;
  taskId: string;
  taskRevisionId: string;
  key: string;
  expiresInSec: number;
  url: string;
};

export type TeacherPhotoSubmission = {
  id: string;
  studentUserId: string;
  taskId: string;
  taskRevisionId: string;
  unitId: string;
  attemptId: string;
  status: "submitted" | "accepted" | "rejected";
  assetKeys: string[];
  rejectedReason: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  reviewedByTeacherUserId: string | null;
};

export type TeacherTaskPhotoSubmissionsResponse = {
  items: TeacherPhotoSubmission[];
};

export type TeacherStudentPhotoQueueResponse = SharedTeacherStudentPhotoQueueResponse;
export type TeacherStudentPhotoQueueItem = TeacherStudentPhotoQueueResponse["items"][number];
export type TeacherPhotoPresignViewResponse = SharedTeacherPhotoPresignViewResponse;
export type TeacherPhotoReviewResponse = SharedTeacherPhotoReviewResponse;
export type TeacherReviewInboxResponse = SharedTeacherReviewInboxResponse;
export type TeacherReviewSubmissionDetailResponse = SharedTeacherReviewSubmissionDetailResponse;
export type TeacherReviewInboxItem = TeacherReviewInboxResponse["items"][number];
export type TeacherReviewSubmissionStatus = TeacherReviewInboxItem["status"];

export type TeacherReviewInboxFilters = Partial<
  Pick<
    SharedTeacherPhotoInboxQuery,
    | "status"
    | "studentId"
    | "courseId"
    | "sectionId"
    | "unitId"
    | "taskId"
    | "sort"
    | "limit"
    | "offset"
  >
>;
export type TeacherReviewSubmissionDetailFilters = Partial<
  Pick<
    SharedTeacherPhotoSubmissionDetailQuery,
    "status" | "studentId" | "courseId" | "sectionId" | "unitId" | "taskId" | "sort"
  >
>;

const appendReviewFiltersToSearch = (
  search: URLSearchParams,
  params?: TeacherReviewInboxFilters | TeacherReviewSubmissionDetailFilters,
) => {
  if (!params) return;
  if (params.status) search.set("status", params.status);
  if (params.studentId) search.set("studentId", params.studentId);
  if (params.courseId) search.set("courseId", params.courseId);
  if (params.sectionId) search.set("sectionId", params.sectionId);
  if (params.unitId) search.set("unitId", params.unitId);
  if (params.taskId) search.set("taskId", params.taskId);
  if (params.sort) search.set("sort", params.sort);
};

const buildTaskSolutionPdfPresignPath = (taskId: string, ttlSec: number) => {
  const search = new URLSearchParams({ ttlSec: String(ttlSec) });
  return `/teacher/tasks/${taskId}/solution/pdf-presign?${search.toString()}`;
};

const creditTaskRequest = (studentId: string, taskId: string) =>
  apiRequestParsed(
    `/teacher/students/${studentId}/tasks/${taskId}/credit`,
    TeacherTaskCreditResponseSchema,
    {
      method: "POST",
    },
  );

const buildLatexCompileJobPath = (jobId: string, ttlSec: number) => {
  const search = new URLSearchParams({ ttlSec: String(ttlSec) });
  return `/teacher/latex/jobs/${jobId}?${search.toString()}`;
};

export const teacherApi = {
  login(login: string, password: string) {
    return apiRequest<LoginResponse>("/auth/login", {
      method: "POST",
      body: { login, password },
    });
  },

  logout() {
    return apiRequest<{ ok: boolean }>("/auth/logout", { method: "POST" });
  },

  me() {
    return apiRequest<MeResponse>("/auth/me");
  },

  getTeacherMe() {
    return apiRequest<TeacherMeResponse>("/teacher/me");
  },

  updateTeacherMeProfile(data: {
    firstName: string;
    lastName: string;
    middleName?: string | null;
  }) {
    return apiRequest<TeacherMeResponse>("/teacher/me", {
      method: "PATCH",
      body: data,
    });
  },

  changeTeacherMyPassword(data: { currentPassword: string; newPassword: string }) {
    return apiRequest<{ ok: true }>("/teacher/me/change-password", {
      method: "POST",
      body: data,
    });
  },

  listCourses() {
    return apiRequestParsed("/teacher/courses", TeacherCourseListResponseSchema);
  },

  getCourse(id: string) {
    return apiRequestParsed(`/teacher/courses/${id}`, TeacherCourseDetailResponseSchema);
  },

  createCourse(data: SharedTeacherCreateCourseRequest) {
    return apiRequestParsed("/teacher/courses", TeacherCourseSchema, { method: "POST", body: data });
  },

  updateCourse(id: string, data: SharedTeacherUpdateCourseRequest) {
    return apiRequestParsed(`/teacher/courses/${id}`, TeacherCourseSchema, { method: "PATCH", body: data });
  },

  publishCourse(id: string) {
    return apiRequestParsed(`/teacher/courses/${id}/publish`, TeacherCourseSchema, { method: "POST" });
  },

  unpublishCourse(id: string) {
    return apiRequestParsed(`/teacher/courses/${id}/unpublish`, TeacherCourseSchema, { method: "POST" });
  },

  getSection(id: string) {
    return apiRequestParsed(`/teacher/sections/${id}`, TeacherSectionDetailResponseSchema);
  },

  getSectionMeta(id: string) {
    return apiRequestParsed(`/teacher/sections/${id}/meta`, TeacherSectionMetaSchema);
  },

  getSectionGraph(id: string) {
    return apiRequestParsed(`/teacher/sections/${id}/graph`, TeacherSectionGraphResponseSchema);
  },

  updateSectionGraph(id: string, payload: SectionGraphUpdateRequest) {
    return apiRequestParsed(`/teacher/sections/${id}/graph`, TeacherSectionGraphResponseSchema, {
      method: "PUT",
      body: payload,
    });
  },

  createSection(data: SharedTeacherCreateSectionRequest) {
    return apiRequestParsed("/teacher/sections", TeacherSectionSchema, { method: "POST", body: data });
  },

  updateSection(id: string, data: SharedTeacherUpdateSectionRequest) {
    return apiRequestParsed(`/teacher/sections/${id}`, TeacherSectionSchema, { method: "PATCH", body: data });
  },

  publishSection(id: string) {
    return apiRequestParsed(`/teacher/sections/${id}/publish`, TeacherSectionSchema, { method: "POST" });
  },

  unpublishSection(id: string) {
    return apiRequestParsed(`/teacher/sections/${id}/unpublish`, TeacherSectionSchema, { method: "POST" });
  },

  getUnit(id: string) {
    return apiRequest<UnitWithTasks>(`/teacher/units/${id}`);
  },

  createUnit(data: SharedTeacherCreateUnitRequest) {
    return apiRequestParsed("/teacher/units", TeacherUnitSchema, { method: "POST", body: data });
  },

  updateUnit(
    id: string,
    data: {
      title?: string;
      description?: string | null;
      sortOrder?: number;
      minOptionalCountedTasksToComplete?: number;
      theoryRichLatex?: string | null;
      theoryPdfAssetKey?: string | null;
      methodRichLatex?: string | null;
      methodPdfAssetKey?: string | null;
      videosJson?: UnitVideo[] | null;
      attachmentsJson?: UnitAttachment[] | null;
    },
  ) {
    return apiRequest<Unit>(`/teacher/units/${id}`, { method: "PATCH", body: data });
  },

  getUnitPdfPresignedUrl(
    id: string,
    target: "theory" | "method",
    ttlSec = 600,
  ) {
    const search = new URLSearchParams({
      target,
      ttlSec: String(ttlSec),
    });
    return apiRequest<UnitPdfPresignedResponse>(`/teacher/units/${id}/pdf-presign?${search.toString()}`);
  },

  getUnitRenderedContent(id: string, target: "theory" | "method", ttlSec = 600) {
    const search = new URLSearchParams({ target, ttlSec: String(ttlSec) });
    return apiRequestParsed(
      `/teacher/units/${id}/rendered-content?${search.toString()}`,
      StudentUnitRenderedContentResponseSchema,
    );
  },

  getTaskSolutionPdfPresignedUrl(taskId: string, ttlSec = 600) {
    return apiRequest<TaskSolutionPdfPresignedResponse>(
      buildTaskSolutionPdfPresignPath(taskId, ttlSec),
    );
  },

  getTaskSolutionPdfPresignForTeacher(taskId: string, ttlSec = 600) {
    return apiRequest<TaskSolutionPdfPresignedResponse>(
      buildTaskSolutionPdfPresignPath(taskId, ttlSec),
    );
  },

  presignTaskStatementImageUpload(
    taskId: string,
    file: { filename: string; contentType: string; sizeBytes: number },
    ttlSec?: number,
  ) {
    return apiRequest<TaskStatementImagePresignUploadResponse>(
      `/teacher/tasks/${taskId}/statement-image/presign-upload`,
      {
        method: "POST",
        body: {
          file,
          ...(ttlSec !== undefined ? { ttlSec } : null),
        },
      },
    );
  },

  applyTaskStatementImage(taskId: string, assetKey: string) {
    return apiRequest<TaskStatementImageApplyResponse>(
      `/teacher/tasks/${taskId}/statement-image/apply`,
      {
        method: "POST",
        body: { assetKey },
      },
    );
  },

  deleteTaskStatementImage(taskId: string) {
    return apiRequest<TaskStatementImageApplyResponse>(
      `/teacher/tasks/${taskId}/statement-image`,
      { method: "DELETE" },
    );
  },

  presignTaskStatementImageView(taskId: string, ttlSec = 600) {
    const search = new URLSearchParams({ ttlSec: String(ttlSec) });
    return apiRequest<TaskStatementImagePresignViewResponse>(
      `/teacher/tasks/${taskId}/statement-image/presign-view?${search.toString()}`,
    );
  },

  publishUnit(id: string) {
    return apiRequest<Unit>(`/teacher/units/${id}/publish`, { method: "POST" });
  },

  unpublishUnit(id: string) {
    return apiRequest<Unit>(`/teacher/units/${id}/unpublish`, { method: "POST" });
  },

  getTask(id: string) {
    return apiRequest<Task>(`/teacher/tasks/${id}`);
  },

  createTask(data: {
    unitId: string;
    title?: string | null;
    statementLite: string;
    answerType: TaskAnswerType;
    numericPartsJson?: NumericPart[] | null;
    choicesJson?: Choice[] | null;
    correctAnswerJson?: CorrectAnswer | null;
    isRequired?: boolean;
    sortOrder?: number;
  }) {
    return apiRequest<Task>("/teacher/tasks", { method: "POST", body: data });
  },

  updateTask(
    id: string,
    data: {
      title?: string | null;
      statementLite?: string;
      answerType?: TaskAnswerType;
      numericPartsJson?: NumericPart[] | null;
      choicesJson?: Choice[] | null;
      correctAnswerJson?: CorrectAnswer | null;
      isRequired?: boolean;
      sortOrder?: number;
    },
  ) {
    return apiRequest<Task>(`/teacher/tasks/${id}`, { method: "PATCH", body: data });
  },

  publishTask(id: string) {
    return apiRequest<Task>(`/teacher/tasks/${id}/publish`, { method: "POST" });
  },

  unpublishTask(id: string) {
    return apiRequest<Task>(`/teacher/tasks/${id}/unpublish`, { method: "POST" });
  },

  deleteCourse(id: string) {
    return apiRequestParsed(`/teacher/courses/${id}`, TeacherCourseSchema, { method: "DELETE" });
  },

  deleteSection(id: string) {
    return apiRequestParsed(`/teacher/sections/${id}`, TeacherSectionSchema, { method: "DELETE" });
  },

  deleteUnit(id: string) {
    return apiRequest<Unit>(`/teacher/units/${id}`, { method: "DELETE" });
  },

  deleteTask(id: string) {
    return apiRequest<Task>(`/teacher/tasks/${id}`, { method: "DELETE" });
  },

  listStudents(params?: SharedTeacherStudentsListQuery) {
    const search = new URLSearchParams();
    if (params?.query) search.set("query", params.query);
    const suffix = search.toString();
    return apiRequestParsed(
      `/teacher/students${suffix ? `?${suffix}` : ""}`,
      TeacherStudentsListResponseSchema,
    );
  },

  createStudent(data: SharedTeacherCreateStudentRequest) {
    return apiRequestParsed(
      "/teacher/students",
      TeacherCreateStudentResponseSchema,
      { method: "POST", body: data },
    );
  },

  resetStudentPassword(id: string) {
    return apiRequestParsed(
      `/teacher/students/${id}/reset-password`,
      TeacherResetStudentPasswordResponseSchema,
      { method: "POST" },
    );
  },

  transferStudent(id: string, data: SharedTeacherTransferStudentRequest) {
    return apiRequestParsed(
      `/teacher/students/${id}/transfer`,
      TeacherTransferStudentResponseSchema,
      {
        method: "PATCH",
        body: data,
      },
    );
  },

  updateStudentProfile(
    id: string,
    data: SharedTeacherUpdateStudentProfileRequest,
  ) {
    return apiRequestParsed(
      `/teacher/students/${id}`,
      TeacherUpdateStudentProfileResponseSchema,
      {
        method: "PATCH",
        body: data,
      },
    );
  },

  deleteStudent(id: string) {
    return apiRequestParsed(`/teacher/students/${id}`, TeacherDeleteStudentResponseSchema, {
      method: "DELETE",
    });
  },

  listTeachers() {
    return apiRequestParsed("/teacher/teachers", TeacherTeachersListResponseSchema);
  },

  createTeacher(data: {
    login: string;
    firstName: string;
    lastName: string;
    middleName?: string | null;
    password?: string | null;
    generatePassword?: boolean;
  }) {
    return apiRequest<{
      id: string;
      login: string;
      firstName: string;
      lastName: string;
      middleName?: string | null;
      password?: string | null;
    }>("/teacher/teachers", {
      method: "POST",
      body: data,
    });
  },

  deleteTeacher(id: string) {
    return apiRequest<{
      id: string;
      login: string;
      firstName?: string | null;
      lastName?: string | null;
      middleName?: string | null;
    }>(`/teacher/teachers/${id}`, {
      method: "DELETE",
    });
  },

  getStudentProfile(studentId: string, params?: SharedTeacherStudentProfileQuery) {
    const search = new URLSearchParams();
    if (params?.courseId) search.set("courseId", params.courseId);
    const suffix = search.toString();
    return apiRequestParsed(
      `/teacher/students/${studentId}${suffix ? `?${suffix}` : ""}`,
      TeacherStudentProfileResponseSchema,
    );
  },

  getStudentUnitPreview(studentId: string, unitId: string) {
    return apiRequest<TeacherStudentUnitPreview>(`/teacher/students/${studentId}/units/${unitId}`);
  },

  listTeacherPhotoInbox(params?: TeacherReviewInboxFilters) {
    const search = new URLSearchParams();
    appendReviewFiltersToSearch(search, params);
    if (params?.limit !== undefined) search.set("limit", String(params.limit));
    if (params?.offset !== undefined) search.set("offset", String(params.offset));
    const suffix = search.toString();
    return apiRequestParsed(
      `/teacher/photo-submissions${suffix ? `?${suffix}` : ""}`,
      TeacherReviewInboxResponseSchema,
    );
  },

  getTeacherPhotoSubmissionDetail(
    submissionId: string,
    params?: TeacherReviewSubmissionDetailFilters,
  ) {
    const search = new URLSearchParams();
    appendReviewFiltersToSearch(search, params);
    const suffix = search.toString();
    return apiRequestParsed(
      `/teacher/photo-submissions/${submissionId}${suffix ? `?${suffix}` : ""}`,
      TeacherReviewSubmissionDetailResponseSchema,
    );
  },

  listStudentPhotoQueue(
    studentId: string,
    params?: Partial<SharedTeacherPhotoQueueQuery>,
  ) {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.limit !== undefined) search.set("limit", String(params.limit));
    if (params?.offset !== undefined) search.set("offset", String(params.offset));
    const suffix = search.toString();
    return apiRequestParsed(
      `/teacher/students/${studentId}/photo-submissions${suffix ? `?${suffix}` : ""}`,
      TeacherStudentPhotoQueueResponseSchema,
    );
  },

  listStudentTaskPhotoSubmissions(studentId: string, taskId: string) {
    return apiRequest<TeacherTaskPhotoSubmissionsResponse>(
      `/teacher/students/${studentId}/tasks/${taskId}/photo-submissions`,
    );
  },

  presignStudentTaskPhotoView(
    studentId: string,
    taskId: string,
    assetKey: SharedTeacherPhotoPresignViewQuery["assetKey"],
    ttlSec?: SharedTeacherPhotoPresignViewQuery["ttlSec"],
  ) {
    const search = new URLSearchParams({ assetKey });
    if (ttlSec !== undefined) search.set("ttlSec", String(ttlSec));
    return apiRequestParsed(
      `/teacher/students/${studentId}/tasks/${taskId}/photo-submissions/presign-view?${search.toString()}`,
      TeacherPhotoPresignViewResponseSchema,
    );
  },

  acceptStudentTaskPhotoSubmission(studentId: string, taskId: string, submissionId: string) {
    return apiRequestParsed(
      `/teacher/students/${studentId}/tasks/${taskId}/photo-submissions/${submissionId}/accept`,
      TeacherPhotoReviewResponseSchema,
      { method: "POST" },
    );
  },

  rejectStudentTaskPhotoSubmission(
    studentId: string,
    taskId: string,
    submissionId: string,
    reason?: SharedTeacherPhotoRejectRequest["reason"],
  ) {
    return apiRequestParsed(
      `/teacher/students/${studentId}/tasks/${taskId}/photo-submissions/${submissionId}/reject`,
      TeacherPhotoReviewResponseSchema,
      {
        method: "POST",
        body: reason?.trim() ? { reason: reason.trim() } : {},
      },
    );
  },

  creditStudentTask(studentId: string, taskId: string) {
    return creditTaskRequest(studentId, taskId);
  },

  creditTask(studentId: string, taskId: string) {
    return creditTaskRequest(studentId, taskId);
  },

  overrideOpenUnit(studentId: string, unitId: string) {
    return apiRequestParsed(
      `/teacher/students/${studentId}/units/${unitId}/override-open`,
      TeacherOverrideOpenUnitResponseSchema,
      { method: "POST" },
    );
  },

  listEvents(params?: {
    category?: "admin" | "learning" | "system";
    limit?: number;
    offset?: number;
    entityType?: string;
    entityId?: string;
  }) {
    const search = new URLSearchParams();
    if (params?.category) search.set("category", params.category);
    if (params?.limit !== undefined) search.set("limit", String(params.limit));
    if (params?.offset !== undefined) search.set("offset", String(params.offset));
    if (params?.entityType) search.set("entityType", params.entityType);
    if (params?.entityId) search.set("entityId", params.entityId);
    const suffix = search.toString();
    return apiRequest<EventsResponse>(`/teacher/events${suffix ? `?${suffix}` : ""}`);
  },

  enqueueUnitLatexCompile(
    id: string,
    data: { tex: string; target: "theory" | "method"; ttlSec?: number },
  ) {
    return apiRequest<LatexCompileEnqueueResponse>(`/teacher/units/${id}/latex/compile`, {
      method: "POST",
      body: data,
    });
  },

  compileTaskSolutionLatex(taskId: string, data: { latex: string; ttlSec?: number }) {
    return apiRequest<LatexCompileEnqueueResponse>(`/teacher/tasks/${taskId}/solution/latex/compile`, {
      method: "POST",
      body: data,
    });
  },

  getLatexCompileJob(jobId: string, ttlSec = 600) {
    return apiRequest<LatexCompileJobStatusResponse>(buildLatexCompileJobPath(jobId, ttlSec));
  },

  getLatexJob(jobId: string, ttlSec = 600) {
    return apiRequest<LatexCompileJobStatusResponse>(buildLatexCompileJobPath(jobId, ttlSec));
  },

  applyLatexCompileJob(jobId: string) {
    return apiRequest<LatexCompileApplyResponse>(`/teacher/latex/jobs/${jobId}/apply`, {
      method: "POST",
    });
  },
};
