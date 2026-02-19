"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import Button from "@/components/ui/Button";
import Checkbox from "@/components/ui/Checkbox";
import Input from "@/components/ui/Input";
import { useTeacherLogout } from "@/features/teacher-content/auth/use-teacher-logout";
import { getApiErrorMessage, getApiErrorPayload } from "@/features/teacher-content/shared/api-errors";
import { teacherApi, type TeacherSummary } from "@/lib/api/teacher";
import styles from "./teacher-settings.module.css";

type AsyncState =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved"; message: string }
  | { state: "error"; message: string };

const getTeacherDisplayName = (
  firstName?: string | null,
  lastName?: string | null,
  login?: string | null,
) => {
  const parts = [lastName?.trim(), firstName?.trim()].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return login?.trim() || "Преподаватель";
};

const teacherNavItems = [
  { label: "Создание и редактирование", href: "/teacher" },
  { label: "Ученики", href: "/teacher/students" },
  { label: "Проверка фото", href: "/teacher/review" },
  { label: "Аналитика", href: "/teacher/analytics" },
];

export default function TeacherSettingsScreen() {
  const router = useRouter();
  const handleLogout = useTeacherLogout();

  const [currentTeacherId, setCurrentTeacherId] = useState<string>("");
  const [login, setLogin] = useState<string>("");
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

  const [teachers, setTeachers] = useState<TeacherSummary[]>([]);
  const [teachersLoading, setTeachersLoading] = useState(false);
  const [teachersState, setTeachersState] = useState<AsyncState>({ state: "idle" });
  const [deletingTeacherId, setDeletingTeacherId] = useState<string | null>(null);

  const [loadingMe, setLoadingMe] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadTeachers = useCallback(async () => {
    setTeachersLoading(true);
    try {
      const list = await teacherApi.listTeachers();
      setTeachers(list);
    } catch (error) {
      const payload = getApiErrorPayload(error);
      setTeachersState({ state: "error", message: payload.message });
    } finally {
      setTeachersLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoadingMe(true);
      setLoadError(null);
      try {
        const [me, teachersList] = await Promise.all([
          teacherApi.getTeacherMe(),
          teacherApi.listTeachers(),
        ]);
        if (!mounted) return;
        setCurrentTeacherId(me.user.id ?? "");
        setLogin(me.user.login ?? "");
        setProfileForm({
          firstName: me.profile?.firstName ?? "",
          lastName: me.profile?.lastName ?? "",
          middleName: me.profile?.middleName ?? "",
        });
        setTeachers(teachersList);
      } catch (error) {
        if (!mounted) return;
        setLoadError(getApiErrorMessage(error));
      } finally {
        if (mounted) {
          setLoadingMe(false);
        }
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const displayName = useMemo(
    () => getTeacherDisplayName(profileForm.firstName, profileForm.lastName, login),
    [login, profileForm.firstName, profileForm.lastName],
  );

  const profileStatusText =
    profileState.state === "saving"
      ? "Сохранение…"
      : profileState.state === "saved"
        ? profileState.message
        : profileState.state === "error"
          ? profileState.message
          : "";

  const passwordStatusText =
    passwordState.state === "saving"
      ? "Смена пароля…"
      : passwordState.state === "saved"
        ? passwordState.message
        : passwordState.state === "error"
          ? passwordState.message
          : "";

  const createStatusText =
    createState.state === "saving"
      ? "Создание преподавателя…"
      : createState.state === "saved"
        ? createState.message
        : createState.state === "error"
          ? createState.message
          : "";

  const teachersStatusText =
    teachersState.state === "saving"
      ? "Удаление преподавателя…"
      : teachersState.state === "saved"
        ? teachersState.message
        : teachersState.state === "error"
          ? teachersState.message
          : "";

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
      await loadTeachers();
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

    const confirmed = window.confirm(`Удалить преподавателя ${teacher.login}?`);
    if (!confirmed) return;

    setDeletingTeacherId(teacher.id);
    setTeachersState({ state: "saving" });

    try {
      await teacherApi.deleteTeacher(teacher.id);
      setTeachers((prev) => prev.filter((item) => item.id !== teacher.id));
      setTeachersState({
        state: "saved",
        message: `Преподаватель ${teacher.login} удалён.`,
      });
    } catch (error) {
      const payload = getApiErrorPayload(error);
      setTeachersState({ state: "error", message: payload.message });
    } finally {
      setDeletingTeacherId(null);
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
            <Button variant="ghost" onClick={() => router.refresh()}>
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
        <div className={styles.header}>
          <h1 className={styles.title}>Настройки преподавателя</h1>
          <p className={styles.subtitle}>Профиль, пароль и управление преподавателями</p>
        </div>

        <section className={styles.card}>
          <div className={styles.cardTitle}>Профиль</div>
          <div className={styles.grid3}>
            <label className={styles.field}>
              Фамилия
              <Input
                value={profileForm.lastName}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, lastName: event.target.value }))
                }
                placeholder="Фамилия"
                autoComplete="family-name"
              />
            </label>
            <label className={styles.field}>
              Имя
              <Input
                value={profileForm.firstName}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, firstName: event.target.value }))
                }
                placeholder="Имя"
                autoComplete="given-name"
              />
            </label>
            <label className={styles.field}>
              Отчество
              <Input
                value={profileForm.middleName}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, middleName: event.target.value }))
                }
                placeholder="Отчество (необязательно)"
                autoComplete="additional-name"
              />
            </label>
          </div>
          <div className={styles.rowActions}>
            <Button onClick={() => void handleProfileSave()} disabled={profileState.state === "saving"}>
              Сохранить
            </Button>
          </div>
          <div className={styles.status} role="status" aria-live="polite">
            {profileStatusText}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardTitle}>Сменить пароль</div>
          <div className={styles.grid2}>
            <label className={styles.field}>
              Текущий пароль
              <Input
                type="password"
                value={passwordForm.currentPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }))
                }
                autoComplete="current-password"
              />
            </label>
            <label className={styles.field}>
              Новый пароль
              <Input
                type="password"
                value={passwordForm.newPassword}
                onChange={(event) =>
                  setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }))
                }
                autoComplete="new-password"
              />
            </label>
          </div>
          <div className={styles.rowActions}>
            <Button onClick={() => void handlePasswordChange()} disabled={passwordState.state === "saving"}>
              Сменить пароль
            </Button>
          </div>
          <div className={styles.status} role="status" aria-live="polite">
            {passwordStatusText}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.cardTitle}>Создать преподавателя</div>
          <div className={styles.grid3}>
            <label className={styles.field}>
              Логин
              <Input
                value={createForm.login}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, login: event.target.value }))}
                placeholder="login"
                autoComplete="off"
              />
            </label>
            <label className={styles.field}>
              Фамилия
              <Input
                value={createForm.lastName}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, lastName: event.target.value }))}
                placeholder="Фамилия"
              />
            </label>
            <label className={styles.field}>
              Имя
              <Input
                value={createForm.firstName}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, firstName: event.target.value }))}
                placeholder="Имя"
              />
            </label>
            <label className={styles.field}>
              Отчество
              <Input
                value={createForm.middleName}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, middleName: event.target.value }))}
                placeholder="Отчество (необязательно)"
              />
            </label>
            <label className={styles.field}>
              Пароль
              <Input
                type="password"
                value={createForm.password}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder={createForm.generatePassword ? "Будет сгенерирован" : "Пароль"}
                disabled={createForm.generatePassword}
                autoComplete="new-password"
              />
            </label>
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
        </section>

        <section className={styles.card}>
          <div className={styles.cardTitle}>Список преподавателей</div>
          <div className={styles.rowActions}>
            <Button variant="ghost" onClick={() => void loadTeachers()} disabled={teachersLoading}>
              Обновить список
            </Button>
          </div>
          {teachersLoading ? (
            <div className={styles.stub}>Загрузка преподавателей…</div>
          ) : teachers.length === 0 ? (
            <div className={styles.stub}>Преподавателей пока нет.</div>
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
                      <span className={styles.selfBadge}>Вы</span>
                    ) : (
                      <Button
                        variant="ghost"
                        onClick={() => void handleDeleteTeacher(teacher)}
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
            {teachersStatusText}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
