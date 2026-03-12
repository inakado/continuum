"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import AlertDialog from "@/components/ui/AlertDialog";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import EmptyState from "@/components/ui/EmptyState";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";
import FieldLabel from "@/components/ui/FieldLabel";
import Input from "@/components/ui/Input";
import Kicker from "@/components/ui/Kicker";
import Select from "@/components/ui/Select";
import { teacherApi, type StudentSummary, type TeacherSummary } from "@/lib/api/teacher";
import { contentQueryKeys } from "@/lib/query/keys";
import { formatApiErrorPayload } from "@/features/teacher-content/shared/api-errors";
import {
  getConfirmDialogState,
  useTeacherStudentsUiState,
  type PasswordReveal,
} from "./hooks/use-teacher-students-ui-state";
import TeacherStudentProfilePanel from "./TeacherStudentProfilePanel";
import styles from "./teacher-students-panel.module.css";

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
  profileHref: string;
  reviewInboxHref: string;
};

const STUDENT_WINDOW_ROW_HEIGHT = 112;
const STUDENT_WINDOW_OVERSCAN = 8;

const useStudentWindowing = <T,>({
  enabled,
  items,
}: {
  enabled: boolean;
  items: T[];
}) => {
  const [range, setRange] = useState({ start: 0, end: items.length });
  const [listElement, setListElement] = useState<HTMLDivElement | null>(null);

  const recalculate = useCallback(() => {
    if (!enabled || !listElement) {
      setRange({ start: 0, end: items.length });
      return;
    }

    const rect = listElement.getBoundingClientRect();
    const listTop = window.scrollY + rect.top;
    const viewportOffset = Math.max(window.scrollY - listTop, 0);
    const visibleRows = Math.ceil(window.innerHeight / STUDENT_WINDOW_ROW_HEIGHT) + STUDENT_WINDOW_OVERSCAN * 2;
    const start = Math.max(0, Math.floor(viewportOffset / STUDENT_WINDOW_ROW_HEIGHT) - STUDENT_WINDOW_OVERSCAN);
    const end = Math.min(items.length, start + visibleRows);

    setRange((previous) =>
      previous.start === start && previous.end === end ? previous : { start, end },
    );
  }, [enabled, items.length, listElement]);

  useEffect(() => {
    recalculate();
  }, [recalculate]);

  useEffect(() => {
    if (!enabled || !listElement) return;

    const handleViewportChange = () => {
      recalculate();
    };

    window.addEventListener("scroll", handleViewportChange, { passive: true });
    window.addEventListener("resize", handleViewportChange);

    return () => {
      window.removeEventListener("scroll", handleViewportChange);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [enabled, listElement, recalculate]);

  return {
    visibleItems: enabled ? items.slice(range.start, range.end) : items,
    topSpacerHeight: enabled ? range.start * STUDENT_WINDOW_ROW_HEIGHT : 0,
    bottomSpacerHeight: enabled ? Math.max(0, (items.length - range.end) * STUDENT_WINDOW_ROW_HEIGHT) : 0,
    setListElement,
  };
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
        <FieldLabel className={styles.label} label="Логин ученика">
          <Input
            className={styles.dialogInput}
            name="studentLogin"
            value={login ?? ""}
            placeholder="student_login…"
            autoComplete="username"
            spellCheck={false}
            readOnly={loginReadOnly}
            onChange={(event) => onLoginChange(event.target.value)}
          />
        </FieldLabel>
      ) : null}
      {loginReadOnly && login ? (
        <div className={styles.dialogMeta}>
          <span className={styles.dialogMetaLabel}>Логин</span>
          <span className={styles.dialogMetaValue}>{login}</span>
        </div>
      ) : null}
      <div className={styles.inlineRow}>
        <FieldLabel className={styles.label} label="Имя">
          <Input
            className={styles.dialogInput}
            value={firstName}
            placeholder="Имя (необязательно)"
            onChange={(event) => onFirstNameChange(event.target.value)}
          />
        </FieldLabel>
        <FieldLabel className={styles.label} label="Фамилия">
          <Input
            className={styles.dialogInput}
            value={lastName}
            placeholder="Фамилия (необязательно)"
            onChange={(event) => onLastNameChange(event.target.value)}
          />
        </FieldLabel>
      </div>
    </div>
    {error ? <div className={styles.formError}>{error}</div> : null}
    <div className={styles.dialogActions}>
      <Button onClick={onSubmit} disabled={submitDisabled}>
        {submitLabel}
      </Button>
      <Button variant="secondary" onClick={onCancel}>
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
          <Kicker className={styles.passwordLabel}>Логин</Kicker>
          <div className={styles.passwordValue}>{passwordReveal.login}</div>
        </div>
        <div>
          <Kicker className={styles.passwordLabel}>Пароль</Kicker>
          <div className={styles.passwordValue}>{passwordReveal.password}</div>
        </div>
      </div>
      <div className={styles.passwordHint}>Пароль показывается один раз. Сохраните его.</div>
    </div>
    <div className={styles.dialogActions}>
      <Button variant="secondary" onClick={onCopyPassword}>
        Скопировать
      </Button>
      <Button variant="ghost" onClick={onHide}>
        Закрыть
      </Button>
    </div>
  </div>
);

