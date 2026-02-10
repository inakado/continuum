"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { teacherApi, type StudentSummary, type TeacherSummary } from "@/lib/api/teacher";
import { getApiErrorMessage } from "@/features/teacher-content/shared/api-errors";
import styles from "./teacher-students-panel.module.css";

type PasswordReveal = {
  login: string;
  password: string;
  label: string;
};

export default function TeacherStudentsPanel() {
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [teachers, setTeachers] = useState<TeacherSummary[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createLogin, setCreateLogin] = useState("");
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [passwordReveal, setPasswordReveal] = useState<PasswordReveal | null>(null);
  const [resetBusyId, setResetBusyId] = useState<string | null>(null);
  const [transferStudentId, setTransferStudentId] = useState<string | null>(null);
  const [transferTeacherId, setTransferTeacherId] = useState<string>("");
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [editStudentId, setEditStudentId] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteBusyId, setDeleteBusyId] = useState<string | null>(null);
  const studentsRequestIdRef = useRef(0);

  const fetchStudents = useCallback(async (search: string) => {
    const requestId = ++studentsRequestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const data = await teacherApi.listStudents({ query: search.trim() || undefined });
      if (requestId !== studentsRequestIdRef.current) return;
      setStudents(data);
    } catch (err) {
      if (requestId !== studentsRequestIdRef.current) return;
      setError(getApiErrorMessage(err));
    } finally {
      if (requestId === studentsRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const fetchTeachers = useCallback(async () => {
    setLoadingTeachers(true);
    try {
      const data = await teacherApi.listTeachers();
      setTeachers(data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoadingTeachers(false);
    }
  }, []);

  useEffect(() => {
    fetchTeachers();
  }, [fetchTeachers]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      fetchStudents(query);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, fetchStudents]);

  const handleCreate = async () => {
    const trimmed = createLogin.trim();
    if (!trimmed || creating) return;
    setCreateError(null);
    setCreating(true);
    try {
      const created = await teacherApi.createStudent({
        login: trimmed,
        firstName: createFirstName.trim() || null,
        lastName: createLastName.trim() || null,
      });
      setCreateLogin("");
      setCreateFirstName("");
      setCreateLastName("");
      setShowCreateForm(false);
      setPasswordReveal({
        login: created.login,
        password: created.password,
        label: "Новый ученик создан",
      });
      await fetchStudents(query);
    } catch (err) {
      setCreateError(getApiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const handleResetPassword = async (student: StudentSummary) => {
    if (resetBusyId) return;
    const confirmed = window.confirm(`Сбросить пароль для ${student.login}?`);
    if (!confirmed) return;
    setResetBusyId(student.id);
    setError(null);
    try {
      const data = await teacherApi.resetStudentPassword(student.id);
      setPasswordReveal({
        login: data.login,
        password: data.password,
        label: "Пароль обновлён",
      });
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setResetBusyId(null);
    }
  };

  const handleStartTransfer = (student: StudentSummary) => {
    setTransferError(null);
    if (transferStudentId === student.id) {
      setTransferStudentId(null);
      setTransferTeacherId("");
      return;
    }
    setTransferStudentId(student.id);
    setTransferTeacherId("");
  };

  const handleTransfer = async (student: StudentSummary) => {
    if (!transferTeacherId || transferBusy) return;
    setTransferBusy(true);
    setTransferError(null);
    try {
      await teacherApi.transferStudent(student.id, { leaderTeacherId: transferTeacherId });
      setTransferStudentId(null);
      setTransferTeacherId("");
      await fetchStudents(query);
    } catch (err) {
      setTransferError(getApiErrorMessage(err));
    } finally {
      setTransferBusy(false);
    }
  };

  const handleStartEdit = (student: StudentSummary) => {
    setEditError(null);
    if (editStudentId === student.id) {
      setEditStudentId(null);
      setEditFirstName("");
      setEditLastName("");
      return;
    }
    setEditStudentId(student.id);
    setEditFirstName(student.firstName ?? "");
    setEditLastName(student.lastName ?? "");
  };

  const handleSaveEdit = async (student: StudentSummary) => {
    if (editBusy) return;
    setEditBusy(true);
    setEditError(null);
    try {
      await teacherApi.updateStudentProfile(student.id, {
        firstName: editFirstName.trim() || null,
        lastName: editLastName.trim() || null,
      });
      setEditStudentId(null);
      setEditFirstName("");
      setEditLastName("");
      await fetchStudents(query);
    } catch (err) {
      setEditError(getApiErrorMessage(err));
    } finally {
      setEditBusy(false);
    }
  };

  const handleDelete = async (student: StudentSummary) => {
    if (deleteBusyId) return;
    const confirmed = window.confirm(`Удалить ученика ${student.login}? Действие необратимо.`);
    if (!confirmed) return;
    setDeleteBusyId(student.id);
    setError(null);
    try {
      await teacherApi.deleteStudent(student.id);
      if (editStudentId === student.id) {
        setEditStudentId(null);
        setEditFirstName("");
        setEditLastName("");
      }
      if (transferStudentId === student.id) {
        setTransferStudentId(null);
        setTransferTeacherId("");
      }
      await fetchStudents(query);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setDeleteBusyId(null);
    }
  };

  const handleCopyPassword = async () => {
    if (!passwordReveal?.password) return;
    try {
      await navigator.clipboard.writeText(passwordReveal.password);
    } catch {
      /* noop */
    }
  };

  const listState = useMemo(() => {
    if (loading) return "loading";
    if (students.length === 0) return "empty";
    return "ready";
  }, [loading, students.length]);

  const getDisplayName = (student: StudentSummary) => {
    const parts = [student.lastName, student.firstName].filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
    return student.login;
  };

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <label className={styles.label}>
            Поиск по логину
            <Input
              value={query}
              placeholder="Например: student01"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        <Button
          onClick={() => {
            setShowCreateForm((prev) => !prev);
            setCreateError(null);
          }}
        >
          Добавить ученика
        </Button>
      </div>

      {showCreateForm ? (
        <div className={styles.form}>
          <label className={styles.label}>
            Логин ученика
            <Input
              value={createLogin}
              placeholder="student_login"
              onChange={(event) => setCreateLogin(event.target.value)}
            />
          </label>
          <div className={styles.inlineRow}>
            <label className={styles.label}>
              Имя
              <Input
                value={createFirstName}
                placeholder="Имя (необязательно)"
                onChange={(event) => setCreateFirstName(event.target.value)}
              />
            </label>
            <label className={styles.label}>
              Фамилия
              <Input
                value={createLastName}
                placeholder="Фамилия (необязательно)"
                onChange={(event) => setCreateLastName(event.target.value)}
              />
            </label>
          </div>
          {createError ? <div className={styles.formError}>{createError}</div> : null}
          <div className={styles.formActions}>
            <Button onClick={handleCreate} disabled={creating || !createLogin.trim()}>
              Создать
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setShowCreateForm(false);
                setCreateLogin("");
                setCreateFirstName("");
                setCreateLastName("");
                setCreateError(null);
              }}
            >
              Отмена
            </Button>
          </div>
        </div>
      ) : null}

      {passwordReveal ? (
        <div className={styles.passwordReveal}>
          <div className={styles.passwordTitle}>{passwordReveal.label}</div>
          <div className={styles.passwordRow}>
            <div>
              <div className={styles.passwordLabel}>Логин</div>
              <div className={styles.passwordValue}>{passwordReveal.login}</div>
            </div>
            <div>
              <div className={styles.passwordLabel}>Пароль</div>
              <div className={styles.passwordValue}>{passwordReveal.password}</div>
            </div>
            <div className={styles.passwordActions}>
              <Button variant="ghost" onClick={handleCopyPassword}>
                Скопировать
              </Button>
              <Button variant="ghost" onClick={() => setPasswordReveal(null)}>
                Скрыть
              </Button>
            </div>
          </div>
          <div className={styles.passwordHint}>Пароль показывается один раз. Сохраните его.</div>
        </div>
      ) : null}

      {error ? (
        <div className={styles.error} role="status" aria-live="polite">
          {error}
        </div>
      ) : null}

      <div className={styles.list}>
        {listState === "loading" ? <div className={styles.loading}>Загрузка…</div> : null}
        {listState === "empty" ? <div className={styles.empty}>Учеников пока нет</div> : null}
        {listState === "ready"
          ? students.map((student) => {
              const isActive = transferStudentId === student.id;
              const availableTeachers = teachers.filter(
                (teacher) => teacher.id !== student.leadTeacherId,
              );
              return (
                <article
                  key={student.id}
                  className={`${styles.card} ${isActive ? styles.cardActive : ""}`}
                >
                  <div className={styles.cardHeader}>
                    <div>
                      <div className={styles.studentName}>{getDisplayName(student)}</div>
                      <div className={styles.studentMeta}>
                        {student.firstName || student.lastName
                          ? `Логин: ${student.login}`
                          : `Ведущий: ${student.leadTeacherLogin}`}
                      </div>
                      {student.firstName || student.lastName ? (
                        <div className={styles.studentMeta}>Ведущий: {student.leadTeacherLogin}</div>
                      ) : null}
                    </div>
                    <div className={styles.cardActions}>
                      <Button
                        variant="ghost"
                        onClick={() => handleResetPassword(student)}
                        disabled={resetBusyId === student.id}
                      >
                        Сбросить пароль
                      </Button>
                      <Button variant="ghost" onClick={() => handleStartEdit(student)}>
                        Редактировать
                      </Button>
                      <Button variant="ghost" onClick={() => handleStartTransfer(student)}>
                        Передать
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => handleDelete(student)}
                        disabled={deleteBusyId === student.id}
                      >
                        Удалить
                      </Button>
                    </div>
                  </div>

                  {editStudentId === student.id ? (
                    <div className={styles.editPanel}>
                      <div className={styles.inlineRow}>
                        <label className={styles.label}>
                          Имя
                          <Input
                            value={editFirstName}
                            placeholder="Имя"
                            onChange={(event) => setEditFirstName(event.target.value)}
                          />
                        </label>
                        <label className={styles.label}>
                          Фамилия
                          <Input
                            value={editLastName}
                            placeholder="Фамилия"
                            onChange={(event) => setEditLastName(event.target.value)}
                          />
                        </label>
                      </div>
                      {editError ? <div className={styles.formError}>{editError}</div> : null}
                      <div className={styles.formActions}>
                        <Button onClick={() => handleSaveEdit(student)} disabled={editBusy}>
                          Сохранить
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditStudentId(null);
                            setEditFirstName("");
                            setEditLastName("");
                            setEditError(null);
                          }}
                        >
                          Отмена
                        </Button>
                      </div>
                    </div>
                  ) : null}

                  {isActive ? (
                    <div className={styles.transferPanel}>
                      <label className={styles.label}>
                        Новый ведущий
                        <select
                          className={styles.select}
                          value={transferTeacherId}
                          onChange={(event) => setTransferTeacherId(event.target.value)}
                          disabled={loadingTeachers}
                        >
                          <option value="">Выберите преподавателя</option>
                          {availableTeachers.map((teacher) => (
                            <option key={teacher.id} value={teacher.id}>
                              {teacher.login}
                            </option>
                          ))}
                        </select>
                      </label>
                      {transferError ? <div className={styles.formError}>{transferError}</div> : null}
                      <div className={styles.formActions}>
                        <Button
                          onClick={() => handleTransfer(student)}
                          disabled={!transferTeacherId || transferBusy}
                        >
                          Подтвердить
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setTransferStudentId(null);
                            setTransferTeacherId("");
                            setTransferError(null);
                          }}
                        >
                          Отмена
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })
          : null}
      </div>
    </section>
  );
}
