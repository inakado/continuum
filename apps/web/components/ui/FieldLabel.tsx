import type { LabelHTMLAttributes, ReactNode } from "react";
import styles from "./field-label.module.css";

type FieldLabelProps = LabelHTMLAttributes<HTMLLabelElement> & {
  label: ReactNode;
  hint?: ReactNode;
  requiredMark?: boolean;
  children: ReactNode;
};

export default function FieldLabel({
  label,
  hint,
  requiredMark = false,
  className = "",
  children,
  ...props
}: FieldLabelProps) {
  return (
    <label className={[styles.root, className].filter(Boolean).join(" ")} {...props}>
      <span className={styles.labelRow}>
        <span className={styles.labelText}>{label}</span>
        {requiredMark ? <span className={styles.required}>*</span> : null}
      </span>
      {children}
      {hint ? <span className={styles.hint}>{hint}</span> : null}
    </label>
  );
}
