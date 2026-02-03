import type { InputHTMLAttributes } from "react";
import styles from "./checkbox.module.css";

type CheckboxProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
};

export default function Checkbox({ label, className = "", ...props }: CheckboxProps) {
  return (
    <label className={`${styles.label} ${className}`}>
      <input type="checkbox" className={styles.input} {...props} />
      <span>{label}</span>
    </label>
  );
}
