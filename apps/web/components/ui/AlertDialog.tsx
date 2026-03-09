"use client";

import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import type { ReactNode } from "react";
import Button from "./Button";
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
}: AlertDialogProps) {
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className={styles.overlay} />
        <AlertDialogPrimitive.Content className={styles.content}>
          <AlertDialogPrimitive.Title className={styles.title}>{title}</AlertDialogPrimitive.Title>
          {description ? (
            <AlertDialogPrimitive.Description className={styles.description}>
              {description}
            </AlertDialogPrimitive.Description>
          ) : null}
          <div className={styles.actions}>
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="secondary" className={styles.cancelButton}>
                {cancelText}
              </Button>
            </AlertDialogPrimitive.Cancel>
            <AlertDialogPrimitive.Action asChild onClick={onConfirm} disabled={confirmDisabled}>
              <Button
                variant={destructive ? "danger" : "primary"}
                className={`${styles.confirmButton} ${destructive ? styles.confirmButtonDanger : ""}`}
                disabled={confirmDisabled}
              >
                {confirmText}
              </Button>
            </AlertDialogPrimitive.Action>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
  );
}
