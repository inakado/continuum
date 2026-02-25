"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import styles from "./dialog.module.css";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  overlayClassName?: string;
};

export default function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className = "",
  overlayClassName = "",
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={`${styles.overlay} ${overlayClassName}`} />
        <DialogPrimitive.Content className={`${styles.content} ${className}`}>
          {title ? <DialogPrimitive.Title className={styles.title}>{title}</DialogPrimitive.Title> : null}
          {description ? (
            <DialogPrimitive.Description className={styles.description}>
              {description}
            </DialogPrimitive.Description>
          ) : null}
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export {
  DialogPrimitive,
};
