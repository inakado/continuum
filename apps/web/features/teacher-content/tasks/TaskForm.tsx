"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import EntityEditorInline from "@/components/EntityEditorInline";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Checkbox from "@/components/ui/Checkbox";
import Button from "@/components/ui/Button";
import LiteTex from "@/components/LiteTex";
import { Plus, Trash2 } from "lucide-react";
import styles from "./task-form.module.css";

export type AnswerType = "numeric" | "single_choice" | "multi_choice" | "photo";

export type NumericPart = {
  key: string;
  labelLite: string;
  correctValue: string;
};

export type Choice = {
  key: string;
  textLite: string;
};

export type CorrectAnswer = { key?: string; keys?: string[] } | null;

export type TaskFormData = {
  statementLite: string;
  answerType: AnswerType;
  numericParts: NumericPart[];
  choices: Choice[];
  correctAnswer: CorrectAnswer;
  isRequired: boolean;
  sortOrder: number;
};

type TaskFormProps = {
  title: string;
  submitLabel: string;
  initial?: Partial<TaskFormData>;
  onSubmit: (data: TaskFormData) => Promise<void> | void;
  onCancel?: () => void;
  rightAction?: ReactNode;
  error?: string | null;
  extraSection?: ReactNode;
};

const defaultNumericPart = (): NumericPart => ({
  key: "",
  labelLite: "",
  correctValue: "",
});

const defaultChoice = (): Choice => ({
  key: "",
  textLite: "",
});

const defaultState: TaskFormData = {
  statementLite: "",
  answerType: "numeric",
  numericParts: [{ ...defaultNumericPart(), key: "" }],
  choices: [{ ...defaultChoice(), key: "" }, { ...defaultChoice(), key: "" }],
  correctAnswer: null,
  isRequired: false,
  sortOrder: 1,
};

const buildCorrectAnswer = (answerType: AnswerType, key: string, keys: string[]): CorrectAnswer => {
  if (answerType === "single_choice") {
    return key ? { key } : null;
  }
  if (answerType === "multi_choice") {
    return keys.length > 0 ? { keys } : null;
  }
  return null;
};