const StudentCard = ({
  availableTeachers,
  deleteBusyId,
  getDisplayName,
  handleStartEdit,
  handleStartTransfer,
  onDeleteStudent,
  onOpenActionsChange,
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
  profileHref,
  reviewInboxHref,
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
    >
      <div className={styles.cardHeader}>
        <Link href={profileHref} className={styles.primaryLink}>
          <div className={styles.identity}>
            <div className={styles.studentName}>{getDisplayName(student)}</div>
            <div className={styles.studentMetaRow}>
              <span className={styles.studentMetaItem}>
                <span className={styles.studentMetaLabel}>Логин</span>
                <span className={styles.studentMetaValue}>{student.login}</span>
              </span>
              <span className={styles.studentMetaItem}>
                <span className={styles.studentMetaLabel}>Ведущий</span>
                <span className={styles.studentMetaValue}>
                  {student.leadTeacherDisplayName ?? student.leadTeacherLogin}
                </span>
              </span>
            </div>
          </div>
        </Link>
        <div className={styles.actionsMenu}>
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
                <DropdownMenuItem asChild className={styles.actionsMenuItem}>
                  <Link href={reviewInboxHref}>К проверке фото</Link>
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
        <div className={styles.transferPanel}>
          <FieldLabel className={styles.label} label="Новый ведущий">
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
          </FieldLabel>
          {transferError ? <div className={styles.formError}>{transferError}</div> : null}
          <div className={styles.formActions}>
            <Button onClick={() => onTransfer(student)} disabled={!transferTeacherId || transferBusy}>
              Подтвердить
            </Button>
            <Button variant="secondary" onClick={onTransferCancel}>
              Отмена
            </Button>
          </div>
        </div>
      ) : null}
    </article>
  );
};


