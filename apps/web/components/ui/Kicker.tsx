import type { HTMLAttributes } from "react";
import styles from "./kicker.module.css";

type KickerProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: "muted" | "accent";
};

export default function Kicker({ tone = "muted", className = "", ...props }: KickerProps) {
  return (
    <span
      className={[styles.kicker, tone === "accent" ? styles.accent : "", className].filter(Boolean).join(" ")}
      {...props}
    />
  );
}
