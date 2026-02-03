import type { ButtonHTMLAttributes } from "react";
import styles from "./button.module.css";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export default function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const variantClass = variant === "ghost" ? styles.ghost : styles.primary;
  return <button className={`${styles.button} ${variantClass} ${className}`} {...props} />;
}
