"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/TeacherDashboardShell";
import Button from "@/components/ui/Button";
import FieldLabel from "@/components/ui/FieldLabel";
import Input from "@/components/ui/Input";
import PageHeader from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SurfaceCard";
import { useTeacherLogout } from "@/features/teacher-content/auth/use-teacher-logout";
import { getApiErrorMessage, getApiErrorPayload } from "@/features/teacher-content/shared/api-errors";
import { teacherApi, type TeacherMeResponse } from "@/lib/api/teacher";
import { contentQueryKeys } from "@/lib/query/keys";
import styles from "./teacher-settings.module.css";

type AsyncState = "idle" | "saving" | "saved" | "error";

const teacherNavItems = [
  { label: "Курсы", href: "/teacher" },
  { label: "Ученики", href: "/teacher/students" },
  { label: "Проверка", href: "/teacher/review" },
  { label: "Аналитика", href: "/teacher/analytics" },
];

const getDisplayName = (firstName: string, lastName: string, login: string) =>
  [lastName.trim(), firstName.trim()].filter(Boolean).join(" ") || login;

export default function TeacherSettingsScreen() {
  const handleLogout = useTeacherLogout();
  const queryClient = useQueryClient();
  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", middleName: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "" });
  const [profileState, setProfileState] = useState<AsyncState>("idle");
  const [passwordState, setPasswordState] = useState<AsyncState>("idle");
  const [profileMessage, setProfileMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  const meQuery = useQuery({
    queryKey: contentQueryKeys.teacherMe(),
    queryFn: teacherApi.getTeacherMe,
  });

  useEffect(() => {
    if (!meQuery.data) return;
    setProfileForm({
      firstName: meQuery.data.profile?.firstName ?? "",
      lastName: meQuery.data.profile?.lastName ?? "",
      middleName: meQuery.data.profile?.middleName ?? "",
    });
  }, [meQuery.data]);

  const login = meQuery.data?.user.login ?? "";
  const displayName = useMemo(
    () => getDisplayName(profileForm.firstName, profileForm.lastName, login),
    [login, profileForm.firstName, profileForm.lastName],
  );

  const saveProfile = async () => {
    setProfileState("saving");
    setProfileMessage("");
    try {
      const result = await teacherApi.updateTeacherMeProfile({
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        middleName: profileForm.middleName.trim() || null,
      });
      queryClient.setQueryData<TeacherMeResponse>(contentQueryKeys.teacherMe(), result);
      setProfileState("saved");
      setProfileMessage("Профиль сохранён.");
    } catch (error) {
      setProfileState("error");
      setProfileMessage(getApiErrorPayload(error).message);
    }
  };

  const changePassword = async () => {
    setPasswordState("saving");
    setPasswordMessage("");
    try {
      await teacherApi.changeTeacherMyPassword(passwordForm);
      setPasswordForm({ currentPassword: "", newPassword: "" });
      setPasswordState("saved");
      setPasswordMessage("Пароль изменён. Выполняется выход…");
      window.setTimeout(() => void handleLogout(), 500);
    } catch (error) {
      setPasswordState("error");
      setPasswordMessage(getApiErrorPayload(error).message);
    }
  };

  const loadError = meQuery.isError && !meQuery.data ? getApiErrorMessage(meQuery.error) : null;

  return (
    <DashboardShell title={displayName || "Преподаватель"} navItems={teacherNavItems} appearance="glass" onLogout={handleLogout} settingsHref="/teacher/settings">
      <div className={styles.content}>
        <PageHeader title="Настройки преподавателя" subtitle="Профиль и безопасность учетной записи" />
        {meQuery.isPending ? <div className={styles.stub}>Загрузка настроек…</div> : null}
        {loadError ? <div className={styles.error}>{loadError}</div> : null}

        {meQuery.data ? (
          <>
            <SectionCard className={styles.card}>
              <h2 className={styles.sectionTitle}>Профиль</h2>
              <div className={styles.grid3}>
                <FieldLabel className={styles.field} label="Фамилия"><Input value={profileForm.lastName} onChange={(event) => setProfileForm((value) => ({ ...value, lastName: event.target.value }))} autoComplete="family-name" /></FieldLabel>
                <FieldLabel className={styles.field} label="Имя"><Input value={profileForm.firstName} onChange={(event) => setProfileForm((value) => ({ ...value, firstName: event.target.value }))} autoComplete="given-name" /></FieldLabel>
                <FieldLabel className={styles.field} label="Отчество"><Input value={profileForm.middleName} onChange={(event) => setProfileForm((value) => ({ ...value, middleName: event.target.value }))} autoComplete="additional-name" /></FieldLabel>
              </div>
              <div className={styles.rowActions}><Button onClick={() => void saveProfile()} disabled={profileState === "saving"}>Сохранить</Button></div>
              <div className={styles.status} role="status" aria-live="polite">{profileState === "saving" ? "Сохранение…" : profileMessage}</div>
            </SectionCard>

            <SectionCard className={styles.card}>
              <h2 className={styles.sectionTitle}>Смена пароля</h2>
              <div className={styles.grid2}>
                <FieldLabel className={styles.field} label="Текущий пароль"><Input type="password" value={passwordForm.currentPassword} onChange={(event) => setPasswordForm((value) => ({ ...value, currentPassword: event.target.value }))} autoComplete="current-password" /></FieldLabel>
                <FieldLabel className={styles.field} label="Новый пароль"><Input type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((value) => ({ ...value, newPassword: event.target.value }))} autoComplete="new-password" /></FieldLabel>
              </div>
              <div className={styles.rowActions}><Button onClick={() => void changePassword()} disabled={passwordState === "saving"}>Сменить пароль</Button></div>
              <div className={styles.status} role="status" aria-live="polite">{passwordState === "saving" ? "Смена пароля…" : passwordMessage}</div>
            </SectionCard>
          </>
        ) : null}
      </div>
    </DashboardShell>
  );
}
