import { apiRequest } from "./client";
import type { MeResponse } from "./auth";

export type ContentStatus = "draft" | "published";

export type Course = {
  id: string;
  title: string;
  description: string | null;
  status: ContentStatus;
  createdAt: string;
  updatedAt: string;
};

export type UnitVideo = { id: string; title: string; embedUrl: string };
export type UnitAttachment = { id: string; name: string; urlOrKey?: string | null };
export type TaskAnswerType = "numeric" | "single_choice" | "multi_choice" | "photo";
export type NumericPart = { key: string; labelLite?: string | null; correctValue: string };
export type Choice = { key: string; textLite: string };
export type CorrectAnswer = { key?: string; keys?: string[] };

export type Section = {
  id: string;
  courseId: string;
  title: string;
  status: ContentStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Unit = {
  id: string;
  sectionId: string;
  title: string;
  description?: string | null;
  status: ContentStatus;
  sortOrder: number;
  minOptionalCountedTasksToComplete: number;
  theoryRichLatex?: string | null;
  theoryPdfAssetKey?: string | null;
  methodRichLatex?: string | null;
  methodPdfAssetKey?: string | null;
  videosJson?: UnitVideo[] | null;
  attachmentsJson?: UnitAttachment[] | null;
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: string;
  unitId: string;
  title: string | null;
  statementLite: string;
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

export type StudentSummary = {
  id: string;
  login: string;
  firstName?: string | null;
  lastName?: string | null;
  leadTeacherId: string;
  leadTeacherLogin: string;
  createdAt: string;
  updatedAt: string;
  activeNotificationsCount: number;
};

export type TeacherSummary = {
  id: string;
  login: string;
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
  state: TeacherStudentTaskState;
};

export type TeacherStudentTreeUnit = {
  id: string;
  title: string;
  sortOrder: number;
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

export type TeacherStudentProfileResponse = {
  profile: {
    id: string;
    login: string;
    firstName?: string | null;
    lastName?: string | null;
    leadTeacherId: string;
    leadTeacherLogin: string;
  };
  notifications: {
    activeCount: number;
    items: TeacherNotification[];
  };
  courses: Array<{ id: string; title: string }>;
  selectedCourseId: string | null;
  courseTree: TeacherStudentCourseTree | null;
};

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

export type CourseWithSections = Course & { sections: Section[] };
export type SectionWithUnits = Section & { units: Unit[] };
export type UnitWithTasks = Unit & { tasks: Task[] };

export type GraphNode = {
  unitId: string;
  title: string;
  status: ContentStatus;
  position: { x: number; y: number };
};

export type GraphEdge = {
  id: string;
  fromUnitId: string;
  toUnitId: string;
};

export type SectionGraphResponse = {
  sectionId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export type SectionGraphUpdateRequest = {
  nodes: { unitId: string; position: { x: number; y: number } }[];
  edges: { fromUnitId: string; toUnitId: string }[];
};

export type LoginResponse = {
  accessToken: string;
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

export type TaskSolutionPdfPresignedResponse = {
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

export type TeacherStudentPhotoQueueItem = {
  submissionId: string;
  taskId: string;
  taskTitle: string | null;
  unitId: string;
  unitTitle: string;
  status: "submitted" | "accepted" | "rejected";
  submittedAt: string;
  rejectedReason: string | null;
  assetKeysCount: number;
};

export type TeacherStudentPhotoQueueResponse = {
  items: TeacherStudentPhotoQueueItem[];
  total: number;
  limit: number;
  offset: number;
};

export type TeacherPhotoPresignViewResponse = {
  ok: true;
  assetKey: string;
  expiresInSec: number;
  url: string;
};

export type TeacherPhotoReviewResponse = {
  ok: true;
  submission: TeacherPhotoSubmission;
  taskState: {
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
  unitSnapshot?: {
    unitId: string;
    status: "locked" | "available" | "in_progress" | "completed";
    totalTasks: number;
    countedTasks: number;
    solvedTasks: number;
    completionPercent: number;
    solvedPercent: number;
  };
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

  listCourses() {
    return apiRequest<Course[]>("/teacher/courses");
  },

  getCourse(id: string) {
    return apiRequest<CourseWithSections>(`/teacher/courses/${id}`);
  },

  createCourse(data: { title: string; description?: string | null }) {
    return apiRequest<Course>("/teacher/courses", { method: "POST", body: data });
  },

  updateCourse(id: string, data: { title?: string; description?: string | null }) {
    return apiRequest<Course>(`/teacher/courses/${id}`, { method: "PATCH", body: data });
  },

  publishCourse(id: string) {
    return apiRequest<Course>(`/teacher/courses/${id}/publish`, { method: "POST" });
  },

  unpublishCourse(id: string) {
    return apiRequest<Course>(`/teacher/courses/${id}/unpublish`, { method: "POST" });
  },

  getSection(id: string) {
    return apiRequest<SectionWithUnits>(`/teacher/sections/${id}`);
  },

  getSectionGraph(id: string) {
    return apiRequest<SectionGraphResponse>(`/teacher/sections/${id}/graph`);
  },

  updateSectionGraph(id: string, payload: SectionGraphUpdateRequest) {
    return apiRequest<SectionGraphResponse>(`/teacher/sections/${id}/graph`, {
      method: "PUT",
      body: payload,
    });
  },

  createSection(data: { courseId: string; title: string; sortOrder?: number }) {
    return apiRequest<Section>("/teacher/sections", { method: "POST", body: data });
  },

  updateSection(id: string, data: { title?: string; sortOrder?: number }) {
    return apiRequest<Section>(`/teacher/sections/${id}`, { method: "PATCH", body: data });
  },

  publishSection(id: string) {
    return apiRequest<Section>(`/teacher/sections/${id}/publish`, { method: "POST" });
  },

  unpublishSection(id: string) {
    return apiRequest<Section>(`/teacher/sections/${id}/unpublish`, { method: "POST" });
  },

  getUnit(id: string) {
    return apiRequest<UnitWithTasks>(`/teacher/units/${id}`);
  },

  createUnit(data: { sectionId: string; title: string; sortOrder?: number }) {
    return apiRequest<Unit>("/teacher/units", { method: "POST", body: data });
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

  getTaskSolutionPdfPresignedUrl(taskId: string, ttlSec = 600) {
    const search = new URLSearchParams({ ttlSec: String(ttlSec) });
    return apiRequest<TaskSolutionPdfPresignedResponse>(
      `/teacher/tasks/${taskId}/solution/pdf-presign?${search.toString()}`,
    );
  },

  getTaskSolutionPdfPresignForTeacher(taskId: string, ttlSec = 600) {
    const search = new URLSearchParams({ ttlSec: String(ttlSec) });
    return apiRequest<TaskSolutionPdfPresignedResponse>(
      `/teacher/tasks/${taskId}/solution/pdf-presign?${search.toString()}`,
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
    return apiRequest<Course>(`/teacher/courses/${id}`, { method: "DELETE" });
  },

  deleteSection(id: string) {
    return apiRequest<Section>(`/teacher/sections/${id}`, { method: "DELETE" });
  },

  deleteUnit(id: string) {
    return apiRequest<Unit>(`/teacher/units/${id}`, { method: "DELETE" });
  },

  deleteTask(id: string) {
    return apiRequest<Task>(`/teacher/tasks/${id}`, { method: "DELETE" });
  },

  listStudents(params?: { query?: string }) {
    const search = new URLSearchParams();
    if (params?.query) search.set("query", params.query);
    const suffix = search.toString();
    return apiRequest<StudentSummary[]>(`/teacher/students${suffix ? `?${suffix}` : ""}`);
  },

  createStudent(data: { login: string; firstName?: string | null; lastName?: string | null }) {
    return apiRequest<{
      id: string;
      login: string;
      leadTeacherId: string;
      firstName?: string | null;
      lastName?: string | null;
      password: string;
    }>("/teacher/students", { method: "POST", body: data });
  },

  resetStudentPassword(id: string) {
    return apiRequest<{ id: string; login: string; password: string }>(
      `/teacher/students/${id}/reset-password`,
      { method: "POST" },
    );
  },

  transferStudent(id: string, data: { leaderTeacherId: string }) {
    return apiRequest<{
      id: string;
      login: string;
      leadTeacherId: string;
      leadTeacherLogin: string;
    }>(`/teacher/students/${id}/transfer`, {
      method: "PATCH",
      body: data,
    });
  },

  updateStudentProfile(
    id: string,
    data: { firstName?: string | null; lastName?: string | null },
  ) {
    return apiRequest<{
      id: string;
      login: string;
      firstName?: string | null;
      lastName?: string | null;
    }>(`/teacher/students/${id}`, {
      method: "PATCH",
      body: data,
    });
  },

  deleteStudent(id: string) {
    return apiRequest<{ id: string; login: string }>(`/teacher/students/${id}`, {
      method: "DELETE",
    });
  },

  listTeachers() {
    return apiRequest<TeacherSummary[]>("/teacher/teachers");
  },

  getStudentProfile(studentId: string, params?: { courseId?: string }) {
    const search = new URLSearchParams();
    if (params?.courseId) search.set("courseId", params.courseId);
    const suffix = search.toString();
    return apiRequest<TeacherStudentProfileResponse>(
      `/teacher/students/${studentId}${suffix ? `?${suffix}` : ""}`,
    );
  },

  getStudentUnitPreview(studentId: string, unitId: string) {
    return apiRequest<TeacherStudentUnitPreview>(`/teacher/students/${studentId}/units/${unitId}`);
  },

  listStudentPhotoQueue(
    studentId: string,
    params?: { status?: "submitted" | "accepted" | "rejected"; limit?: number; offset?: number },
  ) {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.limit !== undefined) search.set("limit", String(params.limit));
    if (params?.offset !== undefined) search.set("offset", String(params.offset));
    const suffix = search.toString();
    return apiRequest<TeacherStudentPhotoQueueResponse>(
      `/teacher/students/${studentId}/photo-submissions${suffix ? `?${suffix}` : ""}`,
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
    assetKey: string,
    ttlSec?: number,
  ) {
    const search = new URLSearchParams({ assetKey });
    if (ttlSec !== undefined) search.set("ttlSec", String(ttlSec));
    return apiRequest<TeacherPhotoPresignViewResponse>(
      `/teacher/students/${studentId}/tasks/${taskId}/photo-submissions/presign-view?${search.toString()}`,
    );
  },

  acceptStudentTaskPhotoSubmission(studentId: string, taskId: string, submissionId: string) {
    return apiRequest<TeacherPhotoReviewResponse>(
      `/teacher/students/${studentId}/tasks/${taskId}/photo-submissions/${submissionId}/accept`,
      { method: "POST" },
    );
  },

  rejectStudentTaskPhotoSubmission(
    studentId: string,
    taskId: string,
    submissionId: string,
    reason?: string,
  ) {
    return apiRequest<TeacherPhotoReviewResponse>(
      `/teacher/students/${studentId}/tasks/${taskId}/photo-submissions/${submissionId}/reject`,
      {
        method: "POST",
        body: reason?.trim() ? { reason: reason.trim() } : {},
      },
    );
  },

  creditStudentTask(studentId: string, taskId: string) {
    return apiRequest<{ status: string; taskId: string; studentId: string }>(
      `/teacher/students/${studentId}/tasks/${taskId}/credit`,
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
    const search = new URLSearchParams({ ttlSec: String(ttlSec) });
    return apiRequest<LatexCompileJobStatusResponse>(
      `/teacher/latex/jobs/${jobId}?${search.toString()}`,
    );
  },

  getLatexJob(jobId: string, ttlSec = 600) {
    const search = new URLSearchParams({ ttlSec: String(ttlSec) });
    return apiRequest<LatexCompileJobStatusResponse>(
      `/teacher/latex/jobs/${jobId}?${search.toString()}`,
    );
  },

  applyLatexCompileJob(jobId: string) {
    return apiRequest<LatexCompileApplyResponse>(`/teacher/latex/jobs/${jobId}/apply`, {
      method: "POST",
    });
  },
};
