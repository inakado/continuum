"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import { useRef, type ReactNode } from "react";
import styles from "./alert-dialog.module.css";

type AlertDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  confirmDisabled?: boolean;
  destructive?: boolean;
  busy?: boolean;
  error?: string;
  returnFocus?: () => void;
};

export default function AlertDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Подтвердить",
  cancelText = "Отмена",
  onConfirm,
  confirmDisabled = false,
  destructive = false,
  busy = false,
  error,
  returnFocus,
}: AlertDialogProps) {
  const cancel = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={(value) => { if (!busy) onOpenChange(value); }}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className={styles.overlay} />
        <AlertDialogPrimitive.Content className={styles.content} aria-busy={busy} onOpenAutoFocus={(event) => { event.preventDefault(); cancel.current?.focus(); }} onCloseAutoFocus={(event) => { if (returnFocus) { event.preventDefault(); returnFocus(); } }} onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }}>
          <AlertDialogPrimitive.Title className={styles.title}>{title}</AlertDialogPrimitive.Title>
          {description ? (
            <AlertDialogPrimitive.Description className={styles.description}>
              {description}
            </AlertDialogPrimitive.Description>
          ) : null}
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.actions}>
            <AlertDialogPrimitive.Cancel asChild>
              <button ref={cancel} type="button" disabled={busy}>
                {cancelText}
              </button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild onClick={(event) => { event.preventDefault(); if (!busy && !confirmDisabled) void onConfirm(); }}>
              <button type="button"
                className={`${styles.confirmButton} ${destructive ? styles.confirmButtonDanger : ""}`}
                disabled={confirmDisabled || busy}
              >
                {busy ? "Выполняем…" : confirmText}
              </button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
