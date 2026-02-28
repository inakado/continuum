import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  getApiErrorMessageByAudience,
  getApiErrorPayloadByAudience,
} from "@/lib/api/error-catalog";

describe("error-catalog", () => {
  it("uses student-specific code override when available", () => {
    const error = new ApiError(409, "legacy message", "INVALID_FILE_TYPE");

    expect(getApiErrorMessageByAudience(error, "student")).toBe(
      "Неподдерживаемый тип файла. Разрешены JPEG, PNG и WEBP.",
    );
    expect(getApiErrorPayloadByAudience(error, "student")).toEqual({
      code: "INVALID_FILE_TYPE",
      message: "Неподдерживаемый тип файла. Разрешены JPEG, PNG и WEBP.",
    });
  });

  it("keeps teacher status-based fallback semantics", () => {
    expect(getApiErrorMessageByAudience(new ApiError(401, "Unauthorized"), "teacher")).toBe(
      "Перелогиньтесь",
    );
    expect(getApiErrorMessageByAudience(new ApiError(409, "Конфликт"), "teacher")).toBe(
      "Конфликт",
    );
  });

  it("formats payload for unknown runtime errors", () => {
    expect(getApiErrorPayloadByAudience(new Error("boom"), "teacher")).toEqual({
      code: "UNKNOWN_ERROR",
      message: "Неизвестная ошибка",
    });
  });

  it("falls back to generic student messages for auth and not-found statuses", () => {
    expect(getApiErrorMessageByAudience(new ApiError(403, "Forbidden"), "student")).toBe(
      "Перелогиньтесь",
    );
    expect(getApiErrorMessageByAudience(new ApiError(404, "Missing"), "student")).toBe(
      "Не найдено или недоступно",
    );
  });
});
