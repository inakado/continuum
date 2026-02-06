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
  solutionLite?: string | null;
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
      theoryRichLatex?: string | null;
      methodRichLatex?: string | null;
      videosJson?: UnitVideo[] | null;
      attachmentsJson?: UnitAttachment[] | null;
    },
  ) {
    return apiRequest<Unit>(`/teacher/units/${id}`, { method: "PATCH", body: data });
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
    solutionLite?: string | null;
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
      solutionLite?: string | null;
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
};
