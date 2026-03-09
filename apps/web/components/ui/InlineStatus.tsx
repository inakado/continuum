import type { HTMLAttributes } from "react";
import styles from "./inline-status.module.css";

type InlineStatusProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "default" | "muted" | "success" | "warning" | "danger";
  size?: "sm" | "md";
};

export default function InlineStatus({
  tone = "default",
  size = "sm",
  className = "",
  ...props
}: InlineStatusProps) {
  return (
    <span
      className={[styles.status, styles[size], styles[tone], className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
