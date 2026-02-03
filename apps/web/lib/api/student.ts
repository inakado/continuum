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
  status: ContentStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type Task = {
  id: string;
  unitId: string;
  title: string | null;
  statementLite: string;
  answerType: string;
  isRequired: boolean;
  status: ContentStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
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

export type LoginResponse = {
  accessToken: string;
  user: { id: string; login: string; role: string };
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
};
