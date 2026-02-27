import { useId } from "react";
import Button from "@/components/ui/Button";
import Dialog from "@/components/ui/Dialog";
import {
  compileTargetLabels,
  type CompileErrorModalState,
} from "../hooks/use-teacher-unit-latex-compile";
import styles from "../teacher-unit-detail.module.css";

type Props = {
  state: CompileErrorModalState | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCopy: () => Promise<void> | void;
  onClose: () => void;
  copyState: "idle" | "copied" | "failed";
  logHint: string | null;
};

export function TeacherCompileErrorDialog({
  state,
  open,
  onOpenChange,
  onCopy,
  onClose,
  copyState,
  logHint,
}: Props) {
  const compileErrorDialogTitleId = useId();
  const compileErrorDialogBodyId = useId();

  if (!state) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      className={styles.compileErrorModal}
      overlayClassName={styles.compileErrorModalBackdrop}
    >
      <div className={styles.compileErrorModalHeader}>
        <div>
          <div id={compileErrorDialogTitleId} className={styles.compileErrorModalTitle}>
            Ошибка компиляции LaTeX
          </div>
          <div className={styles.compileErrorModalMeta}>
            <span>{compileTargetLabels[state.target]}</span>
            <span className={styles.compileErrorModalDot}>•</span>
            <span>job {state.jobId}</span>
          </div>
        </div>
        <span className={styles.compileErrorCodeBadge}>{state.code}</span>
      </div>

      <p id={compileErrorDialogBodyId} className={styles.compileErrorModalMessage}>
        {state.message}
      </p>

      {logHint ? <div className={styles.compileErrorModalHint}>{logHint}</div> : null}

      <pre className={styles.compileErrorModalLog}>{state.log ?? state.logSnippet ?? "Сервер не вернул текст лога."}</pre>

      <div className={styles.compileErrorModalActions}>
        <Button type="button" onClick={() => void onCopy()}>
          {copyState === "copied"
            ? "Скопировано"
            : copyState === "failed"
              ? "Не удалось скопировать"
              : "Копировать лог"}
        </Button>
        <Button type="button" variant="ghost" onClick={onClose}>
          Закрыть
        </Button>
      </div>
    </Dialog>
  );
}
