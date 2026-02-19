"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { teacherApi, type StudentSummary, type TeacherSummary } from "@/lib/api/teacher";
import { formatApiErrorPayload } from "@/features/teacher-content/shared/api-errors";
import TeacherStudentProfilePanel from "./TeacherStudentProfilePanel";
import styles from "./teacher-students-panel.module.css";

type PasswordReveal = {
  login: string;
  password: string;
  label: string;
};

type Props = {
  studentId?: string;
};

export default function TeacherStudentsPanel({ studentId }: Props) {
  const router = useRouter();
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
  const [openActionsStudentId, setOpenActionsStudentId] = useState<string | null>(null);
  const studentsRequestIdRef = useRef(0);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

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
      setError(formatApiErrorPayload(err));
    } finally {
      if (requestId === studentsRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const refreshStudents = useCallback(async () => {
    if (studentId) return;
    await fetchStudents(query);
  }, [fetchStudents, query, studentId]);

  const fetchTeachers = useCallback(async () => {
    setLoadingTeachers(true);
    try {
      const data = await teacherApi.listTeachers();
      setTeachers(data);
    } catch (err) {
      setError(formatApiErrorPayload(err));
    } finally {
      setLoadingTeachers(false);
    }
  }, []);

  useEffect(() => {
    if (studentId) return;
    void fetchTeachers();
  }, [fetchTeachers, studentId]);

  useEffect(() => {
    if (studentId) return;
    const handle = window.setTimeout(() => {
      void fetchStudents(query);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, fetchStudents, studentId]);

  useEffect(() => {
    if (!openActionsStudentId) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (actionsMenuRef.current && target && actionsMenuRef.current.contains(target)) return;
      setOpenActionsStudentId(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenActionsStudentId(null);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openActionsStudentId]);

  useEffect(() => {
    if (!openActionsStudentId) return;
    if (students.some((student) => student.id === openActionsStudentId)) return;
    setOpenActionsStudentId(null);
  }, [openActionsStudentId, students]);

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
      await refreshStudents();
    } catch (err) {
      setCreateError(formatApiErrorPayload(err));
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
      setError(formatApiErrorPayload(err));
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
      await refreshStudents();
    } catch (err) {
      setTransferError(formatApiErrorPayload(err));
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
      await refreshStudents();
    } catch (err) {
      setEditError(formatApiErrorPayload(err));
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
      setOpenActionsStudentId((prev) => (prev === student.id ? null : prev));
      if (editStudentId === student.id) {
        setEditStudentId(null);
        setEditFirstName("");
        setEditLastName("");
      }
      if (transferStudentId === student.id) {
        setTransferStudentId(null);
        setTransferTeacherId("");
      }
      await refreshStudents();
    } catch (err) {
      setError(formatApiErrorPayload(err));
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

  const availableTeachersByLeadTeacherId = useMemo(() => {
    const map = new Map<string, TeacherSummary[]>();
    for (const teacher of teachers) {
      if (map.has(teacher.id)) continue;
      map.set(
        teacher.id,
        teachers.filter((candidate) => candidate.id !== teacher.id),
      );
    }
    return map;
  }, [teachers]);

  const getDisplayName = (student: StudentSummary) => {
    const parts = [student.lastName, student.firstName].filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
    return student.login;
  };

  if (studentId) {
    return (
      <section className={styles.panel}>
        <div className={styles.profileView}>
          <TeacherStudentProfilePanel
            studentId={studentId}
            fallbackName={studentId}
            onRefreshStudents={refreshStudents}
          />
        </div>
      </section>
    );
  }

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <label className={styles.label}>
            Поиск по имени или логину
            <Input
              value={query}
              placeholder="Например: Петров или student01"
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

      <div className={styles.listView}>
        <div className={styles.list}>
          {listState === "loading" ? <div className={styles.loading}>Загрузка…</div> : null}
          {listState === "empty" ? <div className={styles.empty}>Ученики отсутствуют</div> : null}
          {listState === "ready"
            ? students.map((student) => {
                const isTransferActive = transferStudentId === student.id;
                const isActionsMenuOpen = openActionsStudentId === student.id;
                const availableTeachers =
                  availableTeachersByLeadTeacherId.get(student.leadTeacherId) ?? teachers;
                const hasPendingReview = student.pendingPhotoReviewCount > 0;

                return (
                  <article
                    key={student.id}
                    className={`${styles.card} ${isTransferActive ? styles.cardActive : ""} ${
                      isActionsMenuOpen ? styles.cardMenuOpen : ""
                    }`}
                    onClick={() => router.push(`/teacher/students/${student.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/teacher/students/${student.id}`);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={styles.cardHeader}>
                      <div className={styles.identity}>
                        <div className={styles.studentName}>{getDisplayName(student)}</div>
                        <div className={styles.studentMeta}>Логин: {student.login}</div>
                        <div className={styles.studentMeta}>Ведущий: {student.leadTeacherLogin}</div>
                      </div>
                      <div
                        className={styles.actionsMenu}
                        ref={isActionsMenuOpen ? actionsMenuRef : null}
                        onClick={(event) => event.stopPropagation()}
                      >
                        <Button
                          variant="ghost"
                          className={styles.actionsMenuTrigger}
                          aria-expanded={isActionsMenuOpen}
                          aria-controls={`student-actions-${student.id}`}
                          aria-label={`Действия для ученика ${getDisplayName(student)}`}
                          onClick={() =>
                            setOpenActionsStudentId((prev) => (prev === student.id ? null : student.id))
                          }
                        >
                          <MoreHorizontal className={styles.actionsMenuIcon} aria-hidden="true" />
                        </Button>
                        {isActionsMenuOpen ? (
                          <div id={`student-actions-${student.id}`} className={styles.actionsMenuList}>
                            {hasPendingReview ? (
                              <button
                                type="button"
                                className={styles.actionsMenuItem}
                                onClick={() => {
                                  setOpenActionsStudentId(null);
                                  router.push(
                                    `/teacher/review?status=pending_review&sort=oldest&studentId=${student.id}`,
                                  );
                                }}
                              >
                                К проверке фото
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className={styles.actionsMenuItem}
                              onClick={() => {
                                setOpenActionsStudentId(null);
                                void handleResetPassword(student);
                              }}
                              disabled={resetBusyId === student.id}
                            >
                              Сбросить пароль
                            </button>
                            <button
                              type="button"
                              className={styles.actionsMenuItem}
                              onClick={() => {
                                setOpenActionsStudentId(null);
                                handleStartEdit(student);
                              }}
                            >
                              Редактировать
                            </button>
                            <button
                              type="button"
                              className={styles.actionsMenuItem}
                              onClick={() => {
                                setOpenActionsStudentId(null);
                                handleStartTransfer(student);
                              }}
                            >
                              Передать
                            </button>
                            <button
                              type="button"
                              className={`${styles.actionsMenuItem} ${styles.actionsMenuItemDanger}`}
                              onClick={() => {
                                setOpenActionsStudentId(null);
                                void handleDelete(student);
                              }}
                              disabled={deleteBusyId === student.id}
                            >
                              Удалить
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {editStudentId === student.id ? (
                      <div className={styles.editPanel} onClick={(event) => event.stopPropagation()}>
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
                          <Button onClick={() => void handleSaveEdit(student)} disabled={editBusy}>
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

                    {isTransferActive ? (
                      <div className={styles.transferPanel} onClick={(event) => event.stopPropagation()}>
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
                            onClick={() => void handleTransfer(student)}
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
      </div>
    </section>
  );
}