export default function TaskForm({
  title,
  submitLabel,
  initial,
  onSubmit,
  onCancel,
  rightAction,
  error,
  extraSection,
}: TaskFormProps) {
  const [form, setForm] = useState<TaskFormData>(defaultState);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [correctSingleIndex, setCorrectSingleIndex] = useState<number | null>(null);
  const [correctMultiIndices, setCorrectMultiIndices] = useState<number[]>([]);

  const correctSingleKey = useMemo(() => {
    if (correctSingleIndex === null) return "";
    return String(correctSingleIndex + 1);
  }, [correctSingleIndex]);

  const correctMultiKeys = useMemo(() => {
    if (!correctMultiIndices.length) return [];
    return correctMultiIndices.map((index) => String(index + 1));
  }, [correctMultiIndices]);

  useEffect(() => {
    const numericParts =
      initial?.numericParts?.length ? initial.numericParts : defaultState.numericParts;
    const choices = initial?.choices?.length ? initial.choices : defaultState.choices;

    setForm({
      ...defaultState,
      ...initial,
      numericParts,
      choices,
      correctAnswer: initial?.correctAnswer ?? null,
    });

    if (initial?.correctAnswer && choices.length) {
      if ("key" in initial.correctAnswer && initial.correctAnswer.key) {
        const index = choices.findIndex((choice) => choice.key === initial.correctAnswer?.key);
        setCorrectSingleIndex(index >= 0 ? index : null);
      } else if ("keys" in initial.correctAnswer && initial.correctAnswer.keys?.length) {
        const indices = initial.correctAnswer.keys
          .map((key) => choices.findIndex((choice) => choice.key === key))
          .filter((index) => index >= 0);
        setCorrectMultiIndices(indices);
      } else {
        setCorrectSingleIndex(null);
        setCorrectMultiIndices([]);
      }
    } else {
      setCorrectSingleIndex(null);
      setCorrectMultiIndices([]);
    }
    setFieldErrors({});
  }, [initial]);

  const validate = (next: TaskFormData) => {
    const errors: Record<string, string> = {};
    if (!next.statementLite.trim()) errors.statementLite = "Укажите условие";

    if (next.answerType === "numeric") {
      if (next.numericParts.length === 0) errors.numericParts = "Добавьте хотя бы одну часть";
      next.numericParts.forEach((part) => {
        if (!part.correctValue.trim()) errors.numericParts = "Укажите correct value для всех частей";
      });
    }

    if (next.answerType === "single_choice" || next.answerType === "multi_choice") {
      if (next.choices.length < 2) errors.choices = "Добавьте минимум 2 варианта";
      next.choices.forEach((choice, index) => {
        if (!choice.textLite.trim()) errors.choices = "Укажите текст для каждого варианта";
        if (!choice.textLite.trim() && !errors[`choice-${index}`]) {
          errors[`choice-${index}`] = "Текст обязателен";
        }
      });

      if (next.answerType === "single_choice" && !correctSingleKey.trim()) {
        errors.correctAnswer = "Выберите один правильный вариант";
      }
      if (next.answerType === "multi_choice" && correctMultiKeys.length === 0) {
        errors.correctAnswer = "Выберите хотя бы один правильный вариант";
      }
    }

    return errors;
  };

  const handleTypeChange = (nextType: AnswerType) => {
    if (nextType === form.answerType) return;
    setForm((prev) => ({
      ...prev,
      answerType: nextType,
      numericParts:
        nextType === "numeric"
          ? [{ ...defaultNumericPart(), key: "" }]
          : [],
      choices:
        nextType === "single_choice" || nextType === "multi_choice"
          ? [{ ...defaultChoice(), key: "" }, { ...defaultChoice(), key: "" }]
          : [],
      correctAnswer: null,
    }));
    setCorrectSingleIndex(null);
    setCorrectMultiIndices([]);
  };

  const correctedNumericParts = form.numericParts.map((part) => ({
    ...part,
    key: "",
  }));
  const correctedChoices = form.choices.map((choice) => ({
    ...choice,
    key: "",
  }));
  const correctAnswer = buildCorrectAnswer(form.answerType, correctSingleKey, correctMultiKeys);
  const nextForm = {
    ...form,
    numericParts: correctedNumericParts,
    choices: correctedChoices,
    correctAnswer,
  };

  const removeChoiceAt = (index: number) => {
    setForm((prev) => ({
      ...prev,
      choices: prev.choices.filter((_, i) => i !== index),
    }));
    setCorrectSingleIndex((prev) => {
      if (prev === null) return null;
      if (prev === index) return null;
      return prev > index ? prev - 1 : prev;
    });
    setCorrectMultiIndices((prev) =>
      prev
        .filter((value) => value !== index)
        .map((value) => (value > index ? value - 1 : value)),
    );
  };
  const validationErrors = useMemo(
    () => validate(nextForm),
    [nextForm, correctMultiKeys, correctSingleKey],
  );
  const canSubmit = Object.keys(validationErrors).length === 0;

  const handleSubmit = async () => {
    const errors = validationErrors;
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    await onSubmit(nextForm);
  };

  return (
    <EntityEditorInline
      title={title}
      submitLabel={submitLabel}
      onSubmit={handleSubmit}
      secondaryAction={onCancel ? { label: "Отменить", onClick: onCancel } : undefined}
      rightAction={rightAction}
      error={error}
      disabled={!canSubmit}
    >
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>Основное</div>
        </div>
        <div className={styles.fieldGrid}>
          <label className={styles.label}>
            Тип задачи
            <select
              className={styles.select}
              value={form.answerType}
              onChange={(event) => handleTypeChange(event.target.value as AnswerType)}
            >
              <option value="numeric">Числовая</option>
              <option value="single_choice">Один вариант</option>
              <option value="multi_choice">Несколько вариантов</option>
              <option value="photo">Фото-ответ</option>
            </select>
          </label>
          <Checkbox
            label="Обязательная"
            checked={form.isRequired}
            onChange={(event) => setForm((prev) => ({ ...prev, isRequired: event.target.checked }))}
            className={styles.checkboxField}
          />
        </div>
        {null}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Условие</div>
        <div className={styles.dualGrid}>
          <label className={styles.label}>
            Текст условия (KaTeX)
            <Textarea
              value={form.statementLite}
              className={styles.textarea}
              onChange={(event) => setForm((prev) => ({ ...prev, statementLite: event.target.value }))}
            />
          </label>
          <div className={styles.previewBlock}>
            <div className={styles.previewLabel}>Предпросмотр</div>
            <div className={styles.preview}>
              <LiteTex value={form.statementLite} block />
            </div>
          </div>
        </div>
        {fieldErrors.statementLite ? (
          <div className={styles.fieldError}>{fieldErrors.statementLite}</div>
        ) : null}
      </div>

      {form.answerType === "numeric" ? (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Части числового ответа</div>
            <button
              type="button"
              className={styles.addIconButton}
              aria-label="Добавить часть"
              title="Добавить часть"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  numericParts: [
                    ...prev.numericParts,
                    { ...defaultNumericPart(), key: "" },
                  ],
                }))
              }
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>
          {fieldErrors.numericParts ? (
            <div className={styles.fieldError}>{fieldErrors.numericParts}</div>
          ) : null}
          <div className={styles.partList}>
            {form.numericParts.map((part, index) => (
              <div key={`part-${index}`} className={styles.partRow}>
                <div className={styles.partIndex}>Ответ {index + 1}</div>
                <label className={styles.label}>
                  Подпись (KaTeX)
                  <Input
                    value={part.labelLite}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        numericParts: prev.numericParts.map((p, i) =>
                          i === index ? { ...p, labelLite: event.target.value } : p,
                        ),
                      }))
                    }
                  />
                </label>
                <div className={styles.inlinePreview}>
                  <div className={styles.inlinePreviewLabel}>Предпросмотр</div>
                  <div className={styles.inlinePreviewBox}>
                    {part.labelLite.trim() ? <LiteTex value={part.labelLite} /> : null}
                  </div>
                </div>
                <label className={styles.label}>
                  Правильный ответ
                  <Input
                    value={part.correctValue}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        numericParts: prev.numericParts.map((p, i) =>
                          i === index ? { ...p, correctValue: event.target.value } : p,
                        ),
                      }))
                    }
                  />
                </label>
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.rowIconButton}
                    aria-label={`Удалить часть ${index + 1}`}
                    title="Удалить часть"
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        numericParts: prev.numericParts.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {form.answerType === "single_choice" || form.answerType === "multi_choice" ? (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Варианты ответа</div>
            <button
              type="button"
              className={styles.addIconButton}
              aria-label="Добавить вариант"
              title="Добавить вариант"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  choices: [
                    ...prev.choices,
                    { ...defaultChoice(), key: "" },
                  ],
                }))
              }
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>
          {fieldErrors.choices ? <div className={styles.fieldError}>{fieldErrors.choices}</div> : null}
          <div className={styles.choiceList}>
            {form.choices.map((choice, index) => {
              const isCorrect =
                form.answerType === "single_choice"
                  ? correctSingleIndex === index
                  : correctMultiIndices.includes(index);
              return (
                <div key={`choice-${index}`} className={styles.choiceRow}>
                  <div className={styles.choiceMain}>
                    <div className={styles.choiceIndex}>Вариант {index + 1}</div>
                    <label className={styles.label}>
                      Текст (KaTeX)
                      <Input
                        value={choice.textLite}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            choices: prev.choices.map((c, i) =>
                              i === index ? { ...c, textLite: event.target.value } : c,
                            ),
                          }))
                        }
                      />
                    </label>
                    <div className={styles.inlinePreview}>
                      <div className={styles.inlinePreviewLabel}>Предпросмотр</div>
                      <div className={styles.inlinePreviewBox}>
                        {choice.textLite.trim() ? <LiteTex value={choice.textLite} /> : null}
                      </div>
                    </div>
                    <label className={styles.correctMark}>
                      <input
                        type={form.answerType === "single_choice" ? "radio" : "checkbox"}
                        checked={isCorrect}
                        onChange={() => {
                          if (form.answerType === "single_choice") {
                            setCorrectSingleIndex(index);
                          } else {
                            setCorrectMultiIndices((prev) =>
                              prev.includes(index)
                                ? prev.filter((value) => value !== index)
                                : [...prev, index],
                            );
                          }
                        }}
                      />
                      Правильный
                    </label>
                    <div className={styles.rowActions}>
                      <button
                        type="button"
                        className={styles.rowIconButton}
                        aria-label={`Удалить вариант ${index + 1}`}
                        title="Удалить вариант"
                        onClick={() => removeChoiceAt(index)}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {fieldErrors.correctAnswer ? (
            <div className={styles.fieldError}>{fieldErrors.correctAnswer}</div>
          ) : null}
        </div>
      ) : null}

      {form.answerType === "photo" ? (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Фото-ответ</div>
          <div className={styles.stub}>Загрузка фото будет добавлена в следующем слайсе.</div>
        </div>
      ) : null}

      {extraSection}
    </EntityEditorInline>
  );
}
