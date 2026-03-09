"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import DashboardShell from "@/components/DashboardShell";
import AlertDialog from "@/components/ui/AlertDialog";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import EmptyState from "@/components/ui/EmptyState";
import FieldLabel from "@/components/ui/FieldLabel";
import Input from "@/components/ui/Input";
import InlineStatus from "@/components/ui/InlineStatus";
import Kicker from "@/components/ui/Kicker";
import PageHeader from "@/components/ui/PageHeader";
import { SectionCard } from "@/components/ui/SurfaceCard";
import { useTeacherLogout } from "@/features/teacher-content/auth/use-teacher-logout";
import { getApiErrorMessage, getApiErrorPayload } from "@/features/teacher-content/shared/api-errors";
import { teacherApi, type TeacherMeResponse, type TeacherSummary } from "@/lib/api/teacher";
import { contentQueryKeys } from "@/lib/query/keys";
import styles from "./teacher-settings.module.css";

type AsyncState =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved"; message: string }
  | { state: "error"; message: string };

type AsyncStatusMessages = {
  saving: string;
};

type TeacherListSectionProps = {
  currentTeacherId: string;
  deletingTeacherId: string | null;
  onDeleteTeacher: (teacher: TeacherSummary) => void;
  onRefresh: () => void;
  statusText: string;
  teachers: TeacherSummary[];
  teachersLoading: boolean;
};

const getTeacherDisplayName = (
  firstName?: string | null,
  lastName?: string | null,
  login?: string | null,
) => {
  const parts = [lastName?.trim(), firstName?.trim()].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return login?.trim() || "Преподаватель";
};

const getAsyncStatusText = (asyncState: AsyncState, messages: AsyncStatusMessages) => {
  switch (asyncState.state) {
    case "saving":
      return messages.saving;
    case "saved":
    case "error":
      return asyncState.message;
    default:
      return "";
  }
};

const teacherNavItems = [
  { label: "Курсы", href: "/teacher" },
  { label: "Ученики", href: "/teacher/students" },
  { label: "Проверка фото", href: "/teacher/review" },
  { label: "Аналитика", href: "/teacher/analytics" },
];

const TeacherListSection = ({
  currentTeacherId,
  deletingTeacherId,
  onDeleteTeacher,
  onRefresh,
  statusText,
  teachers,
  teachersLoading,
}: TeacherListSectionProps) => (
  <SectionCard className={styles.card}>
    <Kicker>Список преподавателей</Kicker>
    <div className={styles.rowActions}>
      <Button variant="secondary" onClick={onRefresh} disabled={teachersLoading}>
        Обновить список
      </Button>
    </div>
    {teachersLoading ? (
      <div className={styles.stub}>Загрузка преподавателей…</div>
    ) : teachers.length === 0 ? (
      <EmptyState title="Преподавателей пока нет" description="Создайте первого преподавателя в форме выше." />
    ) : (
      <div className={styles.teacherList}>
        {teachers.map((teacher) => {
          const isSelf = teacher.id === currentTeacherId;
          return (
            <div key={teacher.id} className={styles.teacherRow}>
              <div className={styles.teacherMain}>
                <div className={styles.teacherName}>
                  {getTeacherDisplayName(teacher.firstName, teacher.lastName, teacher.login)}
                </div>
                <div className={styles.teacherLogin}>@{teacher.login}</div>
              </div>
              {isSelf ? (
                <InlineStatus tone="muted" className={styles.selfBadge}>
                  Вы
                </InlineStatus>
              ) : (
                <Button
                  variant="danger"
                  onClick={() => onDeleteTeacher(teacher)}
                  disabled={deletingTeacherId === teacher.id}
                >
                  Удалить
                </Button>
              )}
            </div>
          );
        })}
      </div>
    )}
    <div className={styles.status} role="status" aria-live="polite">
      {statusText}
    </div>
  </SectionCard>
);

