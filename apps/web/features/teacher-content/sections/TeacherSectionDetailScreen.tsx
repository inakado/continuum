"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import TeacherShell from "@/components/TeacherShell";
import EntityList, { EntityListItem } from "@/components/EntityList";
import EntityEditorInline from "@/components/EntityEditorInline";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { teacherApi, SectionWithUnits, Unit } from "@/lib/api/teacher";
import { getApiErrorMessage } from "../shared/api-errors";
import AuthRequired from "../auth/AuthRequired";
import { useTeacherLogout } from "../auth/use-teacher-logout";
import styles from "./teacher-section-detail.module.css";

type Props = {
  sectionId: string;
};

export default function TeacherSectionDetailScreen({ sectionId }: Props) {
  const handleLogout = useTeacherLogout();
  const [section, setSection] = useState<SectionWithUnits | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [unitTitle, setUnitTitle] = useState("");
  const [editing, setEditing] = useState<SectionWithUnits | null>(null);
  const [sectionTitle, setSectionTitle] = useState("");

  const fetchSection = useCallback(async () => {
    if (authRequired) return;
    setError(null);
    try {
      const data = await teacherApi.getSection(sectionId);
      setSection(data);
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setError(message);
    }
  }, [authRequired, sectionId]);

  useEffect(() => {
    fetchSection();
  }, [fetchSection]);

  const handleCreateUnit = async () => {
    if (authRequired) return;
    setFormError(null);
    try {
      await teacherApi.createUnit({ sectionId, title: unitTitle, sortOrder: 0 });
      setUnitTitle("");
      fetchSection();
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setFormError(message);
    }
  };

  const handleSectionUpdate = async () => {
    if (authRequired || !editing) return;
    setFormError(null);
    try {
      await teacherApi.updateSection(editing.id, {
        title: sectionTitle,
        sortOrder: editing.sortOrder,
      });
      setEditing(null);
      fetchSection();
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setFormError(message);
    }
  };

  const handlePublishToggle = async () => {
    if (authRequired || !section) return;
    setError(null);
    try {
      if (section.status === "published") {
        await teacherApi.unpublishSection(section.id);
      } else {
        await teacherApi.publishSection(section.id);
      }
      fetchSection();
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setError(message);
    }
  };

  const handleUnitPublishToggle = async (unit: Unit) => {
    if (authRequired) return;
    setError(null);
    try {
      if (unit.status === "published") {
        await teacherApi.unpublishUnit(unit.id);
      } else {
        await teacherApi.publishUnit(unit.id);
      }
      fetchSection();
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setError(message);
    }
  };

  const handleUnitDelete = async (unit: Unit) => {
    if (authRequired) return;
    const confirmed = window.confirm(
      "Удалить юнит? Удаление возможно только если в юните нет задач.",
    );
    if (!confirmed) return;
    setError(null);
    try {
      await teacherApi.deleteUnit(unit.id);
      fetchSection();
    } catch (err) {
      const message = getApiErrorMessage(err);
      if (message === "Перелогиньтесь") setAuthRequired(true);
      setError(message);
    }
  };

  const items: EntityListItem[] =
    section?.units.map((unit) => ({
      id: unit.id,
      title: unit.title,
      status: unit.status,
      href: `/teacher/units/${unit.id}`,
      actions: (
        <>
          <Button variant="ghost" onClick={() => handleUnitPublishToggle(unit)}>
            {unit.status === "published" ? "В черновик" : "Опубликовать"}
          </Button>
          <Button variant="ghost" onClick={() => handleUnitDelete(unit)}>
            Удалить
          </Button>
        </>
      ),
    })) ?? [];

  if (authRequired) {
    return (
      <TeacherShell title="Раздел" onLogout={handleLogout}>
        <AuthRequired />
      </TeacherShell>
    );
  }

  return (
    <TeacherShell
      title={section?.title ?? "Раздел"}
      subtitle="Юниты и публикация"
      onLogout={handleLogout}
    >
      <div className={styles.topActions}>
        <Link href="/teacher/courses">← Все курсы</Link>
        {section ? (
          <Button variant="ghost" onClick={handlePublishToggle}>
            {section.status === "published" ? "Снять с публикации" : "Опубликовать"}
          </Button>
        ) : null}
        {section ? (
          <Button
            variant="ghost"
            onClick={() => {
              setEditing(section);
              setSectionTitle(section.title);
            }}
          >
            Редактировать раздел
          </Button>
        ) : null}
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}

      {editing ? (
        <EntityEditorInline
          title="Редактировать раздел"
          submitLabel="Сохранить"
          onSubmit={handleSectionUpdate}
          error={formError}
          disabled={!sectionTitle}
        >
          <label className={styles.label}>
            Название
            <Input value={sectionTitle} onChange={(event) => setSectionTitle(event.target.value)} />
          </label>
        </EntityEditorInline>
      ) : null}

      <EntityEditorInline
        title="Новый юнит"
        description="Минимум: название"
        submitLabel="Создать"
        onSubmit={handleCreateUnit}
        error={formError}
        disabled={!unitTitle}
      >
        <label className={styles.label}>
          Название юнита
          <Input value={unitTitle} onChange={(event) => setUnitTitle(event.target.value)} />
        </label>
      </EntityEditorInline>

      <EntityList title="Юниты" items={items} emptyLabel="Юнитов пока нет" />
    </TeacherShell>
  );
}
