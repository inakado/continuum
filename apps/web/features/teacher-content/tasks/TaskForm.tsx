"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import EntityEditorInline from "@/components/EntityEditorInline";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Checkbox from "@/components/ui/Checkbox";
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
  afterStatementSection?: ReactNode;
  extraSection?: ReactNode;
};

type BaseSettingsSectionProps = {
  answerType: AnswerType;
  isRequired: boolean;
  onAnswerTypeChange: (type: AnswerType) => void;
  onRequiredChange: (next: boolean) => void;
};

type StatementSectionProps = {
  statementLite: string;
  onStatementChange: (value: string) => void;
  statementError?: string;
};

type NumericAnswerFieldsProps = {
  numericParts: NumericPart[];
  error?: string;
  onAddPart: () => void;
  onUpdatePartLabel: (index: number, value: string) => void;
  onUpdatePartCorrectValue: (index: number, value: string) => void;
  onRemovePart: (index: number) => void;
};

type ChoiceAnswerFieldsProps = {
  answerType: "single_choice" | "multi_choice";
  choices: Choice[];
  correctSingleIndex: number | null;
  correctMultiIndices: number[];
  errors: {
    choices?: string;
    correctAnswer?: string;
  };
  onAddChoice: () => void;
  onUpdateChoiceText: (index: number, value: string) => void;
  onToggleCorrectChoice: (index: number) => void;
  onRemoveChoice: (index: number) => void;
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

const validateTaskForm = (
  next: TaskFormData,
  correctSingleKey: string,
  correctMultiKeys: string[],
) => {
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

function BaseSettingsSection({
  answerType,
  isRequired,
  onAnswerTypeChange,
  onRequiredChange,
}: BaseSettingsSectionProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>Основное</div>
      </div>
      <div className={styles.fieldGrid}>
        <label className={styles.label}>
          Тип задачи
          <select
            className={styles.select}
            value={answerType}
            onChange={(event) => onAnswerTypeChange(event.target.value as AnswerType)}
          >
            <option value="numeric">Числовая</option>
            <option value="single_choice">Один вариант</option>
            <option value="multi_choice">Несколько вариантов</option>
            <option value="photo">Фото-ответ</option>
          </select>
        </label>
        <Checkbox
          label="Обязательная"
          checked={isRequired}
          onChange={(event) => onRequiredChange(event.target.checked)}
          className={styles.checkboxField}
        />
      </div>
    </div>
  );
}

function StatementSection({ statementLite, onStatementChange, statementError }: StatementSectionProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Условие</div>
      <div className={styles.dualGrid}>
        <label className={styles.label}>
          Текст условия (KaTeX)
          <Textarea
            value={statementLite}
            className={styles.textarea}
            onChange={(event) => onStatementChange(event.target.value)}
          />
        </label>
        <div className={styles.previewBlock}>
          <div className={styles.previewLabel}>Предпросмотр</div>
          <div className={styles.preview}>
            <LiteTex value={statementLite} block />
          </div>
        </div>
      </div>
      {statementError ? <div className={styles.fieldError}>{statementError}</div> : null}
    </div>
  );
}

