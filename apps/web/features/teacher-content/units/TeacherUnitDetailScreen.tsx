"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import TeacherShell from "@/components/TeacherShell";
import EntityList, { EntityListItem } from "@/components/EntityList";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import EntityEditorInline from "@/components/EntityEditorInline";
import { teacherApi, UnitWithTasks, Task } from "@/lib/api/teacher";
import { getApiErrorMessage } from "../shared/api-errors";
import AuthRequired from "../auth/AuthRequired";
import { useTeacherLogout } from "../auth/use-teacher-logout";
import TaskForm, { TaskFormData } from "../tasks/TaskForm";
import styles from "./teacher-unit-detail.module.css";

type Props = {
  unitId: string;
};

export default function TeacherUnitDetailScreen({ unitId }: Props) {
  const handleLogout = useTeacherLogout();
  const [unit, setUnit] = useState<UnitWithTasks | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [editing, setEditing] = useState<UnitWithTasks | null>(null);
  const [unitTitle, setUnitTitle] = useState("");
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const fetchUnit = useCallback(async () => {
    if (authRequired) return;
    setError(null);
    try {
      const data = await teacherApi.getUnit(unitId);
      setUnit(data);
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setError(message);
    }
  }, [authRequired, unitId]);

  useEffect(() => {
    fetchUnit();
  }, [fetchUnit]);

  const handleUnitUpdate = async () => {
    if (authRequired || !editing) return;
    setFormError(null);
    try {
      await teacherApi.updateUnit(editing.id, { title: unitTitle, sortOrder: editing.sortOrder });
      setEditing(null);
      fetchUnit();
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setFormError(message);
    }
  };

  const handlePublishToggle = async () => {
    if (authRequired || !unit) return;
    setError(null);
    try {
      if (unit.status === "published") {
        await teacherApi.unpublishUnit(unit.id);
      } else {
        await teacherApi.publishUnit(unit.id);
      }
      fetchUnit();
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setError(message);
    }
  };

  const handleTaskSubmit = async (data: TaskFormData) => {
    if (authRequired || !unit) return;
    setFormError(null);
    try {
      await teacherApi.createTask({
        unitId: unit.id,
        title: data.title || null,
        statementLite: data.statementLite,
        answerType: data.answerType,
        isRequired: data.isRequired,
        sortOrder: data.sortOrder,
      });
      fetchUnit();
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setFormError(message);
    }
  };

  const handleTaskUpdate = async (data: TaskFormData) => {
    if (authRequired || !editingTask) return;
    setFormError(null);
    try {
      await teacherApi.updateTask(editingTask.id, {
        title: data.title || null,
        statementLite: data.statementLite,
        answerType: data.answerType,
        isRequired: data.isRequired,
        sortOrder: data.sortOrder,
      });
      setEditingTask(null);
      fetchUnit();
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setFormError(message);
    }
  };

  const handleTaskPublishToggle = async (task: Task) => {
    if (authRequired) return;
    setError(null);
    try {
      if (task.status === "published") {
        await teacherApi.unpublishTask(task.id);
      } else {
        await teacherApi.publishTask(task.id);
      }
      fetchUnit();
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setError(message);
    }
  };

  const handleTaskDelete = async (task: Task) => {
    if (authRequired) return;
    const confirmed = window.confirm("Удалить задачу? Действие нельзя отменить.");
    if (!confirmed) return;
    setError(null);
    try {
      await teacherApi.deleteTask(task.id);
      fetchUnit();
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setError(message);
    }
  };

  const items: EntityListItem[] =
    unit?.tasks.map((task) => ({
      id: task.id,
      title: task.title ?? "Без названия",
      status: task.status,
      meta: `${task.answerType} · обязательная: ${task.isRequired ? "да" : "нет"}`,
      actions: (
        <>
          <Button variant="ghost" onClick={() => handleTaskPublishToggle(task)}>
            {task.status === "published" ? "В черновик" : "Опубликовать"}
          </Button>
          <Button variant="ghost" onClick={() => setEditingTask(task)}>
            Редактировать
          </Button>
          <Button variant="ghost" onClick={() => handleTaskDelete(task)}>
            Удалить
          </Button>
        </>
      ),
    })) ?? [];

  if (authRequired) {
    return (
      <TeacherShell title="Юнит" onLogout={handleLogout}>
        <AuthRequired />
      </TeacherShell>
    );
  }

  return (
    <TeacherShell
      title={unit?.title ?? "Юнит"}
      subtitle="Задачи и публикация"
      onLogout={handleLogout}
    >
      <div className={styles.topActions}>
        <Link href="/teacher/courses">← Все курсы</Link>
        {unit ? (
          <Button variant="ghost" onClick={handlePublishToggle}>
            {unit.status === "published" ? "Снять с публикации" : "Опубликовать"}
          </Button>
        ) : null}
        {unit ? (
          <Button
            variant="ghost"
            onClick={() => {
              setEditing(unit);
              setUnitTitle(unit.title);
            }}
          >
            Редактировать юнит
          </Button>
        ) : null}
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      {editing ? (
        <EntityEditorInline
          title="Редактировать юнит"
          submitLabel="Сохранить"
          onSubmit={handleUnitUpdate}
          error={formError}
          disabled={!unitTitle}
        >
          <label className={styles.label}>
            Название
            <Input value={unitTitle} onChange={(event) => setUnitTitle(event.target.value)} />
          </label>
        </EntityEditorInline>
      ) : null}

      <TaskForm title="Новая задача" submitLabel="Создать" onSubmit={handleTaskSubmit} error={formError} />

      {editingTask ? (
        <TaskForm
          title="Редактировать задачу"
          submitLabel="Сохранить"
          onSubmit={handleTaskUpdate}
          error={formError}
          initial={{
            title: editingTask.title ?? "",
            statementLite: editingTask.statementLite,
            answerType: editingTask.answerType,
            isRequired: editingTask.isRequired,
            sortOrder: editingTask.sortOrder,
          }}
        />
      ) : null}

      <EntityList title="Задачи" items={items} emptyLabel="Задач пока нет" />
    </TeacherShell>
  );
}
