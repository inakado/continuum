"use client";

import { useEffect, useState } from "react";
import EntityEditorInline from "@/components/EntityEditorInline";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Checkbox from "@/components/ui/Checkbox";
import styles from "./task-form.module.css";

export type TaskFormData = {
  title: string;
  statementLite: string;
  answerType: string;
  isRequired: boolean;
  sortOrder: number;
};

type TaskFormProps = {
  title: string;
  submitLabel: string;
  initial?: Partial<TaskFormData>;
  onSubmit: (data: TaskFormData) => Promise<void> | void;
  error?: string | null;
};

const defaultState: TaskFormData = {
  title: "",
  statementLite: "",
  answerType: "text",
  isRequired: false,
  sortOrder: 0,
};

export default function TaskForm({ title, submitLabel, initial, onSubmit, error }: TaskFormProps) {
  const [form, setForm] = useState<TaskFormData>(defaultState);

  useEffect(() => {
    setForm({ ...defaultState, ...initial });
  }, [initial]);

  return (
    <EntityEditorInline
      title={title}
      submitLabel={submitLabel}
      onSubmit={() => onSubmit(form)}
      error={error}
      disabled={!form.statementLite || !form.answerType}
    >
      <label className={styles.label}>
        Название (опционально)
        <Input
          value={form.title}
          onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
        />
      </label>
      <label className={styles.label}>
        Условие (кратко)
        <Textarea
          value={form.statementLite}
          onChange={(event) => setForm((prev) => ({ ...prev, statementLite: event.target.value }))}
        />
      </label>
      <label className={styles.label}>
        Тип ответа
        <Input
          value={form.answerType}
          onChange={(event) => setForm((prev) => ({ ...prev, answerType: event.target.value }))}
        />
      </label>
      <label className={styles.label}>
        Порядок
        <Input
          type="number"
          value={form.sortOrder}
          onChange={(event) =>
            setForm((prev) => ({ ...prev, sortOrder: Number(event.target.value || 0) }))
          }
        />
      </label>
      <Checkbox
        label="Обязательная"
        checked={form.isRequired}
        onChange={(event) => setForm((prev) => ({ ...prev, isRequired: event.target.checked }))}
      />
    </EntityEditorInline>
  );
}
