import type { Task } from "@/lib/api/student";
import styles from "../student-unit-detail.module.css";

type Props = {
  tasks: Task[];
  activeTaskIndex: number;
  onSelectTask: (taskId: string) => void;
};

export function StudentTaskTabs({ tasks, activeTaskIndex, onSelectTask }: Props) {
  return (
    <div className={styles.taskTabs}>
      {tasks.map((task, index) => {
        const isActive = index === activeTaskIndex;
        const isCorrect = task.state?.status === "correct";

        return (
          <button
            key={task.id}
            type="button"
            className={`${styles.taskTab} ${isActive ? styles.taskTabActive : ""} ${isCorrect ? styles.taskTabDone : ""}`}
            onClick={() => onSelectTask(task.id)}
          >
            <span>{index + 1}</span>
          </button>
        );
      })}
    </div>
  );
}
