import {
  type UiApiErrorPayload,
  getApiErrorMessageByAudience,
  getApiErrorPayloadByAudience,
} from "@/lib/api/error-catalog";

export const getApiErrorMessage = (error: unknown) => {
  return getApiErrorMessageByAudience(error, "teacher");
};

export type ApiErrorPayload = UiApiErrorPayload;

export const getApiErrorPayload = (error: unknown): ApiErrorPayload => {
  return getApiErrorPayloadByAudience(error, "teacher");
};

export const formatApiErrorPayload = (error: unknown) => {
  const payload = getApiErrorPayload(error);
  return `{ code: "${payload.code}", message: "${payload.message}" }`;
};
