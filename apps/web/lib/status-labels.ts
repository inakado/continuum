export type ContentStatus = "draft" | "published";

export type StudentUnitStatus = "locked" | "available" | "in_progress" | "completed";

export type StudentTaskStatus =
  | "not_started"
  | "in_progress"
  | "correct"
  | "pending_review"
  | "accepted"
  | "rejected"
  | "blocked"
  | "credited_without_progress"
  | "teacher_credited";

export type PhotoReviewStatus = "pending_review" | "accepted" | "rejected";

export type ApiErrorCode =
  | "UNIT_LOCKED"
  | "STUDENT_NOT_ASSIGNED_TO_TEACHER"
  | "STUDENT_NOT_FOUND"
  | "TEACHER_NOT_FOUND"
  | "UNIT_NOT_FOUND"
  | "TASK_NOT_FOUND"
  | "TASK_STATE_NOT_FOUND"
  | "TASK_ALREADY_CREDITED"
  | "OVERRIDE_ALREADY_EXISTS"
  | "TASK_NOT_BLOCKED"
  | "PHOTO_SUBMISSION_NOT_FOUND"
  | "INVALID_ASSET_KEY"
  | "INVALID_CURRENT_PASSWORD"
  | "WEAK_PASSWORD"
  | "LOGIN_ALREADY_EXISTS"
  | "LOGIN_REQUIRED"
  | "INVALID_PROFILE_NAME"
  | "CANNOT_DELETE_SELF"
  | "TEACHER_HAS_STUDENTS";

const contentStatusLabels: Record<ContentStatus, string> = {
  draft: "Черновик",
  published: "Опубликован",
};

const studentUnitStatusLabels: Record<StudentUnitStatus, string> = {
  locked: "Заблокирован",
  available: "Доступен",
  in_progress: "В процессе",
  completed: "Завершён",
};

const studentTaskStatusLabels: Record<StudentTaskStatus, string> = {
  not_started: "Не начата",
  in_progress: "В процессе",
  correct: "Верно",
  pending_review: "На проверке",
  accepted: "Принято",
  rejected: "Отклонено",
  blocked: "Блок",
  credited_without_progress: "Зачтено без прогресса",
  teacher_credited: "Зачтено учителем",
};

const photoReviewStatusLabels: Record<PhotoReviewStatus, string> = {
  pending_review: "На проверке",
  accepted: "Принято",
  rejected: "Отклонено",
};

const apiErrorCodeLabels: Record<ApiErrorCode, string> = {
  UNIT_LOCKED: "Юнит пока заблокирован.",
  STUDENT_NOT_ASSIGNED_TO_TEACHER: "Ученик не назначен этому преподавателю.",
  STUDENT_NOT_FOUND: "Ученик не найден.",
  TEACHER_NOT_FOUND: "Преподаватель не найден.",
  UNIT_NOT_FOUND: "Юнит не найден.",
  TASK_NOT_FOUND: "Задача не найдена.",
  TASK_STATE_NOT_FOUND: "Состояние задачи ученика не найдено.",
  TASK_ALREADY_CREDITED: "Задача уже зачтена.",
  OVERRIDE_ALREADY_EXISTS: "Этот юнит уже открыт для ученика.",
  TASK_NOT_BLOCKED: "Задача сейчас не заблокирована.",
  PHOTO_SUBMISSION_NOT_FOUND: "Фото-отправка не найдена.",
  INVALID_ASSET_KEY: "Файл не найден для выбранной отправки.",
  INVALID_CURRENT_PASSWORD: "Текущий пароль указан неверно.",
  WEAK_PASSWORD: "Пароль слишком слабый: минимум 8 символов, буквы и цифры.",
  LOGIN_ALREADY_EXISTS: "Такой логин уже существует.",
  LOGIN_REQUIRED: "Укажите логин.",
  INVALID_PROFILE_NAME: "Проверьте корректность ФИО.",
  CANNOT_DELETE_SELF: "Нельзя удалить собственного пользователя.",
  TEACHER_HAS_STUDENTS: "Нельзя удалить преподавателя, пока к нему привязаны ученики.",
};

export const getContentStatusLabel = (status?: ContentStatus | null) => {
  if (!status) return "Неизвестно";
  return contentStatusLabels[status];
};

export const getStudentUnitStatusLabel = (status?: StudentUnitStatus | null) => {
  if (!status) return "Неизвестно";
  return studentUnitStatusLabels[status];
};

export const getStudentTaskStatusLabel = (status?: StudentTaskStatus | null) => {
  if (!status) return "Неизвестно";
  return studentTaskStatusLabels[status];
};

export const getPhotoReviewStatusLabel = (status?: PhotoReviewStatus | null) => {
  if (!status) return "Неизвестно";
  return photoReviewStatusLabels[status];
};

export const getApiErrorCodeLabel = (code?: string | null) => {
  if (!code) return null;
  if (code in apiErrorCodeLabels) {
    return apiErrorCodeLabels[code as ApiErrorCode];
  }
  return null;
};
