import { ApiError } from "@/lib/api/client";

export const getStudentErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.code === "INVALID_FILE_TYPE") {
      return "Неподдерживаемый тип файла. Разрешены JPEG, PNG и WEBP.";
    }
    if (error.code === "FILE_TOO_LARGE") {
      return "Файл слишком большой. Уменьшите размер и попробуйте снова.";
    }
    if (error.code === "TOO_MANY_FILES") {
      return "Слишком много файлов. Выберите допустимое количество.";
    }
    if (error.code === "INVALID_ASSET_KEY") {
      return "Некорректный файл для отправки. Повторите загрузку.";
    }
    if (error.code === "UNIT_LOCKED") {
      return "Юнит заблокирован. Завершите предыдущие юниты в графе.";
    }
    if (error.code === "TASK_NOT_PHOTO") {
      return "Эта задача не поддерживает фото-ответ.";
    }
    if (error.code === "TASK_ACTIVE_REVISION_MISSING") {
      return "В задаче нет активной ревизии. Сообщите преподавателю.";
    }
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
