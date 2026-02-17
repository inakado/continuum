import { ApiError } from "@/lib/api/client";
import { getApiErrorCodeLabel } from "@/lib/status-labels";

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

export type ApiErrorPayload = {
  code: string;
  message: string;
};

export const getApiErrorPayload = (error: unknown): ApiErrorPayload => {
  if (error instanceof ApiError) {
    const code = error.code ?? `HTTP_${error.status}`;
    const message = getApiErrorCodeLabel(error.code) ?? getApiErrorMessage(error);
    return { code, message };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: getApiErrorMessage(error),
  };
};

export const formatApiErrorPayload = (error: unknown) => {
  const payload = getApiErrorPayload(error);
  return `{ code: "${payload.code}", message: "${payload.message}" }`;
};