function NumericAnswerFields({
  numericParts,
  error,
  onAddPart,
  onUpdatePartLabel,
  onUpdatePartCorrectValue,
  onRemovePart,
}: NumericAnswerFieldsProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>Части числового ответа</div>
        <button
          type="button"
          className={styles.addIconButton}
          aria-label="Добавить часть"
          title="Добавить часть"
          onClick={onAddPart}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
      {error ? <div className={styles.fieldError}>{error}</div> : null}
      <div className={styles.partList}>
        {numericParts.map((part, index) => (
          <div key={`part-${index}`} className={styles.partRow}>
            <div className={styles.partIndex}>Ответ {index + 1}</div>
            <label className={styles.label}>
              Подпись (KaTeX)
              <Input value={part.labelLite} onChange={(event) => onUpdatePartLabel(index, event.target.value)} />
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
                onChange={(event) => onUpdatePartCorrectValue(index, event.target.value)}
              />
            </label>
            <div className={styles.rowActions}>
              <button
                type="button"
                className={styles.rowIconButton}
                aria-label={`Удалить часть ${index + 1}`}
                title="Удалить часть"
                onClick={() => onRemovePart(index)}
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChoiceAnswerFields({
  answerType,
  choices,
  correctSingleIndex,
  correctMultiIndices,
  errors,
  onAddChoice,
  onUpdateChoiceText,
  onToggleCorrectChoice,
  onRemoveChoice,
}: ChoiceAnswerFieldsProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>Варианты ответа</div>
        <button
          type="button"
          className={styles.addIconButton}
          aria-label="Добавить вариант"
          title="Добавить вариант"
          onClick={onAddChoice}
        >
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
      {errors.choices ? <div className={styles.fieldError}>{errors.choices}</div> : null}
      <div className={styles.choiceList}>
        {choices.map((choice, index) => {
          const isCorrect =
            answerType === "single_choice"
              ? correctSingleIndex === index
              : correctMultiIndices.includes(index);
          return (
            <div key={`choice-${index}`} className={styles.choiceRow}>
              <div className={styles.choiceMain}>
                <div className={styles.choiceIndex}>Вариант {index + 1}</div>
                <label className={styles.label}>
                  Текст (KaTeX)
                  <Input value={choice.textLite} onChange={(event) => onUpdateChoiceText(index, event.target.value)} />
                </label>
                <div className={styles.inlinePreview}>
                  <div className={styles.inlinePreviewLabel}>Предпросмотр</div>
                  <div className={styles.inlinePreviewBox}>
                    {choice.textLite.trim() ? <LiteTex value={choice.textLite} /> : null}
                  </div>
                </div>
                <label className={styles.correctMark}>
                  <input
                    type={answerType === "single_choice" ? "radio" : "checkbox"}
                    checked={isCorrect}
                    onChange={() => onToggleCorrectChoice(index)}
                  />
                  Правильный
                </label>
                <div className={styles.rowActions}>
                  <button
                    type="button"
                    className={styles.rowIconButton}
                    aria-label={`Удалить вариант ${index + 1}`}
                    title="Удалить вариант"
                    onClick={() => onRemoveChoice(index)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {errors.correctAnswer ? <div className={styles.fieldError}>{errors.correctAnswer}</div> : null}
    </div>
  );
}

function PhotoAnswerFields() {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Фото-ответ</div>
      <div className={styles.stub}>Загрузка фото будет добавлена в следующем слайсе.</div>
    </div>
  );
}

export default function TaskForm({
  title,
  submitLabel,
  initial,
  onSubmit,
  onCancel,
  rightAction,
  error,
  afterStatementSection,
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
    const numericParts = initial?.numericParts?.length ? initial.numericParts : defaultState.numericParts;
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

  const handleTypeChange = (nextType: AnswerType) => {
    if (nextType === form.answerType) return;
    setForm((prev) => ({
      ...prev,
      answerType: nextType,
      numericParts: nextType === "numeric" ? [{ ...defaultNumericPart(), key: "" }] : [],
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

  const validationErrors = useMemo(
    () => validateTaskForm(nextForm, correctSingleKey, correctMultiKeys),
    [nextForm, correctMultiKeys, correctSingleKey],
  );
  const canSubmit = Object.keys(validationErrors).length === 0;

  const addNumericPart = () => {
    setForm((prev) => ({
      ...prev,
      numericParts: [...prev.numericParts, { ...defaultNumericPart(), key: "" }],
    }));
  };

  const updateNumericPartLabel = (index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      numericParts: prev.numericParts.map((part, partIndex) =>
        partIndex === index ? { ...part, labelLite: value } : part,
      ),
    }));
  };

  const updateNumericPartCorrectValue = (index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      numericParts: prev.numericParts.map((part, partIndex) =>
        partIndex === index ? { ...part, correctValue: value } : part,
      ),
    }));
  };

  const removeNumericPart = (index: number) => {
    setForm((prev) => ({
      ...prev,
      numericParts: prev.numericParts.filter((_, partIndex) => partIndex !== index),
    }));
  };

  const addChoice = () => {
    setForm((prev) => ({
      ...prev,
      choices: [...prev.choices, { ...defaultChoice(), key: "" }],
    }));
  };

  const updateChoiceText = (index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      choices: prev.choices.map((choice, choiceIndex) =>
        choiceIndex === index ? { ...choice, textLite: value } : choice,
      ),
    }));
  };

  const toggleCorrectChoice = (index: number) => {
    if (form.answerType === "single_choice") {
      setCorrectSingleIndex(index);
      return;
    }
    setCorrectMultiIndices((prev) =>
      prev.includes(index) ? prev.filter((value) => value !== index) : [...prev, index],
    );
  };

  const removeChoiceAt = (index: number) => {
    setForm((prev) => ({
      ...prev,
      choices: prev.choices.filter((_, choiceIndex) => choiceIndex !== index),
    }));
    setCorrectSingleIndex((prev) => {
      if (prev === null) return null;
      if (prev === index) return null;
      return prev > index ? prev - 1 : prev;
    });
    setCorrectMultiIndices((prev) =>
      prev.filter((value) => value !== index).map((value) => (value > index ? value - 1 : value)),
    );
  };

  const answerFieldsByType: Record<AnswerType, ReactNode> = {
    numeric: (
      <NumericAnswerFields
        numericParts={form.numericParts}
        error={fieldErrors.numericParts}
        onAddPart={addNumericPart}
        onUpdatePartLabel={updateNumericPartLabel}
        onUpdatePartCorrectValue={updateNumericPartCorrectValue}
        onRemovePart={removeNumericPart}
      />
    ),
    single_choice: (
      <ChoiceAnswerFields
        answerType="single_choice"
        choices={form.choices}
        correctSingleIndex={correctSingleIndex}
        correctMultiIndices={correctMultiIndices}
        errors={{ choices: fieldErrors.choices, correctAnswer: fieldErrors.correctAnswer }}
        onAddChoice={addChoice}
        onUpdateChoiceText={updateChoiceText}
        onToggleCorrectChoice={toggleCorrectChoice}
        onRemoveChoice={removeChoiceAt}
      />
    ),
    multi_choice: (
      <ChoiceAnswerFields
        answerType="multi_choice"
        choices={form.choices}
        correctSingleIndex={correctSingleIndex}
        correctMultiIndices={correctMultiIndices}
        errors={{ choices: fieldErrors.choices, correctAnswer: fieldErrors.correctAnswer }}
        onAddChoice={addChoice}
        onUpdateChoiceText={updateChoiceText}
        onToggleCorrectChoice={toggleCorrectChoice}
        onRemoveChoice={removeChoiceAt}
      />
    ),
    photo: <PhotoAnswerFields />,
  };

  const handleSubmit = async () => {
    const errors = validationErrors;
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    await onSubmit(nextForm);
  };

  return (
    <EntityEditorInline
      title={title}
      titleClassName={styles.formTitle}
      submitLabel={submitLabel}
      onSubmit={handleSubmit}
      secondaryAction={onCancel ? { label: "Отменить", onClick: onCancel } : undefined}
      rightAction={rightAction}
      error={error}
      disabled={!canSubmit}
    >
      <BaseSettingsSection
        answerType={form.answerType}
        isRequired={form.isRequired}
        onAnswerTypeChange={handleTypeChange}
        onRequiredChange={(next) => setForm((prev) => ({ ...prev, isRequired: next }))}
      />

      <StatementSection
        statementLite={form.statementLite}
        onStatementChange={(value) => setForm((prev) => ({ ...prev, statementLite: value }))}
        statementError={fieldErrors.statementLite}
      />

      {afterStatementSection}

      {answerFieldsByType[form.answerType]}

      {extraSection}
    </EntityEditorInline>
  );
}
