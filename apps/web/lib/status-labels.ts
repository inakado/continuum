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
