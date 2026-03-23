import type { Task } from "@/lib/api/student";
import styles from "../student-unit-detail.module.css";

type Props = {
  tasks: Task[];
  activeTaskIndex: number;
  onSelectTask: (taskId: string) => void;
};

const DONE_TASK_STATUSES = new Set([
  "correct",
  "accepted",
  "credited_without_progress",
  "teacher_credited",
]);

export function StudentTaskTabs({ tasks, activeTaskIndex, onSelectTask }: Props) {
  return (
    <div className={styles.taskTabs} aria-label="Навигация по задачам">
      {tasks.map((task, index) => {
        const isActive = index === activeTaskIndex;
        const isDone = task.state ? DONE_TASK_STATUSES.has(task.state.status) : false;

        return (
          <button
            key={task.id}
            type="button"
            className={`${styles.taskTab} ${isActive ? styles.taskTabActive : ""} ${isDone ? styles.taskTabDone : ""}`}
            onClick={() => onSelectTask(task.id)}
            aria-label={task.isRequired ? `Задача ${index + 1}, ключевая` : `Задача ${index + 1}`}
            aria-current={isActive ? "true" : undefined}
            title={task.isRequired ? "Ключевая задача" : undefined}
          >
            <span>{index + 1}</span>
          </button>
        );
      })}
    </div>
  );
}
