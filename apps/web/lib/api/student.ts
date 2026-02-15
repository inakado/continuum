import { apiRequest } from "./client";
import type { MeResponse } from "./auth";

export type ContentStatus = "draft" | "published";
export type StudentUnitStatus = "locked" | "available" | "in_progress" | "completed";

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

export type NumericAttemptRequest = { answers: { partKey: string; value: string }[] };
export type SingleChoiceAttemptRequest = { choiceKey: string };
export type MultiChoiceAttemptRequest = { choiceKeys: string[] };
export type AttemptRequest =
  | NumericAttemptRequest
  | SingleChoiceAttemptRequest
  | MultiChoiceAttemptRequest;

export type AttemptResponse = {
  status: TaskState["status"];
  attemptNo: number;
  wrongAttempts: number;
  blockedUntil: string | null;
  perPart?: { partKey: string; correct: boolean }[];
};

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
  unitStatus?: StudentUnitStatus;
  countedTasks?: number;
  optionalCountedTasks?: number;
  solvedTasks?: number;
  totalTasks?: number;
  completionPercent?: number;
  solvedPercent?: number;
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: string;
  unitId: string;
  title: string | null;
  statementLite: string;
  solutionRichLatex?: string | null;
  solutionPdfAssetKey?: string | null;
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

export type CourseWithSections = Course & { sections: Section[] };
export type SectionWithUnits = Section & { units: Unit[] };
export type UnitWithTasks = Unit & { tasks: Task[] };

export type GraphNode = {
  unitId: string;
  title: string;
  status: StudentUnitStatus;
  position: { x: number; y: number };
  completionPercent: number;
  solvedPercent: number;
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

export type LoginResponse = {
  accessToken: string;
  user: { id: string; login: string; role: string };
};

export type UnitPdfPresignedResponse = {
  ok: boolean;
  target: "theory" | "method";
  key: string | null;
  expiresInSec: number;
  url: string | null;
};

export type StudentPhotoFileInput = {
  filename: string;
  contentType: string;
  sizeBytes: number;
};

export type StudentPhotoPresignUploadResponse = {
  uploads: Array<{
    assetKey: string;
    url: string;
    headers?: Record<string, string>;
  }>;
  expiresInSec: number;
};

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

export type StudentPhotoSubmitResponse = {
  ok: true;
  submissionId: string;
  taskState: {
    status: TaskState["status"];
    wrongAttempts: number;
    blockedUntil: string | null;
    requiredSkipped: boolean;
  };
  unitSnapshot?: {
    unitId: string;
    status: StudentUnitStatus;
    totalTasks: number;
    countedTasks: number;
    solvedTasks: number;
    completionPercent: number;
    solvedPercent: number;
  };
};

export type StudentPhotoPresignViewResponse = {
  ok: true;
  assetKey: string;
  expiresInSec: number;
  url: string;
};

export type StudentTaskSolutionPdfPresignResponse = {
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
    return apiRequest<Course[]>("/courses");
  },

  getCourse(id: string) {
    return apiRequest<CourseWithSections>(`/courses/${id}`);
  },

  getSection(id: string) {
    return apiRequest<SectionWithUnits>(`/sections/${id}`);
  },

  getSectionGraph(id: string) {
    return apiRequest<SectionGraphResponse>(`/sections/${id}/graph`);
  },

  getUnit(id: string) {
    return apiRequest<UnitWithTasks>(`/units/${id}`);
  },

  getUnitPdfPresignedUrl(id: string, target: "theory" | "method", ttlSec = 180) {
    const search = new URLSearchParams({ target, ttlSec: String(ttlSec) });
    return apiRequest<UnitPdfPresignedResponse>(`/units/${id}/pdf-presign?${search.toString()}`);
  },

  submitAttempt(taskId: string, body: AttemptRequest) {
    return apiRequest<AttemptResponse>(`/student/tasks/${taskId}/attempts`, {
      method: "POST",
      body,
    });
  },

  presignPhotoUpload(taskId: string, files: StudentPhotoFileInput[], ttlSec?: number) {
    return apiRequest<StudentPhotoPresignUploadResponse>(
      `/student/tasks/${taskId}/photo/presign-upload`,
      {
        method: "POST",
        body: {
          files,
          ...(ttlSec !== undefined ? { ttlSec } : null),
        },
      },
    );
  },

  submitPhoto(taskId: string, assetKeys: string[]) {
    return apiRequest<StudentPhotoSubmitResponse>(`/student/tasks/${taskId}/photo/submit`, {
      method: "POST",
      body: { assetKeys },
    });
  },

  listPhotoSubmissions(taskId: string) {
    return apiRequest<StudentPhotoSubmissionsResponse>(`/student/tasks/${taskId}/photo/submissions`);
  },

  presignPhotoView(taskId: string, assetKey: string, ttlSec?: number) {
    const search = new URLSearchParams({ assetKey });
    if (ttlSec !== undefined) {
      search.set("ttlSec", String(ttlSec));
    }
    return apiRequest<StudentPhotoPresignViewResponse>(
      `/student/tasks/${taskId}/photo/presign-view?${search.toString()}`,
    );
  },

  getTaskSolutionPdfPresignForStudent(taskId: string, ttlSec = 180) {
    const search = new URLSearchParams({ ttlSec: String(ttlSec) });
    return apiRequest<StudentTaskSolutionPdfPresignResponse>(
      `/student/tasks/${taskId}/solution/pdf-presign?${search.toString()}`,
    );
  },
};
