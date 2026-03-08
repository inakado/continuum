"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import AlertDialog from "@/components/ui/AlertDialog";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { teacherApi, type StudentSummary, type TeacherSummary } from "@/lib/api/teacher";
import { contentQueryKeys } from "@/lib/query/keys";
import { formatApiErrorPayload } from "@/features/teacher-content/shared/api-errors";
import TeacherStudentProfilePanel from "./TeacherStudentProfilePanel";
import styles from "./teacher-students-panel.module.css";

type PasswordReveal = {
  login: string;
  password: string;
  label: string;
};

type StudentConfirmState =
  | { kind: "reset_password"; student: StudentSummary }
  | { kind: "delete_student"; student: StudentSummary }
  | null;

type Props = {
  studentId?: string;
};

type StudentIdentityFormProps = {
  firstName: string;
  lastName: string;
  login?: string;
  loginReadOnly?: boolean;
  submitLabel: string;
  submitDisabled: boolean;
  error: string | null;
  onCancel: () => void;
  onFirstNameChange: (value: string) => void;
  onLastNameChange: (value: string) => void;
  onLoginChange?: (value: string) => void;
  onSubmit: () => void;
};

type StudentCardProps = {
  availableTeachers: TeacherSummary[];
  deleteBusyId: string | null;
  getDisplayName: (student: StudentSummary) => string;
  handleStartEdit: (student: StudentSummary) => void;
  handleStartTransfer: (student: StudentSummary) => void;
  onDeleteStudent: (student: StudentSummary) => void;
  onOpenActionsChange: (open: boolean, studentId: string) => void;
  onOpenProfile: (studentId: string) => void;
  onOpenReviewInbox: (studentId: string) => void;
  onResetPassword: (student: StudentSummary) => void;
  onTransfer: (student: StudentSummary) => void;
  onTransferCancel: () => void;
  onTransferTeacherChange: (teacherId: string) => void;
  openActionsStudentId: string | null;
  resetBusyId: string | null;
  student: StudentSummary;
  transferBusy: boolean;
  transferSelectDisabled: boolean;
  transferError: string | null;
  transferStudentId: string | null;
  transferTeacherId: string;
};

type ConfirmDialogState = {
  actionText: string;
  busy: boolean;
  description: string;
  destructive: boolean;
  title: string;
};

const StudentIdentityForm = ({
  error,
  firstName,
  lastName,
  login,
  loginReadOnly = false,
  submitLabel,
  submitDisabled,
  onCancel,
  onFirstNameChange,
  onLastNameChange,
  onLoginChange,
  onSubmit,
}: StudentIdentityFormProps) => (
  <div className={styles.dialogBody}>
    <div className={styles.dialogFields}>
      {onLoginChange ? (
        <label className={styles.label}>
          Логин ученика
          <Input
            autoFocus
            className={styles.dialogInput}
            value={login ?? ""}
            placeholder="student_login"
            readOnly={loginReadOnly}
            onChange={(event) => onLoginChange(event.target.value)}
          />
        </label>
      ) : null}
      {loginReadOnly && login ? (
        <div className={styles.dialogMeta}>
          <span className={styles.dialogMetaLabel}>Логин</span>
          <span className={styles.dialogMetaValue}>{login}</span>
        </div>
      ) : null}
      <div className={styles.inlineRow}>
        <label className={styles.label}>
          Имя
          <Input
            autoFocus={!onLoginChange}
            className={styles.dialogInput}
            value={firstName}
            placeholder="Имя (необязательно)"
            onChange={(event) => onFirstNameChange(event.target.value)}
          />
        </label>
        <label className={styles.label}>
          Фамилия
          <Input
            className={styles.dialogInput}
            value={lastName}
            placeholder="Фамилия (необязательно)"
            onChange={(event) => onLastNameChange(event.target.value)}
          />
        </label>
      </div>
    </div>
    {error ? <div className={styles.formError}>{error}</div> : null}
    <div className={styles.dialogActions}>
      <Button onClick={onSubmit} disabled={submitDisabled}>
        {submitLabel}
      </Button>
      <Button variant="ghost" onClick={onCancel}>
        Отмена
      </Button>
    </div>
  </div>
);

