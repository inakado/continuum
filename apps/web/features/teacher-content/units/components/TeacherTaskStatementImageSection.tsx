import type { ChangeEvent, RefObject } from "react";
import Image from "next/image";
import Button from "@/components/ui/Button";
import type { Task } from "@/lib/api/teacher";
import type { TaskStatementImageState } from "../hooks/use-teacher-task-statement-image";
import styles from "../teacher-unit-detail.module.css";

type Props = {
  editingTask: Task | null;
  inputRef: RefObject<HTMLInputElement | null>;
  state: TaskStatementImageState;
  statusText: string;
  onSelect: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onRemove: () => Promise<void>;
  onPreviewError: () => void;
};

export function TeacherTaskStatementImageSection({
  editingTask,
  inputRef,
  state,
  statusText,
  onSelect,
  onRemove,
  onPreviewError,
}: Props) {
  return (
    <div className={styles.taskStatementImageSection}>
      <div className={styles.taskStatementImageHeader}>
        <div className={styles.taskStatementImageTitle}>Изображение условия</div>
        {editingTask ? (
          <div className={styles.taskStatementImageActions}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => inputRef.current?.click()}
              disabled={state.loading}
            >
              {state.key ? "Заменить" : "Добавить изображение"}
            </Button>
            {state.key ? (
              <Button
                type="button"
                variant="danger"
                onClick={() => void onRemove()}
                disabled={state.loading}
              >
                Удалить
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {editingTask ? (
        <>
          <input
            ref={inputRef}
            className={styles.taskStatementImageInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              void onSelect(event);
            }}
          />
          <div className={styles.taskStatementImageStatus} role="status" aria-live="polite">
            {statusText}
          </div>
          {state.updatedAt ? (
            <div className={styles.taskStatementImageMeta}>
              Обновлено: {new Date(state.updatedAt).toLocaleString("ru-RU")}
            </div>
          ) : null}
          <div className={styles.taskStatementImageViewport}>
            {state.previewUrl ? (
              <Image
                src={state.previewUrl}
                alt="Изображение условия задачи"
                className={styles.taskStatementImagePreview}
                width={1200}
                height={900}
                unoptimized
                onError={onPreviewError}
              />
            ) : (
              <div className={styles.previewStub}>Изображение условия появится здесь после загрузки.</div>
            )}
          </div>
        </>
      ) : (
        <div className={styles.taskSolutionStub}>Сначала создайте задачу, затем прикрепите изображение условия.</div>
      )}
    </div>
  );
}
