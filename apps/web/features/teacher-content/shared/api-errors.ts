import { ApiError } from "@/lib/api/client";

export const getApiErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return "Перелогиньтесь";
    }
    if (error.status === 409) {
      return error.message;
    }
    return error.message || "Ошибка запроса";
  }
  return "Неизвестная ошибка";
};
