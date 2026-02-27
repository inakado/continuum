import {
  memo,
  type ChangeEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Pencil, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Input from "@/components/ui/Input";
import LiteTex from "@/components/LiteTex";
import TaskForm, { type TaskFormData } from "../../tasks/TaskForm";
import type { Task } from "@/lib/api/teacher";
import { getContentStatusLabel } from "@/lib/status-labels";
import type { ProgressSaveState } from "../hooks/use-teacher-unit-fetch-save";
import styles from "../teacher-unit-detail.module.css";

const answerTypeLabels: Record<TaskFormData["answerType"], string> = {
  numeric: "Числовая",
  single_choice: "Один вариант",
  multi_choice: "Несколько вариантов",
  photo: "Фото-ответ",
};

type SortableTaskCardProps = {
  task: Task;
  index: number;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
};

const SortableTaskCard = memo(function SortableTaskCard({
  task,
  index,
  onEdit,
  onDelete,
}: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.taskCard} ${isDragging ? styles.taskCardDragging : ""}`}
      {...attributes}
      {...listeners}
    >
      <div className={styles.taskHeader}>
        <div className={styles.taskTitleRow}>
          <div className={styles.taskNumber}>Задача №{index + 1}</div>
          {task.isRequired ? <span className={styles.requiredBadge}>Обязательная</span> : null}
        </div>
        <div className={styles.taskMeta}>
          {answerTypeLabels[task.answerType]} • {getContentStatusLabel(task.status)}
        </div>
      </div>
      <div className={styles.taskStatement}>
        <LiteTex value={task.statementLite} block />
      </div>
      <div className={styles.taskActions}>
        <button type="button" className={styles.taskEditAction} onClick={() => onEdit(task)}>
          <Pencil size={16} aria-hidden="true" />
          <span>Редактировать</span>
        </button>
        <button
          type="button"
          className={styles.taskDeleteAction}
          onClick={() => onDelete(task)}
          aria-label={`Удалить задачу №${index + 1}`}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
});

type Props = {
  requiredTasksCount: number;
  hasSavedOptionalMin: boolean;
  isOptionalMinEditing: boolean;
  optionalMinInputRef: RefObject<HTMLInputElement | null>;
  minCountedInput: string;
  onMinCountedInputChange: (value: string) => void;
  savedOptionalMin: number;
  totalToComplete: number;
  progressSaveState: ProgressSaveState;
  progressStatusText: string;
  onStartOptionalEdit: () => void;
  onFinishOptionalEdit: () => void;
  onCancelOptionalEdit: () => void;
  onSaveOptionalMin: () => Promise<boolean>;

  creatingTask: boolean;
  editingTask: Task | null;
  creatingTaskPublish: boolean;
  onCreatingTaskPublishChange: (checked: boolean) => void;
  onStartCreateTask: () => void;
  onCancelTaskForm: () => void;
  formError: string | null;

  taskOrderStatus: string | null;
  taskOrder: Task[];
  onReorderTasks: (nextOrder: Task[], prevOrder: Task[]) => void;
  onTaskEdit: (task: Task) => void;
  onTaskDelete: (task: Task) => void;

  editingTaskNumber: number | null;
  nextTaskOrder: number;
  taskFormInitial: Partial<TaskFormData>;
  onTaskSubmit: (data: TaskFormData) => Promise<void>;
  onTaskUpdate: (data: TaskFormData) => Promise<void>;
  onTaskPublishToggle: (task: Task) => Promise<void>;

  afterStatementSection: ReactNode;
  extraSection: ReactNode;
};

export function TeacherUnitTasksPanel({
  requiredTasksCount,
  hasSavedOptionalMin,
  isOptionalMinEditing,
  optionalMinInputRef,
  minCountedInput,
  onMinCountedInputChange,
  savedOptionalMin,
  totalToComplete,
  progressSaveState,
  progressStatusText,
  onStartOptionalEdit,
  onFinishOptionalEdit,
  onCancelOptionalEdit,
  onSaveOptionalMin,

  creatingTask,
  editingTask,
  creatingTaskPublish,
  onCreatingTaskPublishChange,
  onStartCreateTask,
  onCancelTaskForm,
  formError,

  taskOrderStatus,
  taskOrder,
  onReorderTasks,
  onTaskEdit,
  onTaskDelete,

  editingTaskNumber,
  nextTaskOrder,
  taskFormInitial,
  onTaskSubmit,
  onTaskUpdate,
  onTaskPublishToggle,

  afterStatementSection,
  extraSection,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  return (
    <div className={styles.tasksPanel}>
      <div className={styles.progressCard}>
        <div className={styles.progressHeader}>
          <div>
            <div className={styles.progressTitle}>Порог выполнения</div>
          </div>
        </div>

        <div className={styles.progressSummary}>
          <div className={styles.progressMetric}>
            <span className={styles.progressMetricLabel}>Обязательные</span>
            <div className={styles.metricValueBox}>
              <strong className={styles.progressMetricValue}>{requiredTasksCount}</strong>
            </div>
          </div>

          <div className={`${styles.progressMetric} ${styles.progressMetricOptional}`}>
            <span className={styles.progressMetricLabel}>Необязательные</span>
            {isOptionalMinEditing || !hasSavedOptionalMin ? (
              <div className={styles.inlineOptionalEditor}>
                <Input
                  ref={optionalMinInputRef}
                  className={styles.optionalInput}
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={minCountedInput}
                  onChange={(event) => {
                    onMinCountedInputChange(event.target.value);
                  }}
                  onKeyDown={async (event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      const saved = await onSaveOptionalMin();
                      if (saved) onFinishOptionalEdit();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      onCancelOptionalEdit();
                    }
                  }}
                />
                <Button
                  onClick={async () => {
                    const saved = await onSaveOptionalMin();
                    if (saved) onFinishOptionalEdit();
                  }}
                  disabled={progressSaveState.state === "saving"}
                >
                  Сохранить
                </Button>
              </div>
            ) : (
              <button
                type="button"
                className={styles.optionalValueButton}
                title="Нажмите, чтобы изменить"
                onClick={onStartOptionalEdit}
              >
                <strong className={styles.progressMetricValue}>{savedOptionalMin}</strong>
              </button>
            )}
          </div>

          <div className={styles.progressMetric}>
            <span className={styles.progressMetricLabel}>Итог</span>
            <div className={styles.metricValueBox}>
              <strong className={styles.progressMetricValue}>{totalToComplete}</strong>
            </div>
          </div>
        </div>

        {progressSaveState.state === "error" && progressStatusText ? (
          <div className={styles.progressError} role="status" aria-live="polite">
            {progressStatusText}
          </div>
        ) : null}
      </div>

      {!creatingTask && !editingTask ? (
        <div className={styles.tasksHeader}>
          <Button onClick={onStartCreateTask}>Создать задачу</Button>
        </div>
      ) : null}

      {!creatingTask && !editingTask ? (
        <>
          {taskOrderStatus ? <div className={styles.hint}>{taskOrderStatus}</div> : null}
          {taskOrder.length ? (
            <div className={styles.taskList}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(event: DragEndEvent) => {
                  const { active, over } = event;
                  if (!over || active.id === over.id) return;

                  const previousOrder = taskOrder;
                  const oldIndex = taskOrder.findIndex((task) => task.id === active.id);
                  const newIndex = taskOrder.findIndex((task) => task.id === over.id);
                  if (oldIndex < 0 || newIndex < 0) return;

                  const nextOrder = arrayMove(taskOrder, oldIndex, newIndex).map((task, index) => ({
                    ...task,
                    sortOrder: index + 1,
                  }));
                  onReorderTasks(nextOrder, previousOrder);
                }}
              >
                <SortableContext
                  items={taskOrder.map((task) => task.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {taskOrder.map((task, index) => (
                    <SortableTaskCard
                      key={task.id}
                      task={task}
                      index={index}
                      onEdit={onTaskEdit}
                      onDelete={onTaskDelete}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          ) : (
            <div className={styles.previewStub}>Задач пока нет.</div>
          )}
        </>
      ) : null}

      {editingTask || creatingTask ? (
        <TaskForm
          title={editingTaskNumber ? `Задача №${editingTaskNumber}` : `Задача №${nextTaskOrder}`}
          submitLabel={editingTask ? "Сохранить" : "Создать"}
          onSubmit={editingTask ? onTaskUpdate : onTaskSubmit}
          error={formError}
          onCancel={onCancelTaskForm}
          rightAction={
            editingTask ? (
              <Checkbox
                label="Опубликовано"
                checked={editingTask.status === "published"}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const nextChecked = event.target.checked;
                  const isPublished = editingTask.status === "published";
                  if (nextChecked === isPublished) return;
                  void onTaskPublishToggle(editingTask);
                }}
              />
            ) : creatingTask ? (
              <Checkbox
                label="Опубликовать"
                checked={creatingTaskPublish}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  onCreatingTaskPublishChange(event.target.checked)
                }
              />
            ) : null
          }
          initial={taskFormInitial}
          afterStatementSection={afterStatementSection}
          extraSection={extraSection}
        />
      ) : null}
    </div>
  );
}
