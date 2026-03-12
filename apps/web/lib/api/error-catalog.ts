import { ApiError } from "@/lib/api/client";
import { getApiErrorCodeLabel } from "@/lib/status-labels";

type ApiErrorAudience = "teacher" | "student";

export type UiApiErrorPayload = {
  code: string;
  message: string;
};

const STUDENT_CODE_MESSAGES: Record<string, string> = {
  INVALID_FILE_TYPE: "Неподдерживаемый тип файла. Разрешены JPEG, PNG и WEBP.",
  FILE_TOO_LARGE: "Файл слишком большой. Уменьшите размер и попробуйте снова.",
  TOO_MANY_FILES: "Слишком много файлов. Выберите допустимое количество.",
  INVALID_ASSET_KEY: "Некорректный файл для отправки. Повторите загрузку.",
  SECTION_LOCKED: "Раздел заблокирован. Сначала завершите предыдущий раздел.",
  UNIT_LOCKED: "Юнит заблокирован. Завершите предыдущие юниты в графе.",
  TASK_NOT_PHOTO: "Эта задача не поддерживает фото-ответ.",
  TASK_ACTIVE_REVISION_MISSING: "В задаче нет активной ревизии. Сообщите преподавателю.",
  SOLUTION_NOT_AVAILABLE_YET: "Решение станет доступно после зачёта задачи.",
  SOLUTION_PDF_MISSING: "PDF-решение ещё не подготовлено преподавателем.",
  STATEMENT_IMAGE_MISSING: "Изображение условия пока недоступно.",
};

const getCatalogLabel = (code: string | null | undefined, audience: ApiErrorAudience) => {
  if (!code) return null;
  if (audience === "student" && STUDENT_CODE_MESSAGES[code]) {
    return STUDENT_CODE_MESSAGES[code];
  }
  return getApiErrorCodeLabel(code) ?? null;
};

export const getApiErrorMessageByAudience = (error: unknown, audience: ApiErrorAudience) => {
  if (error instanceof ApiError) {
    if (audience === "student") {
      const catalogMessage = getCatalogLabel(error.code, audience);
      if (catalogMessage) return catalogMessage;
      if (error.status === 401 || error.status === 403) return "Перелогиньтесь";
      if (error.status === 404) return "Не найдено или недоступно";
      return error.message || "Ошибка запроса";
    }

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

export const getApiErrorPayloadByAudience = (
  error: unknown,
  audience: ApiErrorAudience,
): UiApiErrorPayload => {
  if (error instanceof ApiError) {
    const code = error.code ?? `HTTP_${error.status}`;
    const message = getCatalogLabel(error.code, audience) ?? getApiErrorMessageByAudience(error, audience);
    return { code, message };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: getApiErrorMessageByAudience(error, audience),
  };
};
