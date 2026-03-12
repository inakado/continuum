import { useEffect, useReducer } from "react";
import type { StudentSummary } from "@/lib/api/teacher";

export type PasswordReveal = {
  login: string;
  password: string;
  label: string;
};

type StudentConfirmState =
  | { kind: "reset_password"; student: StudentSummary }
  | { kind: "delete_student"; student: StudentSummary }
  | null;

type ConfirmDialogState = {
  title: string;
  description: string;
  actionText: string;
  destructive: boolean;
  busy: boolean;
};

type State = {
  query: string;
  debouncedQuery: string;
  error: string | null;
  create: {
    open: boolean;
    login: string;
    firstName: string;
    lastName: string;
    error: string | null;
    loading: boolean;
  };
  passwordReveal: PasswordReveal | null;
  resetBusyId: string | null;
  transfer: {
    studentId: string | null;
    teacherId: string;
    busy: boolean;
    error: string | null;
  };
  edit: {
    studentId: string | null;
    firstName: string;
    lastName: string;
    busy: boolean;
    error: string | null;
  };
  deleteBusyId: string | null;
  openActionsStudentId: string | null;
  confirmState: StudentConfirmState;
};

type Action =
  | { type: "query/set"; value: string }
  | { type: "query/debounce-sync" }
  | { type: "error/set"; value: string | null }
  | { type: "actions-menu/set"; studentId: string | null }
  | { type: "actions-menu/clear-missing" }
  | { type: "create/open" }
  | { type: "create/close" }
  | { type: "create/login"; value: string }
  | { type: "create/first-name"; value: string }
  | { type: "create/last-name"; value: string }
  | { type: "create/error"; value: string | null }
  | { type: "create/loading"; value: boolean }
  | { type: "password/show"; value: PasswordReveal }
  | { type: "password/hide" }
  | { type: "reset/busy"; studentId: string | null }
  | { type: "transfer/start"; student: StudentSummary }
  | { type: "transfer/cancel" }
  | { type: "transfer/teacher"; teacherId: string }
  | { type: "transfer/error"; value: string | null }
  | { type: "transfer/busy"; value: boolean }
  | { type: "transfer/complete" }
  | { type: "edit/start"; student: StudentSummary }
  | { type: "edit/cancel" }
  | { type: "edit/first-name"; value: string }
  | { type: "edit/last-name"; value: string }
  | { type: "edit/error"; value: string | null }
  | { type: "edit/busy"; value: boolean }
  | { type: "edit/clear-missing" }
  | { type: "edit/complete" }
  | { type: "delete/busy"; studentId: string | null }
  | { type: "delete/complete"; studentId: string }
  | { type: "confirm/open-reset"; student: StudentSummary }
  | { type: "confirm/open-delete"; student: StudentSummary }
  | { type: "confirm/close" };

const initialState: State = {
  query: "",
  debouncedQuery: "",
  error: null,
  create: {
    open: false,
    login: "",
    firstName: "",
    lastName: "",
    error: null,
    loading: false,
  },
  passwordReveal: null,
  resetBusyId: null,
  transfer: {
    studentId: null,
    teacherId: "",
    busy: false,
    error: null,
  },
  edit: {
    studentId: null,
    firstName: "",
    lastName: "",
    busy: false,
    error: null,
  },
  deleteBusyId: null,
  openActionsStudentId: null,
  confirmState: null,
};

const emptyCreateState = () => ({
  open: false,
  login: "",
  firstName: "",
  lastName: "",
  error: null,
  loading: false,
});

const emptyTransferState = () => ({
  studentId: null,
  teacherId: "",
  busy: false,
  error: null,
});

const emptyEditState = () => ({
  studentId: null,
  firstName: "",
  lastName: "",
  busy: false,
  error: null,
});

const reduceCreateState = (state: State, action: Action): State => {
  switch (action.type) {
    case "create/open":
      return {
        ...state,
        create: {
          ...state.create,
          open: true,
          error: null,
        },
        passwordReveal: null,
        transfer: {
          ...state.transfer,
          studentId: null,
          teacherId: "",
          error: null,
        },
      };
    case "create/close":
      return {
        ...state,
        create: emptyCreateState(),
      };
    case "create/login":
      return {
        ...state,
        create: {
          ...state.create,
          login: action.value,
        },
      };
    case "create/first-name":
      return {
        ...state,
        create: {
          ...state.create,
          firstName: action.value,
        },
      };
    case "create/last-name":
      return {
        ...state,
        create: {
          ...state.create,
          lastName: action.value,
        },
      };
    case "create/error":
      return {
        ...state,
        create: {
          ...state.create,
          error: action.value,
        },
      };
    case "create/loading":
      return {
        ...state,
        create: {
          ...state.create,
          loading: action.value,
        },
      };
    default:
      return state;
  }
};

