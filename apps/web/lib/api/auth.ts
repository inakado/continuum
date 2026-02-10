import { apiRequest } from "./client";

export type MeResponse = {
  user: {
    id: string;
    login: string;
    role: "teacher" | "student" | string;
  };
  profile?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
};

export const authApi = {
  me() {
    return apiRequest<MeResponse>("/auth/me");
  },
};
