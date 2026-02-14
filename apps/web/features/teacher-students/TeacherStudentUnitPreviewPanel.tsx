"use client";

import { useEffect, useMemo, useState } from "react";
import LiteTex from "@/components/LiteTex";
import type { TeacherStudentUnitPreview } from "@/lib/api/teacher";
import { getStudentTaskStatusLabel } from "@/lib/status-labels";
import styles from "./teacher-student-unit-preview-panel.module.css";

type Props = {
  unit: TeacherStudentUnitPreview;
  onOpenPhotoReview?: (taskId: string, unitId: string) => void;
};

export default function TeacherStudentUnitPreviewPanel({ unit, onOpenPhotoReview }: Props) {
  const orderedTasks = useMemo(() => {
    return [...unit.tasks].sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [unit.tasks]);

  const [activeTaskId, setActiveTaskId] = useState<string | null>(orderedTasks[0]?.id ?? null);

  useEffect(() => {
    if (!orderedTasks.length) {
      setActiveTaskId(null);
      return;
    }
    if (!activeTaskId || !orderedTasks.some((task) => task.id === activeTaskId)) {
      setActiveTaskId(orderedTasks[0].id);
    }
  }, [activeTaskId, orderedTasks]);

  const activeTask = orderedTasks.find((task) => task.id === activeTaskId) ?? orderedTasks[0];

  return (
    <div className={styles.panel}>
      <div className={styles.unitTitle}>{unit.title}</div>

      <div className={styles.tabs}>
        {orderedTasks.map((task, index) => (
          <button
            key={task.id}
            type="button"
            className={`${styles.tab} ${task.id === activeTask?.id ? styles.tabActive : ""}`}
            onClick={() => setActiveTaskId(task.id)}
          >
            {index + 1}
          </button>
        ))}
      </div>

      {activeTask ? (
        <article className={styles.taskCard}>
          <div className={styles.taskHeader}>
            <div className={styles.taskTitle}>Задача</div>
            <div className={styles.taskMeta}>
              <span className={styles.statusBadge}>
                {getStudentTaskStatusLabel(activeTask.state?.status ?? "not_started")}
              </span>
              {activeTask.state?.requiredSkipped ? (
                <span className={styles.requiredBadge}>Обязательная пропущена</span>
              ) : null}
            </div>
          </div>

          <div className={styles.statement}>
            <LiteTex value={activeTask.statementLite} block />
          </div>

          {activeTask.answerType === "numeric" ? (
            <div className={styles.answerList}>
              {(activeTask.numericPartsJson ?? []).map((part, index) => (
                <div key={part.key} className={styles.answerRow}>
                  <span className={styles.answerIndex}>{index + 1}.</span>
                  <span className={styles.answerLabel}>
                    <LiteTex value={part.labelLite ?? ""} />
                  </span>
                  <input
                    className={styles.answerInput}
                    value={part.correctValue ?? ""}
                    readOnly
                    disabled
                    placeholder="Ответ скрыт"
                  />
                </div>
              ))}
            </div>
          ) : null}

          {activeTask.answerType === "single_choice" || activeTask.answerType === "multi_choice" ? (
            <div className={styles.options}>
              {(activeTask.choicesJson ?? []).map((choice, index) => {
                const selected =
                  activeTask.answerType === "single_choice"
                    ? activeTask.correctAnswerJson?.key === choice.key
                    : (activeTask.correctAnswerJson?.keys ?? []).includes(choice.key);
                return (
                  <label key={choice.key} className={styles.optionRow}>
                    <input
                      type={activeTask.answerType === "single_choice" ? "radio" : "checkbox"}
                      checked={Boolean(selected)}
                      disabled
                      readOnly
                    />
                    <span className={styles.optionIndex}>{index + 1}.</span>
                    <span className={styles.optionText}>
                      <LiteTex value={choice.textLite} />
                    </span>
                  </label>
                );
              })}
            </div>
          ) : null}

          {activeTask.answerType === "photo" ? (
            <section className={styles.photoStatusBlock}>
              <div className={styles.photoStatusTitle}>Фото-задача</div>
              <div className={styles.photoStatusText}>
                Статус: {getStudentTaskStatusLabel(activeTask.state?.status ?? "not_started")}
              </div>
              <div className={styles.photoStatusHint}>
                До статуса «Принято» обязательная задача не закрывает юнит.
              </div>
              {onOpenPhotoReview ? (
                <button
                  type="button"
                  className={styles.photoStatusAction}
                  onClick={() => onOpenPhotoReview(activeTask.id, unit.id)}
                >
                  Открыть проверку
                </button>
              ) : null}
            </section>
          ) : null}
        </article>
      ) : (
        <div className={styles.stub}>Задач нет.</div>
      )}
    </div>
  );
}