const reduceTransferState = (state: State, action: Action): State => {
  switch (action.type) {
    case "transfer/start":
      return {
        ...state,
        openActionsStudentId: null,
        transfer:
          state.transfer.studentId === action.student.id
            ? emptyTransferState()
            : { studentId: action.student.id, teacherId: "", busy: false, error: null },
      };
    case "transfer/cancel":
      return {
        ...state,
        transfer: emptyTransferState(),
      };
    case "transfer/teacher":
      return {
        ...state,
        transfer: {
          ...state.transfer,
          teacherId: action.teacherId,
        },
      };
    case "transfer/error":
      return {
        ...state,
        transfer: {
          ...state.transfer,
          error: action.value,
        },
      };
    case "transfer/busy":
      return {
        ...state,
        transfer: {
          ...state.transfer,
          busy: action.value,
        },
      };
    case "transfer/complete":
      return {
        ...state,
        transfer: emptyTransferState(),
      };
    default:
      return state;
  }
};

const reduceEditState = (state: State, action: Action): State => {
  switch (action.type) {
    case "edit/start":
      return {
        ...state,
        openActionsStudentId: null,
        transfer: emptyTransferState(),
        edit: {
          studentId: action.student.id,
          firstName: action.student.firstName ?? "",
          lastName: action.student.lastName ?? "",
          busy: false,
          error: null,
        },
      };
    case "edit/cancel":
    case "edit/clear-missing":
    case "edit/complete":
      return {
        ...state,
        edit: emptyEditState(),
      };
    case "edit/first-name":
      return {
        ...state,
        edit: {
          ...state.edit,
          firstName: action.value,
        },
      };
    case "edit/last-name":
      return {
        ...state,
        edit: {
          ...state.edit,
          lastName: action.value,
        },
      };
    case "edit/error":
      return {
        ...state,
        edit: {
          ...state.edit,
          error: action.value,
        },
      };
    case "edit/busy":
      return {
        ...state,
        edit: {
          ...state.edit,
          busy: action.value,
        },
      };
    default:
      return state;
  }
};

const reduceConfirmState = (state: State, action: Action): State => {
  switch (action.type) {
    case "confirm/open-reset":
      return {
        ...state,
        openActionsStudentId: null,
        confirmState: { kind: "reset_password", student: action.student },
      };
    case "confirm/open-delete":
      return {
        ...state,
        openActionsStudentId: null,
        confirmState: { kind: "delete_student", student: action.student },
      };
    case "confirm/close":
      return { ...state, confirmState: null };
    default:
      return state;
  }
};

const reducer = (state: State, action: Action): State => {
  if (action.type.startsWith("create/")) {
    return reduceCreateState(state, action);
  }

  if (action.type.startsWith("transfer/")) {
    return reduceTransferState(state, action);
  }

  if (action.type.startsWith("edit/")) {
    return reduceEditState(state, action);
  }

  if (action.type.startsWith("confirm/")) {
    return reduceConfirmState(state, action);
  }

  switch (action.type) {
    case "query/set":
      return { ...state, query: action.value };
    case "query/debounce-sync":
      return state.debouncedQuery === state.query
        ? state
        : { ...state, debouncedQuery: state.query };
    case "error/set":
      return { ...state, error: action.value };
    case "actions-menu/set":
      return { ...state, openActionsStudentId: action.studentId };
    case "actions-menu/clear-missing":
      return state.openActionsStudentId ? { ...state, openActionsStudentId: null } : state;
    case "password/show":
      return { ...state, passwordReveal: action.value };
    case "password/hide":
      return { ...state, passwordReveal: null };
    case "reset/busy":
      return { ...state, resetBusyId: action.studentId };
    case "delete/busy":
      return { ...state, deleteBusyId: action.studentId };
    case "delete/complete":
      return {
        ...state,
        openActionsStudentId:
          state.openActionsStudentId === action.studentId ? null : state.openActionsStudentId,
        transfer:
          state.transfer.studentId === action.studentId ? emptyTransferState() : state.transfer,
        edit: state.edit.studentId === action.studentId ? emptyEditState() : state.edit,
      };
    default:
      return state;
  }
};