export default function TeacherSettingsScreen() {
  const handleLogout = useTeacherLogout();
  const queryClient = useQueryClient();

  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    middleName: "",
  });
  const [profileState, setProfileState] = useState<AsyncState>({ state: "idle" });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
  });
  const [passwordState, setPasswordState] = useState<AsyncState>({ state: "idle" });

  const [createForm, setCreateForm] = useState({
    login: "",
    firstName: "",
    lastName: "",
    middleName: "",
    password: "",
    generatePassword: true,
  });
  const [createState, setCreateState] = useState<AsyncState>({ state: "idle" });
  const [createdTeacherPassword, setCreatedTeacherPassword] = useState<string | null>(null);

  const [teachersState, setTeachersState] = useState<AsyncState>({ state: "idle" });
  const [deletingTeacherId, setDeletingTeacherId] = useState<string | null>(null);
  const [teacherToDelete, setTeacherToDelete] = useState<TeacherSummary | null>(null);
  const meQuery = useQuery({
    queryKey: contentQueryKeys.teacherMe(),
    queryFn: () => teacherApi.getTeacherMe(),
  });
  const teachersQuery = useQuery({
    queryKey: contentQueryKeys.teacherTeachers(),
    queryFn: () => teacherApi.listTeachers(),
  });
  const currentTeacherId = meQuery.data?.user.id ?? "";
  const login = meQuery.data?.user.login ?? "";
  const teachers = teachersQuery.data ?? [];
  const teachersLoading = teachersQuery.isFetching;
  const loadingMe = meQuery.isPending || teachersQuery.isPending;
  const loadError =
    (meQuery.isError && !meQuery.data ? getApiErrorMessage(meQuery.error) : null) ??
    (teachersQuery.isError && !teachersQuery.data ? getApiErrorMessage(teachersQuery.error) : null);

  useEffect(() => {
    if (!meQuery.data) return;
    setProfileForm({
      firstName: meQuery.data.profile?.firstName ?? "",
      lastName: meQuery.data.profile?.lastName ?? "",
      middleName: meQuery.data.profile?.middleName ?? "",
    });
  }, [meQuery.data]);

  const displayName = useMemo(
    () => getTeacherDisplayName(profileForm.firstName, profileForm.lastName, login),
    [login, profileForm.firstName, profileForm.lastName],
  );

  const profileStatusText = getAsyncStatusText(profileState, {
    saving: "Сохранение…",
  });

  const passwordStatusText = getAsyncStatusText(passwordState, {
    saving: "Смена пароля…",
  });

  const createStatusText = getAsyncStatusText(createState, {
    saving: "Создание преподавателя…",
  });

  const teachersStatusText = getAsyncStatusText(teachersState, {
    saving: "Удаление преподавателя…",
  });

  const syncTeacherMeCache = (data: TeacherMeResponse) => {
    queryClient.setQueryData(contentQueryKeys.teacherMe(), data);
    queryClient.setQueryData<TeacherSummary[]>(
      contentQueryKeys.teacherTeachers(),
      (previous) =>
        previous?.map((teacher) =>
          teacher.id === data.user.id
            ? {
                ...teacher,
                login: data.user.login,
                firstName: data.profile?.firstName ?? "",
                lastName: data.profile?.lastName ?? "",
                middleName: data.profile?.middleName ?? null,
              }
            : teacher,
        ) ?? previous,
    );
  };

  const refreshTeachers = async () => {
    const result = await teachersQuery.refetch();
    if (result.error) {
      const payload = getApiErrorPayload(result.error);
      setTeachersState({ state: "error", message: payload.message });
      return false;
    }
    return true;
  };

  const handleInitialReload = async () => {
    await Promise.all([meQuery.refetch(), teachersQuery.refetch()]);
  };

  const handleProfileSave = async () => {
    setProfileState({ state: "saving" });
    try {
      const result = await teacherApi.updateTeacherMeProfile({
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        middleName: profileForm.middleName.trim() || null,
      });

      setProfileForm({
        firstName: result.profile?.firstName ?? "",
        lastName: result.profile?.lastName ?? "",
        middleName: result.profile?.middleName ?? "",
      });
      syncTeacherMeCache(result);
      setProfileState({ state: "saved", message: "Профиль сохранён." });
    } catch (error) {
      const payload = getApiErrorPayload(error);
      setProfileState({ state: "error", message: payload.message });
    }
  };

  const handlePasswordChange = async () => {
    setPasswordState({ state: "saving" });
    try {
      await teacherApi.changeTeacherMyPassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      setPasswordForm({ currentPassword: "", newPassword: "" });
      setPasswordState({
        state: "saved",
        message: "Пароль изменён. Выполняется выход из текущей сессии…",
      });

      window.setTimeout(() => {
        void handleLogout();
      }, 500);
    } catch (error) {
      const payload = getApiErrorPayload(error);
      setPasswordState({ state: "error", message: payload.message });
    }
  };

  const handleCreateTeacher = async () => {
    setCreateState({ state: "saving" });
    setCreatedTeacherPassword(null);

    try {
      const result = await teacherApi.createTeacher({
        login: createForm.login,
        firstName: createForm.firstName,
        lastName: createForm.lastName,
        middleName: createForm.middleName.trim() || null,
        password: createForm.generatePassword ? null : createForm.password,
        generatePassword: createForm.generatePassword,
      });

      setCreateForm({
        login: "",
        firstName: "",
        lastName: "",
        middleName: "",
        password: "",
        generatePassword: true,
      });
      setCreatedTeacherPassword(result.password ?? null);
      setCreateState({
        state: "saved",
        message: `Преподаватель ${result.login} создан.`,
      });
      queryClient.setQueryData<TeacherSummary[]>(
        contentQueryKeys.teacherTeachers(),
        (previous) => [...(previous ?? []), result],
      );
      await queryClient.invalidateQueries({ queryKey: contentQueryKeys.teacherTeachers() });
    } catch (error) {
      const payload = getApiErrorPayload(error);
      setCreateState({ state: "error", message: payload.message });
    }
  };

  const handleDeleteTeacher = async (teacher: TeacherSummary) => {
    if (teacher.id === currentTeacherId) {
      setTeachersState({
        state: "error",
        message: "Нельзя удалить собственного пользователя.",
      });
      return;
    }
    setTeacherToDelete(teacher);
  };

  const confirmDeleteTeacher = async () => {
    if (!teacherToDelete) return;

    setDeletingTeacherId(teacherToDelete.id);
    setTeachersState({ state: "saving" });

    try {
      await teacherApi.deleteTeacher(teacherToDelete.id);
      queryClient.setQueryData<TeacherSummary[]>(
        contentQueryKeys.teacherTeachers(),
        (previous) => previous?.filter((item) => item.id !== teacherToDelete.id) ?? [],
      );
      await queryClient.invalidateQueries({ queryKey: contentQueryKeys.teacherTeachers() });
      setTeachersState({
        state: "saved",
        message: `Преподаватель ${teacherToDelete.login} удалён.`,
      });
    } catch (error) {
      const payload = getApiErrorPayload(error);
      setTeachersState({ state: "error", message: payload.message });
    } finally {
      setDeletingTeacherId(null);
      setTeacherToDelete(null);
    }
  };

  if (loadingMe) {
    return (
      <DashboardShell
        title="Преподаватель"
        navItems={teacherNavItems}
        appearance="glass"
        onLogout={handleLogout}
        settingsHref="/teacher/settings"
      >
        <div className={styles.content}>Загрузка настроек…</div>
      </DashboardShell>
    );
  }

  if (loadError) {
    return (
      <DashboardShell
        title="Преподаватель"
        navItems={teacherNavItems}
        appearance="glass"
        onLogout={handleLogout}
        settingsHref="/teacher/settings"
      >
        <div className={styles.content}>
          <div className={styles.error}>{loadError}</div>
          <div className={styles.rowActions}>
            <Button variant="secondary" onClick={() => void handleInitialReload()}>
              Обновить
            </Button>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      title={displayName}
      navItems={teacherNavItems}
      appearance="glass"
      onLogout={handleLogout}
      settingsHref="/teacher/settings"
    >
      <div className={styles.content}>
        <PageHeader
          title="Настройки преподавателя"
          subtitle="Профиль, пароль и управление преподавателями"
        />

        <SectionCard className={styles.card}>
          <Kicker>Профиль</Kicker>
          <div className={styles.grid3}>
            <FieldLabel className={styles.field} label="Фамилия">
              <Input
                value={profileForm.lastName}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, lastName: event.target.value }))
                }
                placeholder="Фамилия"
                autoComplete="family-name"
              />
            </FieldLabel>
            <FieldLabel className={styles.field} label="Имя">
              <Input
                value={profileForm.firstName}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, firstName: event.target.value }))
                }
                placeholder="Имя"
                autoComplete="given-name"
              />
            </FieldLabel>
            <FieldLabel className={styles.field} label="Отчество">
              <Input
                value={profileForm.middleName}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, middleName: event.target.value }))
                }
                placeholder="Отчество (необязательно)"
                autoComplete="additional-name"
              />
            </FieldLabel>
          </div>
          <div className={styles.rowActions}>
            <Button onClick={() => void handleProfileSave()} disabled={profileState.state === "saving"}>
              Сохранить
            </Button>
          </div>
          <div className={styles.status} role="status" aria-live="polite">
            {profileStatusText}
          </div>
        </SectionCard>

        <SectionCard className={styles.card}>
          <Kicker>Сменить пароль</Kicker>
          <div className={styles.grid2}>
            <FieldLabel className={styles.field} label="Текущий пароль">
              <Input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                }
                autoComplete="current-password"
              />
            </FieldLabel>
            <FieldLabel className={styles.field} label="Новый пароль">
              <Input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                }
                autoComplete="new-password"
              />
            </FieldLabel>
          </div>
          <div className={styles.rowActions}>
            <Button onClick={() => void handlePasswordChange()} disabled={passwordState.state === "saving"}>
              Сменить пароль
            </Button>
          </div>
          <div className={styles.status} role="status" aria-live="polite">
            {passwordStatusText}
          </div>
        </SectionCard>

        <SectionCard className={styles.card}>
          <Kicker>Создать преподавателя</Kicker>
          <div className={styles.grid3}>
            <FieldLabel className={styles.field} label="Логин">
              <Input
                name="teacherLogin"
                value={createForm.login}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, login: event.target.value }))}
                placeholder="login…"
                autoComplete="username"
                spellCheck={false}
              />
            </FieldLabel>
            <FieldLabel className={styles.field} label="Фамилия">
              <Input
                value={createForm.lastName}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, lastName: event.target.value }))}
                placeholder="Фамилия"
              />
            </FieldLabel>
            <FieldLabel className={styles.field} label="Имя">
              <Input
                value={createForm.firstName}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, firstName: event.target.value }))}
                placeholder="Имя"
              />
            </FieldLabel>
            <FieldLabel className={styles.field} label="Отчество">
              <Input
                value={createForm.middleName}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, middleName: event.target.value }))}
                placeholder="Отчество (необязательно)"
              />
            </FieldLabel>
            <FieldLabel className={styles.field} label="Пароль">
              <Input
                type="password"
                value={createForm.password}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder={createForm.generatePassword ? "Будет сгенерирован" : "Пароль"}
                disabled={createForm.generatePassword}
                autoComplete="new-password"
              />
            </FieldLabel>
          </div>
          <div className={styles.rowActions}>
            <Checkbox
              label="Сгенерировать пароль"
              checked={createForm.generatePassword}
              onChange={(event) =>
                setCreateForm((prev) => ({
                  ...prev,
                  generatePassword: event.target.checked,
                }))
              }
            />
            <Button onClick={() => void handleCreateTeacher()} disabled={createState.state === "saving"}>
              Создать преподавателя
            </Button>
          </div>
          <div className={styles.status} role="status" aria-live="polite">
            {createStatusText}
          </div>
          {createdTeacherPassword ? (
            <div className={styles.generatedPassword}>
              Пароль нового преподавателя (показан один раз): <strong>{createdTeacherPassword}</strong>
            </div>
          ) : null}
        </SectionCard>

        <TeacherListSection
          currentTeacherId={currentTeacherId}
          deletingTeacherId={deletingTeacherId}
          onDeleteTeacher={(teacher) => void handleDeleteTeacher(teacher)}
          onRefresh={() => void refreshTeachers()}
          statusText={teachersStatusText}
          teachers={teachers}
          teachersLoading={teachersLoading}
        />
        <AlertDialog
          open={Boolean(teacherToDelete)}
          onOpenChange={(open) => {
            if (!open) setTeacherToDelete(null);
          }}
          title={teacherToDelete ? `Удалить преподавателя ${teacherToDelete.login}?` : ""}
          description="Действие удалит аккаунт преподавателя без возможности восстановления."
          confirmText="Удалить преподавателя"
          cancelText="Отмена"
          destructive
          confirmDisabled={Boolean(
            teacherToDelete && deletingTeacherId && deletingTeacherId === teacherToDelete.id,
          )}
          onConfirm={() => void confirmDeleteTeacher()}
        />
      </div>
    </DashboardShell>
  );
}
