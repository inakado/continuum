import {
  StudentDashboardOverviewResponseSchema,
  StudentCourseDetailResponseSchema,
  StudentCourseListResponseSchema,
  StudentSectionDetailResponseSchema,
  StudentSectionGraphResponseSchema,
  StudentAttemptResponseSchema,
  StudentPhotoPresignUploadResponseSchema,
  StudentPhotoPresignViewResponseSchema,
  StudentPhotoSubmitResponseSchema,
  StudentTaskSolutionRenderedContentResponseSchema,
  StudentUnitRenderedContentResponseSchema,
  type StudentCourse as SharedStudentCourse,
  type StudentDashboardOverviewResponse as SharedStudentDashboardOverviewResponse,
  type StudentCourseDetailResponse as SharedStudentCourseDetailResponse,
  type StudentGraphEdge as SharedStudentGraphEdge,
  type StudentGraphNode as SharedStudentGraphNode,
  type StudentSection as SharedStudentSection,
  type StudentSectionDetailResponse as SharedStudentSectionDetailResponse,
  type StudentSectionGraphResponse as SharedStudentSectionGraphResponse,
  type StudentUnit as SharedStudentUnit,
  type MultiChoiceAttemptRequest as SharedMultiChoiceAttemptRequest,
  type NumericAttemptRequest as SharedNumericAttemptRequest,
  type SingleChoiceAttemptRequest as SharedSingleChoiceAttemptRequest,
  type StudentAttemptResponse as SharedStudentAttemptResponse,
  type StudentPhotoPresignUploadRequest as SharedStudentPhotoPresignUploadRequest,
  type StudentPhotoPresignViewQuery as SharedStudentPhotoPresignViewQuery,
  type StudentPhotoPresignUploadResponse as SharedStudentPhotoPresignUploadResponse,
  type StudentPhotoSubmitRequest as SharedStudentPhotoSubmitRequest,
  type StudentPhotoPresignViewResponse as SharedStudentPhotoPresignViewResponse,
  type StudentPhotoSubmitResponse as SharedStudentPhotoSubmitResponse,
  type StudentTaskSolutionRenderedContentResponse as SharedStudentTaskSolutionRenderedContentResponse,
  type StudentUnitRenderedContentResponse as SharedStudentUnitRenderedContentResponse,
} from "@continuum/shared";
import { apiRequest, apiRequestParsed } from "./client";
import type { MeResponse } from "./auth";

export type ContentStatus = "draft" | "published";
export type StudentUnitStatus = "locked" | "available" | "in_progress" | "completed";

export type Course = SharedStudentCourse;
export type StudentDashboardOverview = SharedStudentDashboardOverviewResponse;
export type StudentDashboardCourseSummary = StudentDashboardOverview["courses"][number];