export const getConfirmDialogState = (
  confirmState: StudentConfirmState,
  deleteBusyId: string | null,
  resetBusyId: string | null,
): ConfirmDialogState => {
  if (confirmState?.kind === "delete_student") {
    return {
      title: `Удалить ученика ${confirmState.student.login}?`,
      description:
        "Учётная запись будет удалена. Если у ученика есть история решений или проверки, убедитесь, что действие действительно требуется.",
      actionText: "Удалить",
      destructive: true,
      busy: deleteBusyId === confirmState.student.id,
    };
  }

  if (confirmState?.kind === "reset_password") {
    return {
      title: `Сбросить пароль для ${confirmState.student.login}?`,
      description:
        "Система сгенерирует новый пароль. Старый пароль перестанет работать сразу после подтверждения.",
      actionText: "Сбросить пароль",
      destructive: false,
      busy: resetBusyId === confirmState.student.id,
    };
  }

  return {
    title: "",
    description: "",
    actionText: "Подтвердить",
    destructive: false,
    busy: false,
  };
};

export const useTeacherStudentsUiState = ({
  studentId,
}: {
  studentId?: string;
}) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (studentId) return;
    const handle = window.setTimeout(() => {
      dispatch({ type: "query/debounce-sync" });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [state.query, studentId]);

  return {
    state,
    setQuery: (value: string) => dispatch({ type: "query/set", value }),
    setError: (value: string | null) => dispatch({ type: "error/set", value }),
    setOpenActionsStudentId: (studentId: string | null) =>
      dispatch({ type: "actions-menu/set", studentId }),
    openCreate: () => dispatch({ type: "create/open" }),
    closeCreate: () => dispatch({ type: "create/close" }),
    setCreateLogin: (value: string) => dispatch({ type: "create/login", value }),
    setCreateFirstName: (value: string) => dispatch({ type: "create/first-name", value }),
    setCreateLastName: (value: string) => dispatch({ type: "create/last-name", value }),
    setCreateError: (value: string | null) => dispatch({ type: "create/error", value }),
    setCreateLoading: (value: boolean) => dispatch({ type: "create/loading", value }),
    showPasswordReveal: (value: PasswordReveal) => dispatch({ type: "password/show", value }),
    hidePasswordReveal: () => dispatch({ type: "password/hide" }),
    setResetBusyId: (studentId: string | null) => dispatch({ type: "reset/busy", studentId }),
    startTransfer: (student: StudentSummary) => dispatch({ type: "transfer/start", student }),
    cancelTransfer: () => dispatch({ type: "transfer/cancel" }),
    setTransferTeacherId: (teacherId: string) => dispatch({ type: "transfer/teacher", teacherId }),
    setTransferError: (value: string | null) => dispatch({ type: "transfer/error", value }),
    setTransferBusy: (value: boolean) => dispatch({ type: "transfer/busy", value }),
    completeTransfer: () => dispatch({ type: "transfer/complete" }),
    startEdit: (student: StudentSummary) => dispatch({ type: "edit/start", student }),
    cancelEdit: () => dispatch({ type: "edit/cancel" }),
    setEditFirstName: (value: string) => dispatch({ type: "edit/first-name", value }),
    setEditLastName: (value: string) => dispatch({ type: "edit/last-name", value }),
    setEditError: (value: string | null) => dispatch({ type: "edit/error", value }),
    setEditBusy: (value: boolean) => dispatch({ type: "edit/busy", value }),
    completeEdit: () => dispatch({ type: "edit/complete" }),
    setDeleteBusyId: (studentId: string | null) => dispatch({ type: "delete/busy", studentId }),
    completeDelete: (studentId: string) => dispatch({ type: "delete/complete", studentId }),
    openResetPasswordConfirm: (student: StudentSummary) =>
      dispatch({ type: "confirm/open-reset", student }),
    openDeleteConfirm: (student: StudentSummary) => dispatch({ type: "confirm/open-delete", student }),
    closeConfirm: () => dispatch({ type: "confirm/close" }),
  };
};
