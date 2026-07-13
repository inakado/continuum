"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import AdminShell from "@/components/TeacherDashboardShell";
import AlertDialog from "@/components/ui/AlertDialog";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import EmptyState from "@/components/ui/EmptyState";
import FieldLabel from "@/components/ui/FieldLabel";
import Input from "@/components/ui/Input";
import PageHeader from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SurfaceCard";
import { adminApi, type AdminTeacherSummary } from "@/lib/api/admin";
import { getApiErrorPayloadByAudience } from "@/lib/api/error-catalog";
import { useAuthLogout } from "@/features/auth/useAuthLogout";
import { contentQueryKeys } from "@/lib/query/keys";
import styles from "./admin-teachers.module.css";

const adminNavItems = [{ label: "Преподаватели", href: "/admin/teachers" }];

const displayName = (teacher: AdminTeacherSummary) =>
  [teacher.lastName?.trim(), teacher.firstName?.trim()].filter(Boolean).join(" ") || teacher.login;

export default function AdminTeachersScreen() {
  const queryClient = useQueryClient();
  const logout = useAuthLogout();
  const [form, setForm] = useState({
    login: "",
    firstName: "",
    lastName: "",
    middleName: "",
    password: "",
    generatePassword: true,
  });
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [createdPassword, setCreatedPassword] = useState<string | null>(null);
  const [teacherToDelete, setTeacherToDelete] = useState<AdminTeacherSummary | null>(null);

  const teachersQuery = useQuery({
    queryKey: contentQueryKeys.adminTeachers(),
    queryFn: adminApi.listTeachers,
  });
  const teachers = teachersQuery.data ?? [];

  const createTeacher = async () => {
    setSaving(true);
    setStatus("");
    setCreatedPassword(null);
    try {
      const teacher = await adminApi.createTeacher({
        login: form.login,
        firstName: form.firstName,
        lastName: form.lastName,
        middleName: form.middleName.trim() || null,
        password: form.generatePassword ? null : form.password,
        generatePassword: form.generatePassword,
      });
      setForm({ login: "", firstName: "", lastName: "", middleName: "", password: "", generatePassword: true });
      setCreatedPassword(teacher.password ?? null);
      setStatus(`Преподаватель ${teacher.login} создан.`);
      await queryClient.invalidateQueries({ queryKey: contentQueryKeys.adminTeachers() });
    } catch (error) {
      setStatus(getApiErrorPayloadByAudience(error, "teacher").message);
    } finally {
      setSaving(false);
    }
  };

  const deleteTeacher = async () => {
    if (!teacherToDelete) return;
    setSaving(true);
    try {
      await adminApi.deleteTeacher(teacherToDelete.id);
      setStatus(`Преподаватель ${teacherToDelete.login} удалён.`);
      await queryClient.invalidateQueries({ queryKey: contentQueryKeys.adminTeachers() });
    } catch (error) {
      setStatus(getApiErrorPayloadByAudience(error, "teacher").message);
    } finally {
      setSaving(false);
      setTeacherToDelete(null);
    }
  };

  return (
    <AdminShell title="Администратор" navItems={adminNavItems} appearance="glass" onLogout={logout}>
      <div className={styles.content}>
        <PageHeader title="Преподаватели" subtitle="Создание и удаление учетных записей преподавателей" />

        <SectionCard className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Новый преподаватель</h2>
          </div>
          <div className={styles.formGrid}>
            <FieldLabel label="Логин"><Input value={form.login} onChange={(event) => setForm((value) => ({ ...value, login: event.target.value }))} autoComplete="username" /></FieldLabel>
            <FieldLabel label="Фамилия"><Input value={form.lastName} onChange={(event) => setForm((value) => ({ ...value, lastName: event.target.value }))} /></FieldLabel>
            <FieldLabel label="Имя"><Input value={form.firstName} onChange={(event) => setForm((value) => ({ ...value, firstName: event.target.value }))} /></FieldLabel>
            <FieldLabel label="Отчество"><Input value={form.middleName} onChange={(event) => setForm((value) => ({ ...value, middleName: event.target.value }))} /></FieldLabel>
            <FieldLabel label="Пароль"><Input type="password" value={form.password} disabled={form.generatePassword} onChange={(event) => setForm((value) => ({ ...value, password: event.target.value }))} autoComplete="new-password" /></FieldLabel>
          </div>
          <div className={styles.actions}>
            <Checkbox label="Сгенерировать пароль" checked={form.generatePassword} onChange={(event) => setForm((value) => ({ ...value, generatePassword: event.target.checked }))} />
            <Button onClick={() => void createTeacher()} disabled={saving}>Создать</Button>
          </div>
          {createdPassword ? <div className={styles.password}>Пароль показан один раз: <strong>{createdPassword}</strong></div> : null}
        </SectionCard>

        <section className={styles.registry} aria-labelledby="teachers-title">
          <div className={styles.sectionHeader}>
            <h2 id="teachers-title">Учетные записи</h2>
            <Button variant="secondary" onClick={() => void teachersQuery.refetch()} disabled={teachersQuery.isFetching}>Обновить</Button>
          </div>
          {teachersQuery.isPending ? <div className={styles.state}>Загрузка…</div> : teachers.length === 0 ? (
            <EmptyState title="Преподавателей пока нет" description="Создайте первую учетную запись выше." />
          ) : (
            <div className={styles.list}>
              {teachers.map((teacher) => (
                <div className={styles.row} key={teacher.id}>
                  <div><div className={styles.name}>{displayName(teacher)}</div><div className={styles.login}>@{teacher.login}</div></div>
                  <Button variant="danger" onClick={() => setTeacherToDelete(teacher)} disabled={saving}>Удалить</Button>
                </div>
              ))}
            </div>
          )}
          <div className={styles.status} role="status" aria-live="polite">{status}</div>
        </section>
      </div>
      <AlertDialog open={Boolean(teacherToDelete)} onOpenChange={(open) => { if (!open) setTeacherToDelete(null); }} title={teacherToDelete ? `Удалить ${teacherToDelete.login}?` : ""} description="Учетная запись будет удалена без возможности восстановления." confirmText="Удалить" cancelText="Отмена" destructive confirmDisabled={saving} onConfirm={() => void deleteTeacher()} />
    </AdminShell>
  );
}