export default function TeacherStudentsPanel({ studentId }: Props) {
  const queryClient = useQueryClient();
  const uiState = useTeacherStudentsUiState({ studentId });
  const studentsQuery = useQuery({
    queryKey: contentQueryKeys.teacherStudents(uiState.state.debouncedQuery.trim() || undefined),
    queryFn: () =>
      teacherApi.listStudents({ query: uiState.state.debouncedQuery.trim() || undefined }),
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
  const visibleError = uiState.state.error ?? requestError;

  useEffect(() => {
    if (uiState.state.openActionsStudentId && !students.some((student) => student.id === uiState.state.openActionsStudentId)) {
      uiState.setOpenActionsStudentId(null);
    }
    if (uiState.state.edit.studentId && !students.some((student) => student.id === uiState.state.edit.studentId)) {
      uiState.cancelEdit();
    }
  }, [
    students,
    uiState,
    uiState.state.edit.studentId,
    uiState.state.openActionsStudentId,
  ]);

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

  const handleCreate = useCallback(async () => {
    const trimmed = uiState.state.create.login.trim();
    if (!trimmed || uiState.state.create.loading) return;
    uiState.setCreateError(null);
    uiState.setCreateLoading(true);
    try {
      const created = await createStudentMutation.mutateAsync({
        login: trimmed,
        firstName: uiState.state.create.firstName.trim() || null,
        lastName: uiState.state.create.lastName.trim() || null,
      });
      uiState.closeCreate();
      uiState.showPasswordReveal({
        login: created.login,
        password: created.password,
        label: "Новый ученик создан",
      });
      await refreshStudents();
    } catch (err) {
      uiState.setCreateError(formatApiErrorPayload(err));
    } finally {
      uiState.setCreateLoading(false);
    }
  }, [
    createStudentMutation,
    refreshStudents,
    uiState,
  ]);

  const handleResetPassword = async (student: StudentSummary) => {
    if (uiState.state.resetBusyId) return;
    uiState.setResetBusyId(student.id);
    uiState.setError(null);
    try {
      const data = await resetPasswordMutation.mutateAsync(student.id);
      uiState.showPasswordReveal({
        login: data.login,
        password: data.password,
        label: "Пароль обновлён",
      });
    } catch (err) {
      uiState.setError(formatApiErrorPayload(err));
    } finally {
      uiState.setResetBusyId(null);
    }
  };

  const handleStartTransfer = (student: StudentSummary) => {
    uiState.startTransfer(student);
  };

  const handleTransfer = async (student: StudentSummary) => {
    if (!uiState.state.transfer.teacherId || uiState.state.transfer.busy) return;
    uiState.setTransferBusy(true);
    uiState.setTransferError(null);
    try {
      await transferStudentMutation.mutateAsync({
        studentId: student.id,
        leaderTeacherId: uiState.state.transfer.teacherId,
      });
      uiState.completeTransfer();
      await refreshStudents();
    } catch (err) {
      uiState.setTransferError(formatApiErrorPayload(err));
    } finally {
      uiState.setTransferBusy(false);
    }
  };

  const handleStartEdit = (student: StudentSummary) => {
    uiState.startEdit(student);
  };

  const handleSaveEdit = async (student: StudentSummary) => {
    if (uiState.state.edit.busy) return;
    uiState.setEditBusy(true);
    uiState.setEditError(null);
    try {
      await updateStudentMutation.mutateAsync({
        studentId: student.id,
        firstName: uiState.state.edit.firstName.trim() || null,
        lastName: uiState.state.edit.lastName.trim() || null,
      });
      uiState.completeEdit();
      await refreshStudents();
    } catch (err) {
      uiState.setEditError(formatApiErrorPayload(err));
    } finally {
      uiState.setEditBusy(false);
    }
  };

  const handleDelete = async (student: StudentSummary) => {
    if (uiState.state.deleteBusyId) return;
    uiState.setDeleteBusyId(student.id);
    uiState.setError(null);
    try {
      await deleteStudentMutation.mutateAsync(student.id);
      uiState.completeDelete(student.id);
      await refreshStudents();
    } catch (err) {
      uiState.setError(formatApiErrorPayload(err));
    } finally {
      uiState.setDeleteBusyId(null);
    }
  };

  const confirmDialogState = useMemo(
    () =>
      getConfirmDialogState(
        uiState.state.confirmState,
        uiState.state.deleteBusyId,
        uiState.state.resetBusyId,
      ),
    [uiState.state.confirmState, uiState.state.deleteBusyId, uiState.state.resetBusyId],
  );

  const handleConfirmAction = async () => {
    if (!uiState.state.confirmState) return;
    if (uiState.state.confirmState.kind === "reset_password") {
      await handleResetPassword(uiState.state.confirmState.student);
    } else {
      await handleDelete(uiState.state.confirmState.student);
    }
    uiState.closeConfirm();
  };

  const handleCopyPassword = async () => {
    if (!uiState.state.passwordReveal?.password) return;
    try {
      await navigator.clipboard.writeText(uiState.state.passwordReveal.password);
    } catch {
      /* noop */
    }
  };

  const listState = useMemo(() => {
    if (loading) return "loading";
    if (students.length === 0) return "empty";
    return "ready";
  }, [loading, students.length]);
  const virtualizedStudentsEnabled = listState === "ready" && students.length > 40;
  const {
    visibleItems: visibleStudents,
    topSpacerHeight,
    bottomSpacerHeight,
    setListElement,
  } = useStudentWindowing({
    enabled: virtualizedStudentsEnabled,
    items: students,
  });

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
    () => students.find((student) => student.id === uiState.state.edit.studentId) ?? null,
    [students, uiState.state.edit.studentId],
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
          <FieldLabel className={styles.label} label="Поиск по имени или логину">
            <Input
              value={uiState.state.query}
              placeholder="Например: Петров или student01…"
              onChange={(event) => uiState.setQuery(event.target.value)}
            />
          </FieldLabel>
        </div>
        <Button
          className={styles.createButton}
          onClick={uiState.openCreate}
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
        <div ref={setListElement} className={styles.list}>
          {listState === "loading" ? <div className={styles.loading}>Загрузка…</div> : null}
          {listState === "empty" ? (
            <EmptyState
              title="Ученики отсутствуют"
              description="Добавьте первого ученика, чтобы открыть teacher review и progress drilldown."
            />
          ) : null}
          {virtualizedStudentsEnabled && topSpacerHeight > 0 ? (
            <div className={styles.listSpacer} style={{ height: topSpacerHeight }} aria-hidden="true" />
          ) : null}
          {listState === "ready"
            ? visibleStudents.map((student) => {
                const availableTeachers =
                  availableTeachersByLeadTeacherId.get(student.leadTeacherId) ?? teachers;
                return (
                  <StudentCard
                    key={student.id}
                    availableTeachers={availableTeachers}
                    deleteBusyId={uiState.state.deleteBusyId}
                    getDisplayName={getDisplayName}
                    handleStartEdit={handleStartEdit}
                    handleStartTransfer={handleStartTransfer}
                    onDeleteStudent={uiState.openDeleteConfirm}
                    onOpenActionsChange={(open, targetStudentId) =>
                      uiState.setOpenActionsStudentId(open ? targetStudentId : null)
                    }
                    onResetPassword={uiState.openResetPasswordConfirm}
                    onTransfer={(targetStudent) => void handleTransfer(targetStudent)}
                    onTransferCancel={uiState.cancelTransfer}
                    onTransferTeacherChange={uiState.setTransferTeacherId}
                    openActionsStudentId={uiState.state.openActionsStudentId}
                    resetBusyId={uiState.state.resetBusyId}
                    student={student}
                    transferBusy={uiState.state.transfer.busy || loadingTeachers}
                    transferSelectDisabled={loadingTeachers}
                    transferError={uiState.state.transfer.error}
                    transferStudentId={uiState.state.transfer.studentId}
                    transferTeacherId={uiState.state.transfer.teacherId}
                    profileHref={`/teacher/students/${student.id}`}
                    reviewInboxHref={`/teacher/review?status=pending_review&sort=oldest&studentId=${student.id}`}
                  />
                );
              })
            : null}
          {virtualizedStudentsEnabled && bottomSpacerHeight > 0 ? (
            <div className={styles.listSpacer} style={{ height: bottomSpacerHeight }} aria-hidden="true" />
          ) : null}
        </div>
      </div>
      <Dialog
        open={uiState.state.create.open}
        onOpenChange={(open) => {
          if (!open) {
            uiState.closeCreate();
          }
        }}
        title="Создание ученика"
        className={styles.dialog}
        overlayClassName={styles.dialogOverlay}
      >
        <StudentIdentityForm
          login={uiState.state.create.login}
          firstName={uiState.state.create.firstName}
          lastName={uiState.state.create.lastName}
          submitLabel="Создать"
          submitDisabled={uiState.state.create.loading || !uiState.state.create.login.trim()}
          error={uiState.state.create.error}
          onCancel={uiState.closeCreate}
          onFirstNameChange={uiState.setCreateFirstName}
          onLastNameChange={uiState.setCreateLastName}
          onLoginChange={uiState.setCreateLogin}
          onSubmit={() => void handleCreate()}
        />
      </Dialog>
      <Dialog
        open={Boolean(editingStudent)}
        onOpenChange={(open) => {
          if (!open) {
            uiState.cancelEdit();
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
            firstName={uiState.state.edit.firstName}
            lastName={uiState.state.edit.lastName}
            submitLabel="Сохранить"
            submitDisabled={uiState.state.edit.busy}
            error={uiState.state.edit.error}
            onCancel={uiState.cancelEdit}
            onFirstNameChange={uiState.setEditFirstName}
            onLastNameChange={uiState.setEditLastName}
            onSubmit={() => void handleSaveEdit(editingStudent)}
          />
        ) : null}
      </Dialog>
      <Dialog
        open={Boolean(uiState.state.passwordReveal)}
        onOpenChange={(open) => {
          if (!open) {
            uiState.hidePasswordReveal();
          }
        }}
        title={uiState.state.passwordReveal?.label}
        className={styles.dialog}
        overlayClassName={styles.dialogOverlay}
      >
        {uiState.state.passwordReveal ? (
          <PasswordRevealPanel
            onCopyPassword={() => void handleCopyPassword()}
            onHide={uiState.hidePasswordReveal}
            passwordReveal={uiState.state.passwordReveal as PasswordReveal}
          />
        ) : null}
      </Dialog>
      <AlertDialog
        open={Boolean(uiState.state.confirmState)}
        onOpenChange={(open) => {
          if (!open) uiState.closeConfirm();
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