const PasswordRevealPanel = ({
  onCopyPassword,
  onHide,
  passwordReveal,
}: {
  onCopyPassword: () => void;
  onHide: () => void;
  passwordReveal: PasswordReveal;
}) => (
  <div className={styles.passwordDialogBody}>
    <div className={styles.passwordReveal}>
      <div className={styles.passwordRow}>
        <div>
          <div className={styles.passwordLabel}>Логин</div>
          <div className={styles.passwordValue}>{passwordReveal.login}</div>
        </div>
        <div>
          <div className={styles.passwordLabel}>Пароль</div>
          <div className={styles.passwordValue}>{passwordReveal.password}</div>
        </div>
      </div>
      <div className={styles.passwordHint}>Пароль показывается один раз. Сохраните его.</div>
    </div>
    <div className={styles.dialogActions}>
      <Button variant="ghost" onClick={onCopyPassword}>
        Скопировать
      </Button>
      <Button onClick={onHide}>
        Закрыть
      </Button>
    </div>
  </div>
);

const getConfirmDialogState = (
  confirmState: StudentConfirmState,
  deleteBusyId: string | null,
  resetBusyId: string | null,
): ConfirmDialogState => {
  if (!confirmState) {
    return {
      actionText: "Подтвердить",
      busy: false,
      description: "",
      destructive: false,
      title: "",
    };
  }

  if (confirmState.kind === "reset_password") {
    return {
      actionText: "Сбросить пароль",
      busy: resetBusyId === confirmState.student.id,
      description: "Ученику будет выдан новый пароль.",
      destructive: false,
      title: `Сбросить пароль для ${confirmState.student.login}?`,
    };
  }

  return {
    actionText: "Удалить",
    busy: deleteBusyId === confirmState.student.id,
    description: "Действие необратимо. Ученик и связанные данные будут удалены.",
    destructive: true,
    title: `Удалить ученика ${confirmState.student.login}?`,
  };
};

