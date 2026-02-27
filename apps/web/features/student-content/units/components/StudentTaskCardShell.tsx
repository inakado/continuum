import { type ReactNode } from "react";
import type { Task } from "@/lib/api/student";
import LiteTex from "@/components/LiteTex";
import styles from "../student-unit-detail.module.css";

type Props = {
  task: Task;
  taskIndex: number;
  children: ReactNode;
};

export function StudentTaskCardShell({ task, taskIndex, children }: Props) {
  return (
    <div className={styles.taskCard}>
      <div className={styles.taskHeader}>
        <div className={styles.taskTitle}>Задача №{taskIndex + 1}</div>
        <div className={styles.taskHeaderBadges}>
          {task.isRequired ? <span className={styles.taskBadge}>Обязательная</span> : null}
        </div>
      </div>

      <div className={styles.taskStatement}>
        <LiteTex value={task.statementLite} block />
      </div>

      {children}
    </div>
  );
}