export type UnitVideo = { id: string; title: string; embedUrl: string };
export type UnitAttachment = { id: string; name: string; urlOrKey?: string | null };
export type TaskAnswerType = "numeric" | "single_choice" | "multi_choice" | "photo";
export type NumericPart = {
  key: string;
  labelLite?: string | null;
  correctValue?: string;
};
export type Choice = { key: string; textLite: string };
export type TaskState = {
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

export type NumericAttemptRequest = SharedNumericAttemptRequest;
export type SingleChoiceAttemptRequest = SharedSingleChoiceAttemptRequest;
export type MultiChoiceAttemptRequest = SharedMultiChoiceAttemptRequest;
export type AttemptRequest =
  | NumericAttemptRequest
  | SingleChoiceAttemptRequest
  | MultiChoiceAttemptRequest;

export type AttemptResponse = SharedStudentAttemptResponse;

export type Section = SharedStudentSection;

export type Unit = SharedStudentUnit & {
  theoryRichLatex?: string | null;
  theoryPdfAssetKey?: string | null;
  theoryHtmlAssetKey?: string | null;
  methodRichLatex?: string | null;
  methodPdfAssetKey?: string | null;
  methodHtmlAssetKey?: string | null;
  videosJson?: UnitVideo[] | null;
  attachmentsJson?: UnitAttachment[] | null;
  unitStatus?: StudentUnitStatus;
  countedTasks?: number;
  optionalCountedTasks?: number;
  solvedTasks?: number;
  totalTasks?: number;
  completionPercent?: number;
  solvedPercent?: number;
};

export type Task = {
  id: string;
  unitId: string;
  title: string | null;
  statementLite: string;
  hasStatementImage?: boolean;
  solutionRichLatex?: string | null;
  solutionHtmlAssetKey?: string | null;
  answerType: TaskAnswerType;
  numericPartsJson?: NumericPart[] | null;
  choicesJson?: Choice[] | null;
  correctAnswerJson?: { key?: string; keys?: string[] } | null;
  isRequired: boolean;
  status: ContentStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  state?: TaskState;
};

export type CourseWithSections = SharedStudentCourseDetailResponse;
export type SectionWithUnits = SharedStudentSectionDetailResponse;
export type UnitWithTasks = Unit & { tasks: Task[] };

export type GraphNode = SharedStudentGraphNode;

export type GraphEdge = SharedStudentGraphEdge;

export type SectionGraphResponse = SharedStudentSectionGraphResponse;

export type LoginResponse = {
  user: { id: string; login: string; role: string };
};

export type UnitPdfPresignedResponse = {
  ok: boolean;
  target: "theory" | "method";
  key: string | null;
  expiresInSec: number;
  url: string | null;
};

export type StudentUnitRenderedContentResponse = SharedStudentUnitRenderedContentResponse;

export type StudentPhotoFileInput = SharedStudentPhotoPresignUploadRequest["files"][number];

export type StudentPhotoTaskSubmission = {
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

export type StudentPhotoSubmissionsResponse = {
  items: StudentPhotoTaskSubmission[];
};

export type StudentPhotoPresignUploadResponse = SharedStudentPhotoPresignUploadResponse;
export type StudentPhotoSubmitResponse = SharedStudentPhotoSubmitResponse;
export type StudentPhotoPresignViewResponse = SharedStudentPhotoPresignViewResponse;

export type StudentTaskSolutionRenderedContentResponse =
  SharedStudentTaskSolutionRenderedContentResponse;

export type StudentTaskStatementImagePresignViewResponse = {
  ok: true;
  taskId: string;
  taskRevisionId: string;
  key: string;
  expiresInSec: number;
  url: string;
};

export const studentApi = {
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
    return apiRequestParsed("/courses", StudentCourseListResponseSchema);
  },

  getDashboardOverview(ttlSec = 180) {
    const search = new URLSearchParams({ ttlSec: String(ttlSec) });
    return apiRequestParsed(
      `/student/dashboard?${search.toString()}`,
      StudentDashboardOverviewResponseSchema,
    );
  },

  getCourse(id: string) {
    return apiRequestParsed(`/courses/${id}`, StudentCourseDetailResponseSchema);
  },

  getSection(id: string) {
    return apiRequestParsed(`/sections/${id}`, StudentSectionDetailResponseSchema);
  },

  getSectionGraph(id: string) {
    return apiRequestParsed(`/sections/${id}/graph`, StudentSectionGraphResponseSchema);
  },

  getUnit(id: string) {
    return apiRequest<UnitWithTasks>(`/units/${id}`);
  },

  getUnitPdfPresignedUrl(id: string, target: "theory" | "method", ttlSec = 180) {
    const search = new URLSearchParams({ target, ttlSec: String(ttlSec) });
    return apiRequest<UnitPdfPresignedResponse>(`/units/${id}/pdf-presign?${search.toString()}`);
  },

  getUnitRenderedContent(id: string, target: "theory" | "method", ttlSec = 180) {
    const search = new URLSearchParams({ target, ttlSec: String(ttlSec) });
    return apiRequestParsed(
      `/units/${id}/rendered-content?${search.toString()}`,
      StudentUnitRenderedContentResponseSchema,
    );
  },

  submitAttempt(taskId: string, body: AttemptRequest) {
    return apiRequestParsed(`/student/tasks/${taskId}/attempts`, StudentAttemptResponseSchema, {
      method: "POST",
      body,
    });
  },

  presignPhotoUpload(
    taskId: string,
    files: StudentPhotoFileInput[],
    ttlSec?: SharedStudentPhotoPresignUploadRequest["ttlSec"],
  ) {
    return apiRequestParsed(
      `/student/tasks/${taskId}/photo/presign-upload`,
      StudentPhotoPresignUploadResponseSchema,
      {
        method: "POST",
        body: {
          files,
          ...(ttlSec !== undefined ? { ttlSec } : null),
        },
      },
    );
  },

  submitPhoto(taskId: string, assetKeys: SharedStudentPhotoSubmitRequest["assetKeys"]) {
    return apiRequestParsed(`/student/tasks/${taskId}/photo/submit`, StudentPhotoSubmitResponseSchema, {
      method: "POST",
      body: { assetKeys },
    });
  },

  listPhotoSubmissions(taskId: string) {
    return apiRequest<StudentPhotoSubmissionsResponse>(`/student/tasks/${taskId}/photo/submissions`);
  },

  presignPhotoView(
    taskId: string,
    assetKey: SharedStudentPhotoPresignViewQuery["assetKey"],
    ttlSec?: SharedStudentPhotoPresignViewQuery["ttlSec"],
  ) {
    const search = new URLSearchParams({ assetKey });
    if (ttlSec !== undefined) {
      search.set("ttlSec", String(ttlSec));
    }
    return apiRequestParsed(
      `/student/tasks/${taskId}/photo/presign-view?${search.toString()}`,
      StudentPhotoPresignViewResponseSchema,
    );
  },

  getTaskSolutionRenderedContentForStudent(taskId: string, ttlSec = 180) {
    const search = new URLSearchParams({ ttlSec: String(ttlSec) });
    return apiRequestParsed(
      `/student/tasks/${taskId}/solution/rendered-content?${search.toString()}`,
      StudentTaskSolutionRenderedContentResponseSchema,
    );
  },

  getTaskStatementImagePresignForStudent(taskId: string, ttlSec = 180) {
    const search = new URLSearchParams({ ttlSec: String(ttlSec) });
    return apiRequest<StudentTaskStatementImagePresignViewResponse>(
      `/student/tasks/${taskId}/statement-image/presign-view?${search.toString()}`,
    );
  },
};
