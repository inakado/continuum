import { ApiError } from "@/lib/api/client";

export const getStudentErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return "Перелогиньтесь";
    }
    if (error.status === 404) {
      return "Не найдено или недоступно";
    }
    return error.message || "Ошибка запроса";
  }
  return "Неизвестная ошибка";
};