const StudentCard = ({
  availableTeachers,
  deleteBusyId,
  getDisplayName,
  handleStartEdit,
  handleStartTransfer,
  onDeleteStudent,
  onOpenActionsChange,
  onOpenProfile,
  onOpenReviewInbox,
  onResetPassword,
  onTransfer,
  onTransferCancel,
  onTransferTeacherChange,
  openActionsStudentId,
  resetBusyId,
  student,
  transferBusy,
  transferSelectDisabled,
  transferError,
  transferStudentId,
  transferTeacherId,
}: StudentCardProps) => {
  const isTransferActive = transferStudentId === student.id;
  const isActionsMenuOpen = openActionsStudentId === student.id;
  const hasPendingReview = student.pendingPhotoReviewCount > 0;

  return (
    <article
      key={student.id}
      className={`${styles.card} ${isTransferActive ? styles.cardActive : ""} ${
        isActionsMenuOpen ? styles.cardMenuOpen : ""
      }`}
      onClick={() => onOpenProfile(student.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpenProfile(student.id);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className={styles.cardHeader}>
        <div className={styles.identity}>
          <div className={styles.studentName}>{getDisplayName(student)}</div>
          <div className={styles.studentMeta}>Логин: {student.login}</div>
          <div className={styles.studentMeta}>
            Ведущий: {student.leadTeacherDisplayName ?? student.leadTeacherLogin}
          </div>
        </div>
        <div className={styles.actionsMenu} onClick={(event) => event.stopPropagation()}>
          <DropdownMenu
            open={isActionsMenuOpen}
            onOpenChange={(open: boolean) => onOpenActionsChange(open, student.id)}
          >
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className={styles.actionsMenuTrigger}
                aria-label={`Действия для ученика ${getDisplayName(student)}`}
                onClick={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className={styles.actionsMenuIcon} aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className={styles.actionsMenuList}>
              {hasPendingReview ? (
                <DropdownMenuItem
                  className={styles.actionsMenuItem}
                  onSelect={() => onOpenReviewInbox(student.id)}
                >
                  К проверке фото
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
                className={styles.actionsMenuItem}
                onSelect={() => onResetPassword(student)}
                disabled={resetBusyId === student.id}
              >
                Сбросить пароль
              </DropdownMenuItem>
              <DropdownMenuItem
                className={styles.actionsMenuItem}
                onSelect={() => handleStartEdit(student)}
              >
                Редактировать
              </DropdownMenuItem>
              <DropdownMenuItem
                className={styles.actionsMenuItem}
                onSelect={() => handleStartTransfer(student)}
              >
                Передать
              </DropdownMenuItem>
              <DropdownMenuItem
                className={`${styles.actionsMenuItem} ${styles.actionsMenuItemDanger}`}
                onSelect={() => onDeleteStudent(student)}
                disabled={deleteBusyId === student.id}
              >
                Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {isTransferActive ? (
        <div className={styles.transferPanel} onClick={(event) => event.stopPropagation()}>
          <label className={styles.label}>
            Новый ведущий
            <Select
              triggerClassName={styles.selectTrigger}
              value={transferTeacherId}
              onValueChange={onTransferTeacherChange}
              disabled={transferSelectDisabled}
              options={[
                { value: "", label: "Выберите преподавателя" },
                ...availableTeachers.map((teacher) => ({
                  value: teacher.id,
                  label: teacher.login,
                })),
              ]}
              placeholder="Выберите преподавателя"
            />
          </label>
          {transferError ? <div className={styles.formError}>{transferError}</div> : null}
          <div className={styles.formActions}>
            <Button onClick={() => onTransfer(student)} disabled={!transferTeacherId || transferBusy}>
              Подтвердить
            </Button>
            <Button variant="ghost" onClick={onTransferCancel}>
              Отмена
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
};


export default function TeacherStudentsPanel({ studentId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
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
  const [confirmState, setConfirmState] = useState<StudentConfirmState>(null);
  const studentsQuery = useQuery({
    queryKey: contentQueryKeys.teacherStudents(debouncedQuery.trim() || undefined),
    queryFn: () => teacherApi.listStudents({ query: debouncedQuery.trim() || undefined }),
    enabled: !studentId,
  });
  const teachersQuery = useQuery({
    queryKey: contentQueryKeys.teacherTeachers(),
    queryFn: () => teacherApi.listTeachers(),
    enabled: !studentId,
  });
  const students: StudentSummary[] = studentsQuery.data ?? [];
  const teachers: TeacherSummary[] = teachersQuery.data ?? [];
  const loading = studentsQuery.isPending;
  const loadingTeachers = teachersQuery.isPending;
  const requestError = useMemo(() => {
    if (studentsQuery.isError) return formatApiErrorPayload(studentsQuery.error);
    if (teachersQuery.isError) return formatApiErrorPayload(teachersQuery.error);
    return null;
  }, [studentsQuery.error, studentsQuery.isError, teachersQuery.error, teachersQuery.isError]);
  const visibleError = error ?? requestError;

  const refreshStudents = useCallback(async () => {
    if (studentId) return;
    await queryClient.invalidateQueries({ queryKey: contentQueryKeys.teacherStudentsList() });
  }, [queryClient, studentId]);
  const createStudentMutation = useMutation({
    mutationFn: (input: { login: string; firstName: string | null; lastName: string | null }) =>
      teacherApi.createStudent(input),
  });
  const resetPasswordMutation = useMutation({
    mutationFn: (targetStudentId: string) => teacherApi.resetStudentPassword(targetStudentId),
  });
  const transferStudentMutation = useMutation({
    mutationFn: (input: { studentId: string; leaderTeacherId: string }) =>
      teacherApi.transferStudent(input.studentId, { leaderTeacherId: input.leaderTeacherId }),
  });
  const updateStudentMutation = useMutation({
    mutationFn: (input: { studentId: string; firstName: string | null; lastName: string | null }) =>
      teacherApi.updateStudentProfile(input.studentId, {
        firstName: input.firstName,
        lastName: input.lastName,
      }),
  });
  const deleteStudentMutation = useMutation({
    mutationFn: (targetStudentId: string) => teacherApi.deleteStudent(targetStudentId),
  });

  useEffect(() => {
    if (studentId) return;
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [query, studentId]);

  useEffect(() => {
    if (!openActionsStudentId) return;
    if (students.some((student) => student.id === openActionsStudentId)) return;
    setOpenActionsStudentId(null);
  }, [openActionsStudentId, students]);

  useEffect(() => {
    if (!editStudentId) return;
    if (students.some((student) => student.id === editStudentId)) return;
    setEditStudentId(null);
    setEditFirstName("");
    setEditLastName("");
    setEditError(null);
  }, [editStudentId, students]);

  const handleCreate = useCallback(async () => {
    const trimmed = createLogin.trim();
    if (!trimmed || creating) return;
    setCreateError(null);
    setCreating(true);
    try {
      const created = await createStudentMutation.mutateAsync({
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
  }, [createFirstName, createLastName, createLogin, createStudentMutation, creating, refreshStudents]);

  const handleResetPassword = async (student: StudentSummary) => {
    if (resetBusyId) return;
    setResetBusyId(student.id);
    setError(null);
    try {
      const data = await resetPasswordMutation.mutateAsync(student.id);
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
    setOpenActionsStudentId(null);
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
      await transferStudentMutation.mutateAsync({
        studentId: student.id,
        leaderTeacherId: transferTeacherId,
      });
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
    setOpenActionsStudentId(null);
    setTransferStudentId(null);
    setTransferTeacherId("");
    setEditStudentId(student.id);
    setEditFirstName(student.firstName ?? "");
    setEditLastName(student.lastName ?? "");
  };

  const handleSaveEdit = async (student: StudentSummary) => {
    if (editBusy) return;
    setEditBusy(true);
    setEditError(null);
    try {
      await updateStudentMutation.mutateAsync({
        studentId: student.id,
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
    setDeleteBusyId(student.id);
    setError(null);
    try {
      await deleteStudentMutation.mutateAsync(student.id);
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

  const handleCreateCancel = useCallback(() => {
    setShowCreateForm(false);
    setCreateLogin("");
    setCreateFirstName("");
    setCreateLastName("");
    setCreateError(null);
  }, []);

  const handleEditCancel = useCallback(() => {
    setEditStudentId(null);
    setEditFirstName("");
    setEditLastName("");
    setEditError(null);
  }, []);

  const handleTransferCancel = useCallback(() => {
    setTransferStudentId(null);
    setTransferTeacherId("");
    setTransferError(null);
  }, []);

  const openStudentProfile = useCallback(
    (targetStudentId: string) => {
      router.push(`/teacher/students/${targetStudentId}`);
    },
    [router],
  );

  const openStudentReviewInbox = useCallback(
    (targetStudentId: string) => {
      setOpenActionsStudentId(null);
      router.push(`/teacher/review?status=pending_review&sort=oldest&studentId=${targetStudentId}`);
    },
    [router],
  );

  const handleResetPasswordConfirm = useCallback(
    (student: StudentSummary) => {
      setOpenActionsStudentId(null);
      setConfirmState({ kind: "reset_password", student });
    },
    [],
  );

  const handleDeleteConfirm = useCallback(
    (student: StudentSummary) => {
      setOpenActionsStudentId(null);
      setConfirmState({ kind: "delete_student", student });
    },
    [],
  );

  const confirmDialogState = useMemo(
    () => getConfirmDialogState(confirmState, deleteBusyId, resetBusyId),
    [confirmState, deleteBusyId, resetBusyId],
  );

  const handleConfirmAction = async () => {
    if (!confirmState) return;
    if (confirmState.kind === "reset_password") {
      await handleResetPassword(confirmState.student);
    } else {
      await handleDelete(confirmState.student);
    }
    setConfirmState(null);
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

  const editingStudent = useMemo(
    () => students.find((student) => student.id === editStudentId) ?? null,
    [editStudentId, students],
  );

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
            setShowCreateForm(true);
            setCreateError(null);
            setPasswordReveal(null);
            setTransferStudentId(null);
            setTransferTeacherId("");
          }}
        >
          Добавить ученика
        </Button>
      </div>

      {visibleError ? (
        <div className={styles.error} role="status" aria-live="polite">
          {visibleError}
        </div>
      ) : null}

      <div className={styles.listView}>
        <div className={styles.list}>
          {listState === "loading" ? <div className={styles.loading}>Загрузка…</div> : null}
          {listState === "empty" ? <div className={styles.empty}>Ученики отсутствуют</div> : null}
          {listState === "ready"
            ? students.map((student) => {
                const availableTeachers =
                  availableTeachersByLeadTeacherId.get(student.leadTeacherId) ?? teachers;
                return (
                  <StudentCard
                    key={student.id}
                    availableTeachers={availableTeachers}
                    deleteBusyId={deleteBusyId}
                    getDisplayName={getDisplayName}
                    handleStartEdit={handleStartEdit}
                    handleStartTransfer={handleStartTransfer}
                    onDeleteStudent={handleDeleteConfirm}
                    onOpenActionsChange={(open, targetStudentId) =>
                      setOpenActionsStudentId(open ? targetStudentId : null)
                    }
                    onOpenProfile={openStudentProfile}
                    onOpenReviewInbox={openStudentReviewInbox}
                    onResetPassword={handleResetPasswordConfirm}
                    onTransfer={(targetStudent) => void handleTransfer(targetStudent)}
                    onTransferCancel={handleTransferCancel}
                    onTransferTeacherChange={setTransferTeacherId}
                    openActionsStudentId={openActionsStudentId}
                    resetBusyId={resetBusyId}
                    student={student}
                    transferBusy={transferBusy || loadingTeachers}
                    transferSelectDisabled={loadingTeachers}
                    transferError={transferError}
                    transferStudentId={transferStudentId}
                    transferTeacherId={transferTeacherId}
                  />
                );
              })
            : null}
        </div>
      </div>
      <Dialog
        open={showCreateForm}
        onOpenChange={(open) => {
          if (!open) {
            handleCreateCancel();
          }
        }}
        title="Создание ученика"
        className={styles.dialog}
        overlayClassName={styles.dialogOverlay}
      >
        <StudentIdentityForm
          login={createLogin}
          firstName={createFirstName}
          lastName={createLastName}
          submitLabel="Создать"
          submitDisabled={creating || !createLogin.trim()}
          error={createError}
          onCancel={handleCreateCancel}
          onFirstNameChange={setCreateFirstName}
          onLastNameChange={setCreateLastName}
          onLoginChange={setCreateLogin}
          onSubmit={() => void handleCreate()}
        />
      </Dialog>
      <Dialog
        open={Boolean(editingStudent)}
        onOpenChange={(open) => {
          if (!open) {
            handleEditCancel();
          }
        }}
        title={editingStudent ? `Редактирование ученика ${editingStudent.login}` : undefined}
        className={styles.dialog}
        overlayClassName={styles.dialogOverlay}
      >
        {editingStudent ? (
          <StudentIdentityForm
            login={editingStudent.login}
            loginReadOnly
            firstName={editFirstName}
            lastName={editLastName}
            submitLabel="Сохранить"
            submitDisabled={editBusy}
            error={editError}
            onCancel={handleEditCancel}
            onFirstNameChange={setEditFirstName}
            onLastNameChange={setEditLastName}
            onSubmit={() => void handleSaveEdit(editingStudent)}
          />
        ) : null}
      </Dialog>
      <Dialog
        open={Boolean(passwordReveal)}
        onOpenChange={(open) => {
          if (!open) {
            setPasswordReveal(null);
          }
        }}
        title={passwordReveal?.label}
        className={styles.dialog}
        overlayClassName={styles.dialogOverlay}
      >
        {passwordReveal ? (
          <PasswordRevealPanel
            onCopyPassword={() => void handleCopyPassword()}
            onHide={() => setPasswordReveal(null)}
            passwordReveal={passwordReveal}
          />
        ) : null}
      </Dialog>
      <AlertDialog
        open={Boolean(confirmState)}
        onOpenChange={(open) => {
          if (!open) setConfirmState(null);
        }}
        title={confirmDialogState.title}
        description={confirmDialogState.description}
        confirmText={confirmDialogState.actionText}
        cancelText="Отмена"
        confirmDisabled={confirmDialogState.busy}
        destructive={confirmDialogState.destructive}
        onConfirm={() => void handleConfirmAction()}
      />
    </section>
  );
}
