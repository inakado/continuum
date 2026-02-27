import type { Task } from "@/lib/api/student";
import LiteTex from "@/components/LiteTex";
import styles from "../student-unit-detail.module.css";

type Props = {
  task: Task;
  isTaskCredited: boolean;
  numericValues: Record<string, string>;
  attemptPerPartByKey: Map<string, boolean> | null;
  choiceItems: { key: string; textLite: string }[];
  singleAnswer: string;
  multiAnswers: string[];
  onNumericChange: (partKey: string, value: string) => void;
  onSingleChoiceChange: (choiceKey: string) => void;
  onMultiChoiceToggle: (choiceKey: string) => void;
};

export function StudentTaskAnswerForm({
  task,
  isTaskCredited,
  numericValues,
  attemptPerPartByKey,
  choiceItems,
  singleAnswer,
  multiAnswers,
  onNumericChange,
  onSingleChoiceChange,
  onMultiChoiceToggle,
}: Props) {
  return (
    <>
      {task.answerType === "numeric" ? (
        <div className={styles.answerList}>
          {(task.numericPartsJson ?? []).length === 0 ? (
            <div className={styles.stub}>Части ответа будут добавлены позже.</div>
          ) : (
            (task.numericPartsJson ?? []).map((part, idx) => (
              <div key={part.key} className={styles.answerRow}>
                <div className={styles.answerInline}>
                  <span className={styles.answerIndex}>{idx + 1}.</span>
                  <span className={styles.answerLabelText}>
                    <LiteTex value={part.labelLite ?? ""} />
                  </span>
                  <input
                    className={styles.answerInputInline}
                    value={numericValues[part.key] ?? ""}
                    disabled={isTaskCredited}
                    aria-label={`Ответ ${idx + 1}`}
                    onChange={(event) => onNumericChange(part.key, event.target.value)}
                    placeholder="Ответ"
                  />
                  {attemptPerPartByKey ? (
                    <span
                      className={`${styles.partResult} ${
                        attemptPerPartByKey.get(part.key) ? styles.partResultCorrect : styles.partResultIncorrect
                      }`}
                    >
                      {attemptPerPartByKey.get(part.key) ? "верно" : "ошибка"}
                    </span>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      ) : null}

      {task.answerType === "single_choice" || task.answerType === "multi_choice" ? (
        <div className={styles.optionList}>
          {(task.choicesJson ?? []).length === 0 ? (
            <div className={styles.stub}>Варианты ответа будут добавлены позже.</div>
          ) : (
            choiceItems.map((choice, idx) => {
              const isSingle = task.answerType === "single_choice";
              const selected = isSingle ? singleAnswer === choice.key : multiAnswers.includes(choice.key);
              return (
                <label key={choice.key} className={styles.optionItem}>
                  <input
                    className={styles.optionInput}
                    type={isSingle ? "radio" : "checkbox"}
                    name={`task-${task.id}`}
                    checked={selected}
                    disabled={isTaskCredited}
                    onChange={() => {
                      if (isSingle) {
                        onSingleChoiceChange(choice.key);
                      } else {
                        onMultiChoiceToggle(choice.key);
                      }
                    }}
                  />
                  <span className={styles.optionIndex}>{idx + 1}.</span>
                  <span className={styles.optionText}>
                    <LiteTex value={choice.textLite} />
                  </span>
                </label>
              );
            })
          )}
        </div>
      ) : null}
    </>
  );
}
