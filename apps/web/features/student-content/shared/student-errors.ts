import { getApiErrorMessageByAudience } from "@/lib/api/error-catalog";

export const getStudentErrorMessage = (error: unknown) => {
  return getApiErrorMessageByAudience(error, "student");
};
