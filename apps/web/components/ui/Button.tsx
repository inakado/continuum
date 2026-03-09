import type { ButtonHTMLAttributes } from "react";
import styles from "./button.module.css";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export const getButtonClassName = ({
  variant = "primary",
  size = "md",
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) => {
  const variantClass =
    variant === "ghost"
      ? styles.ghost
      : variant === "secondary"
        ? styles.secondary
        : variant === "danger"
          ? styles.danger
          : styles.primary;
  const sizeClass = size === "sm" ? styles.sm : size === "lg" ? styles.lg : styles.md;

  return [styles.button, variantClass, sizeClass, className].filter(Boolean).join(" ");
};

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      type={props.type ?? "button"}
      className={getButtonClassName({ variant, size, className })}
      {...props}
    />
  );
}
